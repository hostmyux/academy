import { Router } from "express";
import { storage } from "../storage";
import { TenantMiddleware } from "../middleware/tenant";
import { aiService } from "../services/aiService";
import { insertMessageSchema, insertEmailTemplateSchema, insertSmsTemplateSchema } from "@shared/schema";
import { z } from "zod";
import { Server } from "socket.io";

const router = Router();

// Store socket.io instance for real-time communication
let io: Server;

export const initializeSocket = (socketIo: Server) => {
  io = socketIo;
  
  io.on('connection', (socket) => {
    console.log('User connected to communication system:', socket.id);
    
    // Join tenant-specific rooms
    socket.on('join-tenant', (tenantId: string) => {
      socket.join(`tenant-${tenantId}`);
      console.log(`User ${socket.id} joined tenant ${tenantId}`);
    });
    
    // Join conversation rooms
    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conversation-${conversationId}`);
      console.log(`User ${socket.id} joined conversation ${conversationId}`);
    });
    
    // Handle typing indicators
    socket.on('typing', (data: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation-${data.conversationId}`).emit('user-typing', {
        userId: socket.id,
        isTyping: data.isTyping
      });
    });
    
    // Handle message read receipts
    socket.on('message-read', (data: { messageId: string; conversationId: string }) => {
      socket.to(`conversation-${data.conversationId}`).emit('message-read-receipt', {
        messageId: data.messageId,
        readBy: socket.id
      });
    });
    
    socket.on('disconnect', () => {
      console.log('User disconnected from communication system:', socket.id);
    });
  });
};

// Get all conversations for user
router.get("/conversations", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const { type, unreadOnly } = req.query;
    
    let conversations = await storage.getConversationsByUser(
      tenantContext.userId,
      tenantContext.tenantId,
      tenantContext.subAccountId
    );
    
    // Filter by type if specified
    if (type) {
      conversations = conversations.filter(conv => conv.type === type);
    }
    
    // Filter by unread status if specified
    if (unreadOnly === 'true') {
      conversations = conversations.filter(conv => conv.unreadCount > 0);
    }
    
    // Get last message for each conversation
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await storage.getLastMessage(conv.id);
        return {
          ...conv,
          lastMessage
        };
      })
    );
    
    // Sort by last message timestamp
    conversationsWithLastMessage.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt || a.createdAt;
      const timeB = b.lastMessage?.createdAt || b.createdAt;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
    
    res.json(conversationsWithLastMessage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get specific conversation with messages
router.get("/conversations/:id", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const conversation = await storage.getConversation(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    
    // Check access permissions
    if (conversation.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    if (tenantContext.userRole === 'agent' && conversation.subAccountId !== tenantContext.subAccountId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    // Check if user is participant
    const isParticipant = conversation.participants.some(p => p.userId === tenantContext.userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    // Get messages for this conversation
    const messages = await storage.getMessagesByConversation(req.params.id);
    
    // Mark messages as read for this user
    await storage.markMessagesAsRead(req.params.id, tenantContext.userId);
    
    // Emit read receipt via socket
    if (io) {
      io.to(`conversation-${req.params.id}`).emit('messages-read', {
        conversationId: req.params.id,
        userId: tenantContext.userId
      });
    }
    
    res.json({
      conversation,
      messages
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create new conversation
router.post("/conversations", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const { type, title, participantIds, initialMessage } = req.body;
    
    if (!type || !participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({ message: "Type and participants are required" });
    }
    
    // Create conversation
    const conversation = await storage.createConversation({
      tenantId: tenantContext.tenantId,
      subAccountId: tenantContext.subAccountId || null,
      type,
      title: title || `${type} Conversation`,
      createdById: tenantContext.userId,
      participants: participantIds.map((id: string) => ({
        userId: id,
        role: id === tenantContext.userId ? 'admin' : 'member'
      }))
    });
    
    // Send initial message if provided
    if (initialMessage) {
      const message = await storage.createMessage({
        conversationId: conversation.id,
        senderId: tenantContext.userId,
        content: initialMessage,
        type: 'text'
      });
      
      // Emit message via socket
      if (io) {
        io.to(`conversation-${conversation.id}`).emit('new-message', {
          conversationId: conversation.id,
          message
        });
        
        // Notify participants
        participantIds.forEach((participantId: string) => {
          if (participantId !== tenantContext.userId) {
            io.to(`user-${participantId}`).emit('new-conversation', {
              conversation,
              message
            });
          }
        });
      }
    }
    
    res.status(201).json(conversation);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Send message
router.post("/conversations/:id/messages", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const { content, type = 'text', metadata } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: "Message content is required" });
    }
    
    // Verify conversation exists and user has access
    const conversation = await storage.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    
    if (conversation.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const isParticipant = conversation.participants.some(p => p.userId === tenantContext.userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    // Create message
    const message = await storage.createMessage({
      conversationId: req.params.id,
      senderId: tenantContext.userId,
      content,
      type,
      metadata
    });
    
    // Emit message via socket for real-time delivery
    if (io) {
      io.to(`conversation-${req.params.id}`).emit('new-message', {
        conversationId: req.params.id,
        message
      });
      
      // Notify participants who are not in the conversation room
      conversation.participants.forEach((participant) => {
        if (participant.userId !== tenantContext.userId) {
          io.to(`user-${participant.userId}`).emit('message-notification', {
            conversationId: req.params.id,
            message,
            senderName: participant.userId === tenantContext.userId ? 'You' : 'Someone'
          });
        }
      });
    }
    
    // AI-powered response for student conversations
    if (conversation.type === 'student_consultant' && type === 'text') {
      try {
        const aiResponse = await aiService.generateChatResponse({
          message: content,
          conversationContext: {
            studentId: conversation.participants.find(p => p.role === 'student')?.userId,
            consultantId: conversation.participants.find(p => p.role === 'consultant')?.userId,
            conversationHistory: await storage.getMessagesByConversation(req.params.id, 10)
          }
        });
        
        if (aiResponse) {
          const aiMessage = await storage.createMessage({
            conversationId: req.params.id,
            senderId: 'ai-assistant', // Special AI user ID
            content: aiResponse.content,
            type: 'ai_response',
            metadata: {
              confidence: aiResponse.confidence,
              suggestions: aiResponse.suggestions
            }
          });
          
          // Emit AI response via socket
          if (io) {
            io.to(`conversation-${req.params.id}`).emit('new-message', {
              conversationId: req.params.id,
              message: aiMessage
            });
          }
        }
      } catch (error) {
        console.error('Error generating AI response:', error);
      }
    }
    
    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Email templates management
router.get("/email-templates", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const templates = await storage.getEmailTemplates(tenantContext.tenantId);
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/email-templates", TenantMiddleware.requireSubAccountAdmin, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const templateData = insertEmailTemplateSchema.parse(req.body);
    
    const template = await storage.createEmailTemplate({
      ...templateData,
      tenantId: tenantContext.tenantId,
      createdById: tenantContext.userId
    });
    
    res.status(201).json(template);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// Send email
router.post("/send-email", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const { to, templateId, templateData, customContent } = req.body;
    
    if (!to || !templateId) {
      return res.status(400).json({ message: "Recipient and template are required" });
    }
    
    // Get template
    const template = await storage.getEmailTemplate(templateId);
    if (!template || template.tenantId !== tenantContext.tenantId) {
      return res.status(404).json({ message: "Template not found" });
    }
    
    // Generate email content using AI if template supports it
    let emailContent = customContent || template.content;
    if (template.aiGenerated && !customContent) {
      try {
        const aiEmail = await aiService.generateEmailTemplate(
          template.type as any,
          {
            studentName: templateData.studentName || 'Student',
            programName: templateData.programName,
            universityName: templateData.universityName,
            deadline: templateData.deadline,
            agentName: templateData.agentName || 'Your Consultant'
          }
        );
        
        emailContent = aiEmail.body;
      } catch (error) {
        console.error('Error generating AI email:', error);
      }
    }
    
    // Send email (in production, use a proper email service)
    const emailRecord = await storage.createEmailRecord({
      tenantId: tenantContext.tenantId,
      subAccountId: tenantContext.subAccountId || null,
      from: tenantContext.userId,
      to,
      subject: template.subject,
      content: emailContent,
      templateId,
      templateData,
      status: 'sent'
    });
    
    // Log the email send activity
    await storage.createActivity({
      tenantId: tenantContext.tenantId,
      subAccountId: tenantContext.subAccountId || null,
      userId: tenantContext.userId,
      type: "email_sent",
      description: `Email sent to ${to} using template: ${template.name}`,
      metadata: {
        emailId: emailRecord.id,
        templateId: template.id
      }
    });
    
    res.json({ message: "Email sent successfully", emailId: emailRecord.id });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// SMS templates management
router.get("/sms-templates", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const templates = await storage.getSmsTemplates(tenantContext.tenantId);
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/sms-templates", TenantMiddleware.requireSubAccountAdmin, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const templateData = insertSmsTemplateSchema.parse(req.body);
    
    const template = await storage.createSmsTemplate({
      ...templateData,
      tenantId: tenantContext.tenantId,
      createdById: tenantContext.userId
    });
    
    res.status(201).json(template);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// Send SMS
router.post("/send-sms", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const { to, templateId, templateData } = req.body;
    
    if (!to || !templateId) {
      return res.status(400).json({ message: "Phone number and template are required" });
    }
    
    // Get template
    const template = await storage.getSmsTemplate(templateId);
    if (!template || template.tenantId !== tenantContext.tenantId) {
      return res.status(404).json({ message: "Template not found" });
    }
    
    // Send SMS (in production, use a proper SMS service)
    const smsRecord = await storage.createSmsRecord({
      tenantId: tenantContext.tenantId,
      subAccountId: tenantContext.subAccountId || null,
      from: tenantContext.userId,
      to,
      content: template.content,
      templateId,
      templateData,
      status: 'sent'
    });
    
    // Log the SMS send activity
    await storage.createActivity({
      tenantId: tenantContext.tenantId,
      subAccountId: tenantContext.subAccountId || null,
      userId: tenantContext.userId,
      type: "sms_sent",
      description: `SMS sent to ${to} using template: ${template.name}`,
      metadata: {
        smsId: smsRecord.id,
        templateId: template.id
      }
    });
    
    res.json({ message: "SMS sent successfully", smsId: smsRecord.id });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get communication analytics
router.get("/analytics", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const { period = '7d' } = req.query;
    
    const analytics = await storage.getCommunicationAnalytics(
      tenantContext.tenantId,
      tenantContext.subAccountId,
      period as string
    );
    
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Chatbot interface
router.post("/chatbot", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }
    
    // Generate AI response
    const aiResponse = await aiService.generateChatbotResponse({
      message,
      context: {
        ...context,
        tenantId: tenantContext.tenantId,
        userId: tenantContext.userId,
        userRole: tenantContext.userRole
      }
    });
    
    // Log chatbot interaction
    await storage.createChatbotInteraction({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      message,
      response: aiResponse.content,
      intent: aiResponse.intent,
      confidence: aiResponse.confidence
    });
    
    res.json(aiResponse);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Automated responses configuration
router.get("/auto-responses", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const autoResponses = await storage.getAutoResponses(tenantContext.tenantId);
    res.json(autoResponses);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/auto-responses", TenantMiddleware.requireSubAccountAdmin, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const { trigger, response, conditions } = req.body;
    
    const autoResponse = await storage.createAutoResponse({
      tenantId: tenantContext.tenantId,
      trigger,
      response,
      conditions,
      createdById: tenantContext.userId
    });
    
    res.status(201).json(autoResponse);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
export { initializeSocket };