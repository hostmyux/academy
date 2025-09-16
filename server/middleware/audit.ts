import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface AuditLogData {
  userId: string;
  tenantId: string;
  subAccountId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure';
  errorMessage?: string;
}

export class AuditMiddleware {
  /**
   * Log user actions for audit trail
   */
  static async logAction(data: AuditLogData) {
    try {
      await db.insert(schema.auditLogs).values({
        userId: data.userId,
        tenantId: data.tenantId,
        subAccountId: data.subAccountId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        result: data.result,
        errorMessage: data.errorMessage,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Failed to log audit action:', error);
    }
  }

  /**
   * Middleware to automatically log API requests
   */
  static auditRequest(req: Request, res: Response, next: NextFunction) {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the request after response is sent
      setImmediate(() => {
        if (req.tenantContext && !AuditMiddleware.isExcludedRoute(req.path)) {
          AuditMiddleware.logAction({
            userId: req.tenantContext.userId,
            tenantId: req.tenantContext.tenantId,
            subAccountId: req.tenantContext.subAccountId,
            action: req.method,
            resource: req.path,
            details: {
              body: req.body,
              query: req.query,
              params: req.params
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            result: res.statusCode < 400 ? 'success' : 'failure',
            errorMessage: res.statusCode >= 400 ? data : undefined
          });
        }
      });
      
      return originalSend.call(this, data);
    };

    next();
  }

  /**
   * Middleware to log sensitive operations
   */
  static auditSensitiveOperation(action: string, resource: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalEnd = res.end;
      
      res.end = function(chunk?: any, encoding?: any) {
        setImmediate(() => {
          if (req.tenantContext) {
            AuditMiddleware.logAction({
              userId: req.tenantContext.userId,
              tenantId: req.tenantContext.tenantId,
              subAccountId: req.tenantContext.subAccountId,
              action: action,
              resource: resource,
              resourceId: req.params.id,
              details: {
                body: req.body,
                method: req.method
              },
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              result: res.statusCode < 400 ? 'success' : 'failure'
            });
          }
        });
        
        return originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Get audit logs for a tenant
   */
  static async getTenantAuditLogs(tenantId: string, options: {
    limit?: number;
    offset?: number;
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}) {
    try {
      let query = db
        .select()
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.tenantId, tenantId));

      // Apply filters
      if (options.userId) {
        query = query.where(eq(schema.auditLogs.userId, options.userId));
      }
      
      if (options.action) {
        query = query.where(eq(schema.auditLogs.action, options.action));
      }
      
      if (options.resource) {
        query = query.where(eq(schema.auditLogs.resource, options.resource));
      }
      
      if (options.startDate) {
        query = query.where(schema.auditLogs.createdAt >= options.startDate);
      }
      
      if (options.endDate) {
        query = query.where(schema.auditLogs.createdAt <= options.endDate);
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      if (options.offset) {
        query = query.offset(options.offset);
      }

      return await query;
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return [];
    }
  }

  /**
   * Check if route should be excluded from audit logging
   */
  private static isExcludedRoute(path: string): boolean {
    const excludedRoutes = [
      '/api/health',
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/register',
      '/favicon.ico',
      '/static',
      '/assets'
    ];

    return excludedRoutes.some(route => path.startsWith(route));
  }

  /**
   * Log security events
   */
  static async logSecurityEvent(event: {
    type: 'login_attempt' | 'login_failure' | 'unauthorized_access' | 'suspicious_activity';
    userId?: string;
    tenantId?: string;
    ipAddress: string;
    userAgent?: string;
    details: any;
  }) {
    try {
      await db.insert(schema.securityLogs).values({
        type: event.type,
        userId: event.userId,
        tenantId: event.tenantId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        details: event.details,
        severity: event.type === 'suspicious_activity' ? 'high' : 'medium',
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}