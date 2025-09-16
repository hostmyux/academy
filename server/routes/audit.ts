import { Router } from 'express';
import AuditMiddleware from '../middleware/audit';
import TenantMiddleware from '../middleware/tenant';

const router = Router();

// Get audit logs (tenant admin only)
router.get('/', TenantMiddleware.requireTenantContext, TenantMiddleware.requireTenantAdmin, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const filters = {
      tenantId: tenantContext.tenantId,
      limit: parseInt(req.query.limit as string) || 100,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    };

    const auditLogs = AuditMiddleware.getAuditLogs(filters);
    res.json(auditLogs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get security events
router.get('/security', TenantMiddleware.requireTenantContext, TenantMiddleware.requireTenantAdmin, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const securityEvents = AuditMiddleware.getSecurityEvents()
      .filter(event => event.tenantId === tenantContext.tenantId);
    
    res.json(securityEvents);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get user activity summary
router.get('/user-activity/:userId', TenantMiddleware.requireTenantContext, TenantMiddleware.requireTenantAdmin, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const { userId } = req.params;

    // In a real implementation, you'd verify the user belongs to the tenant
    const activitySummary = AuditMiddleware.getUserActivitySummary(userId, tenantContext.tenantId);
    res.json(activitySummary);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get tenant audit statistics
router.get('/stats', TenantMiddleware.requireTenantContext, TenantMiddleware.requireTenantAdmin, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const auditLogs = AuditMiddleware.getAuditLogs({ tenantId: tenantContext.tenantId });
    
    const stats = {
      totalActions: auditLogs.length,
      uniqueUsers: [...new Set(auditLogs.map(log => log.userId))].length,
      uniqueResources: [...new Set(auditLogs.map(log => log.resource))].length,
      securityEvents: auditLogs.filter(log => log.statusCode >= 400).length,
      actionsByType: AuditMiddleware['groupByAction'](auditLogs),
      resourcesByAccess: AuditMiddleware['groupByResource'](auditLogs),
      recentActivity: auditLogs.slice(0, 10)
    };

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;