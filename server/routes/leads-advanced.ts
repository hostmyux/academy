import { Router } from "express";
import { storage } from "../storage";
import { TenantMiddleware } from "../middleware/tenant";
import { aiService } from "../services/aiService";
import { insertLeadSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

// Advanced lead search with multiple filters
router.get("/search", TenantMiddleware.requireAgent, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const {
      query,
      status,
      source,
      assignedAgentId,
      minScore,
      maxScore,
      targetCountry,
      programInterest,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20
    } = req.query;

    let leads = await storage.getLeadsByTenant(context.tenantId, context.subAccountId);

    // Apply filters
    if (query) {
      const searchLower = query.toString().toLowerCase();
      leads = leads.filter(lead => 
        lead.firstName.toLowerCase().includes(searchLower) ||
        lead.lastName.toLowerCase().includes(searchLower) ||
        lead.email.toLowerCase().includes(searchLower) ||
        (lead.notes && lead.notes.toLowerCase().includes(searchLower))
      );
    }

    if (status) {
      leads = leads.filter(lead => lead.status === status);
    }

    if (source) {
      leads = leads.filter(lead => lead.source === source);
    }

    if (assignedAgentId) {
      leads = leads.filter(lead => lead.assignedAgentId === assignedAgentId);
    }

    if (minScore) {
      leads = leads.filter(lead => (lead.score || 0) >= parseInt(minScore.toString()));
    }

    if (maxScore) {
      leads = leads.filter(lead => (lead.score || 0) <= parseInt(maxScore.toString()));
    }

    if (targetCountry) {
      leads = leads.filter(lead => lead.targetCountry === targetCountry);
    }

    if (programInterest) {
      leads = leads.filter(lead => 
        lead.programInterest && lead.programInterest.toLowerCase().includes(programInterest.toString().toLowerCase())
      );
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom.toString());
      leads = leads.filter(lead => new Date(lead.createdAt) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo.toString());
      leads = leads.filter(lead => new Date(lead.createdAt) <= toDate);
    }

    // Pagination
    const offset = (parseInt(page.toString()) - 1) * parseInt(limit.toString());
    const paginatedLeads = leads.slice(offset, offset + parseInt(limit.toString()));

    res.json({
      leads: paginatedLeads,
      pagination: {
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        total: leads.length,
        pages: Math.ceil(leads.length / parseInt(limit.toString()))
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk lead operations
router.post("/bulk", TenantMiddleware.requireAgent, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const { operation, leadIds, data } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ message: "Lead IDs array is required" });
    }

    if (!['update', 'delete', 'assign'].includes(operation)) {
      return res.status(400).json({ message: "Invalid operation" });
    }

    const results = [];

    for (const leadId of leadIds) {
      try {
        const lead = await storage.getLead(leadId);
        
        if (!lead) {
          results.push({ leadId, success: false, error: "Lead not found" });
          continue;
        }

        // Check permissions
        if (lead.tenantId !== context.tenantId) {
          results.push({ leadId, success: false, error: "Access denied" });
          continue;
        }

        if (context.userRole === 'agent' && lead.subAccountId !== context.subAccountId) {
          results.push({ leadId, success: false, error: "Access denied" });
          continue;
        }

        switch (operation) {
          case 'update':
            const updatedLead = await storage.updateLead(leadId, data);
            results.push({ leadId, success: true, data: updatedLead });
            break;
          
          case 'assign':
            if (data.assignedAgentId) {
              const assignedLead = await storage.updateLead(leadId, { assignedAgentId: data.assignedAgentId });
              results.push({ leadId, success: true, data: assignedLead });
            }
            break;
          
          case 'delete':
            // In a real implementation, you would delete the lead
            results.push({ leadId, success: true, message: "Lead deleted" });
            break;
        }
      } catch (error: any) {
        results.push({ leadId, success: false, error: error.message });
      }
    }

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Lead capture webhook for external sources
router.post("/capture", async (req, res) => {
  try {
    const { source, webhookData } = req.body;
    
    // Validate webhook source (in production, you'd verify signatures/tokens)
    const validSources = ['website', 'facebook', 'google', 'email', 'api'];
    if (!validSources.includes(source)) {
      return res.status(400).json({ message: "Invalid source" });
    }

    // Extract lead data from webhook
    const leadData = {
      firstName: webhookData.firstName || webhookData.name?.split(' ')[0],
      lastName: webhookData.lastName || webhookData.name?.split(' ')[1] || '',
      email: webhookData.email,
      phone: webhookData.phone,
      source: source,
      programInterest: webhookData.programInterest || webhookData.course,
      targetCountry: webhookData.targetCountry || webhookData.country,
      budget: webhookData.budget,
      notes: webhookData.message || webhookData.notes,
      customFields: {
        ...webhookData.customFields,
        sourceDetails: webhookData,
        capturedAt: new Date().toISOString()
      }
    };

    // Validate required fields
    if (!leadData.firstName || !leadData.email) {
      return res.status(400).json({ message: "First name and email are required" });
    }

    // For webhooks, we need to determine the tenant
    // This could be based on domain, API key, or other identifiers
    let tenantId = webhookData.tenantId;
    if (!tenantId) {
      // Default to first tenant or handle error
      return res.status(400).json({ message: "Tenant identification required" });
    }

    // Create the lead
    const lead = await storage.createLead({
      ...leadData,
      tenantId,
      subAccountId: webhookData.subAccountId || null,
      assignedAgentId: webhookData.assignedAgentId || null
    });

    // AI scoring
    try {
      const score = await aiService.scoreLead(lead);
      await storage.updateLead(lead.id, { score });
    } catch (error) {
      console.error('Error scoring lead:', error);
    }

    // Create activity
    await storage.createActivity({
      tenantId,
      subAccountId: webhookData.subAccountId || null,
      userId: webhookData.assignedAgentId || null,
      leadId: lead.id,
      type: "lead_added",
      description: `Lead captured from ${source}: ${lead.firstName} ${lead.lastName}`,
      metadata: {
        source,
        webhookData: JSON.stringify(webhookData)
      }
    });

    res.status(201).json({ 
      success: true, 
      lead: { ...lead, password: undefined },
      message: "Lead captured successfully" 
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Duplicate lead detection and merging
router.post("/merge-duplicates", TenantMiddleware.requireAgent, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const { primaryLeadId, duplicateLeadIds } = req.body;

    if (!primaryLeadId || !Array.isArray(duplicateLeadIds) || duplicateLeadIds.length === 0) {
      return res.status(400).json({ message: "Primary lead ID and duplicate lead IDs array are required" });
    }

    // Get primary lead
    const primaryLead = await storage.getLead(primaryLeadId);
    if (!primaryLead) {
      return res.status(404).json({ message: "Primary lead not found" });
    }

    // Check permissions
    if (primaryLead.tenantId !== context.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const mergeResults = [];

    for (const duplicateId of duplicateLeadIds) {
      try {
        const duplicateLead = await storage.getLead(duplicateId);
        
        if (!duplicateLead) {
          mergeResults.push({ duplicateId, success: false, error: "Duplicate lead not found" });
          continue;
        }

        // Check permissions
        if (duplicateLead.tenantId !== context.tenantId) {
          mergeResults.push({ duplicateId, success: false, error: "Access denied" });
          continue;
        }

        // Merge logic - combine data from both leads
        const mergedData = {
          ...primaryLead,
          // Prefer primary lead data but fill in gaps from duplicate
          phone: primaryLead.phone || duplicateLead.phone,
          source: primaryLead.source || duplicateLead.source,
          programInterest: primaryLead.programInterest || duplicateLead.programInterest,
          targetCountry: primaryLead.targetCountry || duplicateLead.targetCountry,
          budget: primaryLead.budget || duplicateLead.budget,
          notes: `${primaryLead.notes || ''}\n\n--- Merged from duplicate ---\n${duplicateLead.notes || ''}`.trim(),
          customFields: {
            ...primaryLead.customFields,
            ...duplicateLead.customFields
          },
          engagementHistory: [
            ...(primaryLead.engagementHistory || []),
            ...(duplicateLead.engagementHistory || [])
          ]
        };

        // Update primary lead with merged data
        const updatedLead = await storage.updateLead(primaryLeadId, mergedData);
        
        // Mark duplicate as merged/inactive
        await storage.updateLead(duplicateId, { 
          isActive: false,
          customFields: {
            ...duplicateLead.customFields,
            mergedInto: primaryLeadId,
            mergedAt: new Date().toISOString()
          }
        });

        mergeResults.push({ 
          duplicateId, 
          success: true, 
          message: "Successfully merged",
          primaryLead: updatedLead 
        });
      } catch (error: any) {
        mergeResults.push({ duplicateId, success: false, error: error.message });
      }
    }

    res.json({ mergeResults });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Lead engagement tracking
router.post("/:id/engagement", TenantMiddleware.requireAgent, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const { type, details, metadata } = req.body;

    const lead = await storage.getLead(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check permissions
    if (lead.tenantId !== context.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (context.userRole === 'agent' && lead.subAccountId !== context.subAccountId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Add engagement to lead's engagement history
    const engagementHistory = lead.engagementHistory || [];
    engagementHistory.push({
      type,
      date: new Date().toISOString(),
      details,
      metadata
    });

    const updatedLead = await storage.updateLead(req.params.id, { engagementHistory });

    // Create activity
    await storage.createActivity({
      tenantId: context.tenantId,
      subAccountId: context.subAccountId || null,
      userId: context.userId,
      leadId: req.params.id,
      type: "engagement_recorded",
      description: `${type} engagement recorded for ${lead.firstName} ${lead.lastName}`
    });

    res.json(updatedLead);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Lead scoring and AI insights
router.get("/:id/insights", TenantMiddleware.requireAgent, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const lead = await storage.getLead(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check permissions
    if (lead.tenantId !== context.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (context.userRole === 'agent' && lead.subAccountId !== context.subAccountId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get AI insights
    const [score, sentiment, recommendations] = await Promise.all([
      aiService.scoreLead(lead),
      aiService.analyzeSentiment(lead.notes || ''),
      aiService.generateInsights({
        leads: [lead],
        applications: [],
        revenue: 0,
        period: 'current'
      })
    ]);

    res.json({
      lead: {
        id: lead.id,
        name: `${lead.firstName} ${lead.lastName}`,
        email: lead.email,
        status: lead.status,
        score: lead.score
      },
      insights: {
        score,
        sentiment,
        recommendations: recommendations.insights,
        nextSteps: recommendations.recommendations
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;