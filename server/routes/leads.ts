import { Router } from "express";
import { TenantMiddleware } from "../middleware/tenant";
import { storage } from "../storage";
import { aiService } from "../services/aiService";
import type { InsertLead } from "@shared/schema";
import { eq, and, or, ilike } from "drizzle-orm";

const router = Router();

// Get all leads with filtering and search
router.get("/", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const {
      search,
      status,
      source,
      assignedAgentId,
      page = "1",
      limit = "20",
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    let leads = await storage.getLeadsByTenant(tenantContext.tenantId, tenantContext.subAccountId);

    // Apply filters
    if (search) {
      leads = await storage.searchLeads(tenantContext.tenantId, search as string, tenantContext.subAccountId);
    }

    // Apply additional filters
    if (status) {
      leads = leads.filter(lead => lead.status === status);
    }

    if (source) {
      leads = leads.filter(lead => lead.source === source);
    }

    if (assignedAgentId) {
      leads = leads.filter(lead => lead.assignedAgentId === assignedAgentId);
    }

    // Apply sorting
    leads.sort((a, b) => {
      const aValue = a[sortBy as keyof typeof a];
      const bValue = b[sortBy as keyof typeof b];
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const paginatedLeads = leads.slice(offset, offset + parseInt(limit as string));

    res.json({
      leads: paginatedLeads,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: leads.length,
        totalPages: Math.ceil(leads.length / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create new lead with validation and duplicate detection
router.post("/", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const leadData = InsertLead.parse(req.body);

    // Check for duplicate leads
    const existingLeads = await storage.getLeadsByTenant(tenantContext.tenantId, tenantContext.subAccountId);
    const duplicateLead = existingLeads.find(lead => 
      lead.email.toLowerCase() === leadData.email.toLowerCase() &&
      lead.firstName.toLowerCase() === leadData.firstName.toLowerCase() &&
      lead.lastName.toLowerCase() === leadData.lastName.toLowerCase()
    );

    if (duplicateLead) {
      return res.status(409).json({ 
        message: "Duplicate lead detected",
        duplicateLeadId: duplicateLead.id 
      });
    }

    // Create lead with tenant context
    const lead = await storage.createLead({
      ...leadData,
      tenantId: tenantContext.tenantId,
      subAccountId: tenantContext.subAccountId || null,
      assignedAgentId: req.body.assignedAgentId || tenantContext.userId
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
      tenantId: tenantContext.tenantId,
      subAccountId: tenantContext.subAccountId || null,
      userId: tenantContext.userId,
      leadId: lead.id,
      type: "lead_added",
      description: `New lead added: ${lead.firstName} ${lead.lastName} from ${lead.source || 'Unknown source'}`
    });

    res.status(201).json(lead);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// Get specific lead
router.get("/:id", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const lead = await storage.getLead(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check access permissions
    const tenantContext = req.tenantContext!;
    if (lead.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }
    if (tenantContext.userRole === 'agent' && lead.subAccountId !== tenantContext.subAccountId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Update lead
router.put("/:id", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const lead = await storage.getLead(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check access permissions
    const tenantContext = req.tenantContext!;
    if (lead.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updates = InsertLead.partial().parse(req.body);
    const updatedLead = await storage.updateLead(req.params.id, updates);

    // Log status change
    if (updates.status && updates.status !== lead.status) {
      await storage.createActivity({
        tenantId: tenantContext.tenantId,
        subAccountId: tenantContext.subAccountId || null,
        userId: tenantContext.userId,
        leadId: lead.id,
        type: "status_changed",
        description: `Lead status changed from ${lead.status} to ${updates.status}`
      });
    }

    res.json(updatedLead);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// Delete lead (soft delete)
router.delete("/:id", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const lead = await storage.getLead(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check access permissions
    const tenantContext = req.tenantContext!;
    if (lead.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Soft delete by marking as inactive or moving to a 'deleted' status
    await storage.updateLead(req.params.id, { 
      status: "unqualified" // Or create a 'deleted' status
    });

    res.json({ message: "Lead deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk operations on leads
router.post("/bulk", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const { operation, leadIds, data } = req.body;

    if (!operation || !leadIds || !Array.isArray(leadIds)) {
      return res.status(400).json({ message: "Invalid bulk operation parameters" });
    }

    const results = [];

    for (const leadId of leadIds) {
      try {
        const lead = await storage.getLead(leadId);
        if (!lead || lead.tenantId !== tenantContext.tenantId) {
          results.push({ leadId, success: false, error: "Lead not found or access denied" });
          continue;
        }

        switch (operation) {
          case 'update':
            const updatedLead = await storage.updateLead(leadId, data);
            results.push({ leadId, success: true, lead: updatedLead });
            break;
          case 'assign':
            const assignedLead = await storage.updateLead(leadId, { assignedAgentId: data.agentId });
            results.push({ leadId, success: true, lead: assignedLead });
            break;
          case 'delete':
            await storage.updateLead(leadId, { status: "unqualified" });
            results.push({ leadId, success: true });
            break;
          default:
            results.push({ leadId, success: false, error: "Unknown operation" });
        }
      } catch (error) {
        results.push({ leadId, success: false, error: (error as Error).message });
      }
    }

    res.json({ results });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// Get lead statistics
router.get("/stats/overview", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const stats = await storage.getLeadStats(tenantContext.tenantId, tenantContext.subAccountId);
    
    // Get additional statistics
    const leads = await storage.getLeadsByTenant(tenantContext.tenantId, tenantContext.subAccountId);
    
    const sourceStats = leads.reduce((acc, lead) => {
      const source = lead.source || 'Unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const monthlyStats = leads.reduce((acc, lead) => {
      const month = new Date(lead.createdAt).toISOString().slice(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      ...stats,
      sourceDistribution: sourceStats,
      monthlyTrends: monthlyStats,
      totalLeads: leads.length
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Import leads from CSV/Excel
router.post("/import", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const { leads: importedLeads } = req.body;

    if (!importedLeads || !Array.isArray(importedLeads)) {
      return res.status(400).json({ message: "Invalid import data" });
    }

    const results = {
      successful: 0,
      failed: 0,
      duplicates: 0,
      errors: [] as string[]
    };

    const existingLeads = await storage.getLeadsByTenant(tenantContext.tenantId, tenantContext.subAccountId);

    for (const leadData of importedLeads) {
      try {
        // Check for duplicates
        const duplicate = existingLeads.find(lead => 
          lead.email.toLowerCase() === leadData.email.toLowerCase() &&
          lead.firstName.toLowerCase() === leadData.firstName.toLowerCase() &&
          lead.lastName.toLowerCase() === leadData.lastName.toLowerCase()
        );

        if (duplicate) {
          results.duplicates++;
          continue;
        }

        // Validate required fields
        if (!leadData.email || !leadData.firstName || !leadData.lastName) {
          results.failed++;
          results.errors.push(`Missing required fields for ${leadData.firstName || 'Unknown'}`);
          continue;
        }

        const lead = await storage.createLead({
          ...leadData,
          tenantId: tenantContext.tenantId,
          subAccountId: tenantContext.subAccountId || null,
          assignedAgentId: tenantContext.userId
        });

        // AI scoring
        try {
          const score = await aiService.scoreLead(lead);
          await storage.updateLead(lead.id, { score });
        } catch (error) {
          console.error('Error scoring lead:', error);
        }

        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Error importing ${leadData.firstName || 'Unknown'}: ${(error as Error).message}`);
      }
    }

    res.json(results);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;