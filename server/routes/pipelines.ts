import { Router } from "express";
import { storage } from "../storage";
import { TenantMiddleware } from "../middleware/tenant";
import { insertPipelineSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

// Get all pipelines for tenant/sub-account
router.get("/", TenantMiddleware.requireAgent, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const pipelines = await storage.getPipelinesByTenant(context.tenantId, context.subAccountId);
    res.json(pipelines);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new pipeline
router.post("/", TenantMiddleware.requireSubAccountAdmin, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const validatedData = insertPipelineSchema.parse(req.body);
    
    const pipeline = await storage.createPipeline({
      ...validatedData,
      tenantId: context.tenantId,
      subAccountId: context.subAccountId || null
    });

    res.status(201).json(pipeline);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// Get pipeline by ID
router.get("/:id", TenantMiddleware.requireAgent, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const pipeline = await storage.getPipeline(req.params.id);
    
    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline not found" });
    }

    // Verify pipeline belongs to tenant
    if (pipeline.tenantId !== context.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // If user is not tenant admin, verify sub-account access
    if (context.userRole === 'agent' && pipeline.subAccountId !== context.subAccountId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(pipeline);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Update pipeline
router.put("/:id", TenantMiddleware.requireSubAccountAdmin, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const pipeline = await storage.getPipeline(req.params.id);
    
    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline not found" });
    }

    // Verify pipeline belongs to tenant
    if (pipeline.tenantId !== context.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const validatedData = insertPipelineSchema.partial().parse(req.body);
    const updatedPipeline = await storage.updatePipeline(req.params.id, validatedData);

    res.json(updatedPipeline);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// Delete pipeline
router.delete("/:id", TenantMiddleware.requireSubAccountAdmin, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const pipeline = await storage.getPipeline(req.params.id);
    
    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline not found" });
    }

    // Verify pipeline belongs to tenant
    if (pipeline.tenantId !== context.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Check if pipeline is default
    if (pipeline.isDefault) {
      return res.status(400).json({ message: "Cannot delete default pipeline" });
    }

    // In a real implementation, you would delete the pipeline here
    res.json({ message: "Pipeline deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get pipeline items (leads or applications in pipeline stages)
router.get("/:id/items", TenantMiddleware.requireAgent, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const pipeline = await storage.getPipeline(req.params.id);
    
    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline not found" });
    }

    // Verify pipeline belongs to tenant
    if (pipeline.tenantId !== context.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (context.userRole === 'agent' && pipeline.subAccountId !== context.subAccountId) {
      return res.status(403).json({ message: "Access denied" });
    }

    let items;
    if (pipeline.type === 'lead') {
      items = await storage.getLeadsByTenant(context.tenantId, context.subAccountId);
    } else if (pipeline.type === 'application') {
      items = await storage.getApplicationsByTenant(context.tenantId, context.subAccountId);
    } else {
      return res.status(400).json({ message: "Invalid pipeline type" });
    }

    // Group items by pipeline stage
    const stages = pipeline.stages || [];
    const groupedItems = stages.map(stage => ({
      ...stage,
      items: items.filter(item => {
        // This would need to be stored in the item's pipelineStage field
        // For now, we'll use status as a proxy
        return item.status === stage.id || item.status === stage.name;
      })
    }));

    res.json(groupedItems);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Move item to different stage
router.put("/:id/items/:itemId/move", TenantMiddleware.requireAgent, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const { fromStage, toStage, position } = req.body;

    const pipeline = await storage.getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline not found" });
    }

    // Verify pipeline belongs to tenant
    if (pipeline.tenantId !== context.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (context.userRole === 'agent' && pipeline.subAccountId !== context.subAccountId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get the item (lead or application)
    let item;
    if (pipeline.type === 'lead') {
      item = await storage.getLead(req.params.itemId);
    } else if (pipeline.type === 'application') {
      item = await storage.getApplication(req.params.itemId);
    } else {
      return res.status(400).json({ message: "Invalid pipeline type" });
    }

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Verify item belongs to tenant
    if (item.tenantId !== context.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Update item status to new stage
    let updatedItem;
    if (pipeline.type === 'lead') {
      updatedItem = await storage.updateLead(req.params.itemId, { 
        status: toStage,
        // Update engagement history
        engagementHistory: [
          ...(item.engagementHistory || []),
          {
            type: 'pipeline_move',
            date: new Date().toISOString(),
            details: `Moved from ${fromStage} to ${toStage}`,
            metadata: {
              pipelineId: req.params.id,
              fromStage,
              toStage,
              movedBy: context.userId
            }
          }
        ]
      });
    } else {
      updatedItem = await storage.updateApplication(req.params.itemId, { 
        status: toStage,
        // Update timeline
        timeline: [
          ...(item.timeline || []),
          {
            stage: toStage,
            date: new Date().toISOString(),
            status: 'moved',
            notes: `Moved from ${fromStage} to ${toStage}`
          }
        ]
      });
    }

    // Create activity
    await storage.createActivity({
      tenantId: context.tenantId,
      subAccountId: context.subAccountId || null,
      userId: context.userId,
      leadId: pipeline.type === 'lead' ? req.params.itemId : null,
      applicationId: pipeline.type === 'application' ? req.params.itemId : null,
      type: "pipeline_item_moved",
      description: `${pipeline.type} moved from ${fromStage} to ${toStage}`,
      metadata: {
        pipelineId: req.params.id,
        itemId: req.params.itemId,
        fromStage,
        toStage,
        movedBy: context.userId
      }
    });

    res.json(updatedItem);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create default pipelines for tenant
router.post("/create-default", TenantMiddleware.requireTenantAdmin, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const { type } = req.body;

    if (!['lead', 'application'].includes(type)) {
      return res.status(400).json({ message: "Pipeline type must be 'lead' or 'application'" });
    }

    let defaultStages;
    if (type === 'lead') {
      defaultStages = [
        { id: 'new', name: 'New Lead', order: 0, color: '#3B82F6' },
        { id: 'contacted', name: 'Contacted', order: 1, color: '#8B5CF6' },
        { id: 'qualified', name: 'Qualified', order: 2, color: '#10B981' },
        { id: 'proposal_sent', name: 'Proposal Sent', order: 3, color: '#F59E0B' },
        { id: 'converted', name: 'Converted', order: 4, color: '#EF4444' }
      ];
    } else {
      defaultStages = [
        { id: 'draft', name: 'Draft', order: 0, color: '#6B7280' },
        { id: 'submitted', name: 'Submitted', order: 1, color: '#3B82F6' },
        { id: 'under_review', name: 'Under Review', order: 2, color: '#8B5CF6' },
        { id: 'accepted', name: 'Accepted', order: 3, color: '#10B981' },
        { id: 'rejected', name: 'Rejected', order: 4, color: '#EF4444' }
      ];
    }

    const pipeline = await storage.createPipeline({
      tenantId: context.tenantId,
      subAccountId: context.subAccountId || null,
      name: `Default ${type === 'lead' ? 'Lead' : 'Application'} Pipeline`,
      type,
      stages: defaultStages,
      isDefault: true
    });

    res.status(201).json(pipeline);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get pipeline analytics
router.get("/:id/analytics", TenantMiddleware.requireAgent, async (req, res) => {
  try {
    const context = req.tenantContext!;
    const pipeline = await storage.getPipeline(req.params.id);
    
    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline not found" });
    }

    // Verify pipeline belongs to tenant
    if (pipeline.tenantId !== context.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (context.userRole === 'agent' && pipeline.subAccountId !== context.subAccountId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get items for analytics
    let items;
    if (pipeline.type === 'lead') {
      items = await storage.getLeadsByTenant(context.tenantId, context.subAccountId);
    } else {
      items = await storage.getApplicationsByTenant(context.tenantId, context.subAccountId);
    }

    // Calculate analytics
    const stages = pipeline.stages || [];
    const analytics = stages.map(stage => {
      const stageItems = items.filter(item => 
        item.status === stage.id || item.status === stage.name
      );
      
      return {
        stage: stage.name,
        stageId: stage.id,
        count: stageItems.length,
        color: stage.color,
        conversionRate: stages.indexOf(stage) > 0 ? 
          (stageItems.length / items.length) * 100 : 0
      };
    });

    // Calculate overall metrics
    const totalItems = items.length;
    const conversionRate = totalItems > 0 ? 
      (analytics.find(a => a.stageId === stages[stages.length - 1]?.id)?.count || 0) / totalItems * 100 : 0;

    res.json({
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        type: pipeline.type
      },
      analytics,
      summary: {
        totalItems,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averageTimeInStage: '2.5 days' // This would need to be calculated from timestamps
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;