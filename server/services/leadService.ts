import { storage } from '../storage';
import type { Lead, InsertLead } from '@shared/schema';
import { eq, ilike, or, and, desc } from 'drizzle-orm';
import { leads } from '@shared/schema';

export class LeadService {
  /**
   * Advanced lead creation with duplicate detection
   */
  async createLeadWithValidation(leadData: InsertLead, tenantContext: any): Promise<Lead> {
    // Check for duplicates before creating
    const duplicates = await this.findDuplicateLeads(leadData, tenantContext.tenantId);
    
    if (duplicates.length > 0) {
      throw new Error(`Duplicate lead found. Similar leads already exist: ${duplicates.map(d => `${d.firstName} ${d.lastName}`).join(', ')}`);
    }

    // Create the lead with enhanced data
    const enhancedLeadData = {
      ...leadData,
      tenantId: tenantContext.tenantId,
      subAccountId: tenantContext.subAccountId || null,
      engagementHistory: [{
        type: 'lead_created',
        date: new Date().toISOString(),
        details: 'Lead created in system',
        source: leadData.source || 'manual'
      }]
    };

    const lead = await storage.createLead(enhancedLeadData);
    
    // Enrich lead data
    await this.enrichLeadData(lead);
    
    return lead;
  }

  /**
   * Find duplicate leads based on various criteria
   */
  async findDuplicateLeads(leadData: InsertLead, tenantId: string): Promise<Lead[]> {
    const conditions = [
      eq(leads.tenantId, tenantId),
      or(
        // Exact email match
        and(
          eq(leads.email, leadData.email),
          eq(leads.firstName, leadData.firstName),
          eq(leads.lastName, leadData.lastName)
        ),
        // Phone match
        leadData.phone ? eq(leads.phone, leadData.phone) : undefined,
        // Name similarity with email
        and(
          ilike(leads.firstName, leadData.firstName),
          ilike(leads.lastName, leadData.lastName),
          ilike(leads.email, `%${leadData.email.split('@')[0]}%`)
        )
      ).filter(Boolean)
    ];

    const duplicates = await storage.getLeadsByTenant(tenantId);
    
    return duplicates.filter(lead => {
      // Check each condition
      return conditions.some(condition => {
        try {
          return condition(lead);
        } catch {
          return false;
        }
      });
    });
  }

  /**
   * Enrich lead data with additional information
   */
  async enrichLeadData(lead: Lead): Promise<void> {
    try {
      // Add location-based enrichment
      if (lead.email) {
        const domain = lead.email.split('@')[1];
        // Could add logic to determine organization type from email domain
      }

      // Add score-based enrichment
      if (!lead.score || lead.score === 0) {
        const calculatedScore = this.calculateLeadScore(lead);
        await storage.updateLead(lead.id, { score: calculatedScore });
      }

      // Add source categorization
      if (lead.source) {
        const sourceCategory = this.categorizeSource(lead.source);
        // Could store this in a custom field
      }
    } catch (error) {
      console.error('Error enriching lead data:', error);
    }
  }

  /**
   * Calculate lead score based on various factors
   */
  calculateLeadScore(lead: Lead): number {
    let score = 50; // Base score

    // Email quality (professional domains)
    if (lead.email) {
      const professionalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      const domain = lead.email.split('@')[1];
      if (!professionalDomains.includes(domain)) {
        score += 15; // Professional email domain
      }
    }

    // Phone number presence
    if (lead.phone) {
      score += 10;
    }

    // Program interest specificity
    if (lead.programInterest && lead.programInterest.length > 10) {
      score += 10;
    }

    // Target country specificity
    if (lead.targetCountry) {
      score += 10;
    }

    // Budget information
    if (lead.budget && Number(lead.budget) > 0) {
      score += 15;
    }

    // Source quality
    if (lead.source) {
      const highQualitySources = ['referral', 'website', 'linkedin'];
      if (highQualitySources.some(source => lead.source?.toLowerCase().includes(source))) {
        score += 10;
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Categorize lead source
   */
  categorizeSource(source: string): string {
    const sourceLower = source.toLowerCase();
    
    if (sourceLower.includes('web') || sourceLower.includes('site')) {
      return 'website';
    } else if (sourceLower.includes('referral')) {
      return 'referral';
    } else if (sourceLower.includes('social') || sourceLower.includes('facebook') || sourceLower.includes('linkedin')) {
      return 'social_media';
    } else if (sourceLower.includes('email') || sourceLower.includes('newsletter')) {
      return 'email';
    } else if (sourceLower.includes('event') || sourceLower.includes('webinar')) {
      return 'event';
    } else if (sourceLower.includes('search') || sourceLower.includes('google')) {
      return 'search_engine';
    } else {
      return 'other';
    }
  }

  /**
   * Advanced lead search with multiple filters
   */
  async searchLeadsAdvanced(
    tenantId: string,
    subAccountId: string | undefined,
    filters: {
      search?: string;
      status?: string[];
      source?: string[];
      scoreRange?: [number, number];
      dateRange?: [Date, Date];
      assignedAgentId?: string;
      programInterest?: string[];
      targetCountry?: string[];
    }
  ): Promise<Lead[]> {
    let leads = await storage.getLeadsByTenant(tenantId, subAccountId);

    // Apply filters
    leads = leads.filter(lead => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableText = `${lead.firstName} ${lead.lastName} ${lead.email} ${lead.programInterest || ''}`.toLowerCase();
        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      // Status filter
      if (filters.status && filters.status.length > 0) {
        if (!filters.status.includes(lead.status || '')) {
          return false;
        }
      }

      // Source filter
      if (filters.source && filters.source.length > 0) {
        if (!filters.source.some(source => lead.source?.toLowerCase().includes(source.toLowerCase()))) {
          return false;
        }
      }

      // Score range filter
      if (filters.scoreRange) {
        const [minScore, maxScore] = filters.scoreRange;
        if (lead.score < minScore || lead.score > maxScore) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateRange) {
        const [startDate, endDate] = filters.dateRange;
        const leadDate = new Date(lead.createdAt);
        if (leadDate < startDate || leadDate > endDate) {
          return false;
        }
      }

      // Assigned agent filter
      if (filters.assignedAgentId) {
        if (lead.assignedAgentId !== filters.assignedAgentId) {
          return false;
        }
      }

      // Program interest filter
      if (filters.programInterest && filters.programInterest.length > 0) {
        if (!filters.programInterest.some(interest => 
          lead.programInterest?.toLowerCase().includes(interest.toLowerCase())
        )) {
          return false;
        }
      }

      // Target country filter
      if (filters.targetCountry && filters.targetCountry.length > 0) {
        if (!filters.targetCountry.some(country => 
          lead.targetCountry?.toLowerCase().includes(country.toLowerCase())
        )) {
          return false;
        }
      }

      return true;
    });

    // Sort by creation date (newest first)
    return leads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get lead analytics
   */
  async getLeadAnalytics(tenantId: string, subAccountId: string | undefined) {
    const leads = await storage.getLeadsByTenant(tenantId, subAccountId);
    
    const analytics = {
      total: leads.length,
      byStatus: this.groupByStatus(leads),
      bySource: this.groupBySource(leads),
      byScore: this.groupByScore(leads),
      byMonth: this.groupByMonth(leads),
      conversionRates: this.calculateConversionRates(leads),
      topSources: this.getTopSources(leads),
      averageScore: leads.reduce((sum, lead) => sum + (lead.score || 0), 0) / leads.length || 0
    };

    return analytics;
  }

  private groupByStatus(leads: Lead[]) {
    return leads.reduce((acc, lead) => {
      const status = lead.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupBySource(leads: Lead[]) {
    return leads.reduce((acc, lead) => {
      const source = this.categorizeSource(lead.source || 'unknown');
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupByScore(leads: Lead[]) {
    const ranges = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0
    };

    leads.forEach(lead => {
      const score = lead.score || 0;
      if (score <= 20) ranges['0-20']++;
      else if (score <= 40) ranges['21-40']++;
      else if (score <= 60) ranges['41-60']++;
      else if (score <= 80) ranges['61-80']++;
      else ranges['81-100']++;
    });

    return ranges;
  }

  private groupByMonth(leads: Lead[]) {
    return leads.reduce((acc, lead) => {
      const month = new Date(lead.createdAt).toISOString().substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateConversionRates(leads: Lead[]) {
    const total = leads.length;
    if (total === 0) return { overall: 0, byStatus: {} };

    const converted = leads.filter(lead => lead.status === 'converted').length;
    const qualified = leads.filter(lead => lead.status === 'qualified').length;
    const contacted = leads.filter(lead => lead.status === 'contacted').length;

    return {
      overall: total > 0 ? (converted / total) * 100 : 0,
      byStatus: {
        conversionRate: qualified > 0 ? (converted / qualified) * 100 : 0,
        qualificationRate: contacted > 0 ? (qualified / contacted) * 100 : 0,
        contactRate: total > 0 ? (contacted / total) * 100 : 0
      }
    };
  }

  private getTopSources(leads: Lead[]) {
    const sourceCounts = this.groupBySource(leads);
    return Object.entries(sourceCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([source, count]) => ({ source, count }));
  }
}

export const leadService = new LeadService();