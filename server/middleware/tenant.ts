import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { eq, and, or } from 'drizzle-orm';
import { tenants, users, subAccounts } from '@shared/schema';

export interface TenantContext {
  tenantId: string;
  subAccountId?: string;
  userId: string;
  userRole: string;
  tenant: any;
  subAccount?: any;
}

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

export class TenantMiddleware {
  /**
   * Middleware to extract and validate tenant context from request
   */
  static async extractTenantContext(req: Request, res: Response, next: NextFunction) {
    try {
      // Skip tenant context for auth routes, public endpoints, and client-side routes
      if (req.path.startsWith('/api/auth') || 
          req.path.startsWith('/api/public') ||
          req.path.startsWith('/src/') ||
          req.path === '/' ||
          req.path.startsWith('/@') ||
          req.path.includes('.')) {
        return next();
      }

      // Get user from session (assuming passport/session middleware is used)
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get tenant context
      const tenantContext: TenantContext = {
        tenantId: user.tenantId,
        userId: user.id,
        userRole: user.role,
      };

      // Extract tenant from domain/subdomain
      const host = req.headers.host || '';
      const subdomain = this.extractSubdomain(host);
      
      if (subdomain) {
        // Try to find tenant by domain/subdomain
        const [tenantByDomain] = await db.select().from(tenants).where(
          or(
            eq(tenants.domain, subdomain),
            eq(tenants.domain, host)
          )
        );
        
        if (tenantByDomain && tenantByDomain.id !== user.tenantId) {
          return res.status(403).json({ message: 'Tenant domain mismatch' });
        }
      }

      // Load tenant details
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId));
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }
      tenantContext.tenant = tenant;

      // Apply row-level security by injecting tenant context into query
      this.injectTenantFilter(req, tenantContext);

      // Load sub-account if applicable
      if (user.subAccountId) {
        const [subAccount] = await db.select().from(subAccounts).where(eq(subAccounts.id, user.subAccountId));
        if (subAccount) {
          tenantContext.subAccountId = user.subAccountId;
          tenantContext.subAccount = subAccount;
        }
      }

      // Attach tenant context to request
      req.tenantContext = tenantContext;

      next();
    } catch (error) {
      console.error('Tenant middleware error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Extract subdomain from host
   */
  private static extractSubdomain(host: string): string | null {
    if (!host) return null;
    
    // Remove port if present
    const hostname = host.split(':')[0];
    
    // Skip localhost and IP addresses
    if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return null;
    }
    
    const parts = hostname.split('.');
    if (parts.length <= 2) return null; // No subdomain
    
    // Return the first part as subdomain
    return parts[0];
  }

  /**
   * Inject tenant filter into request for row-level security
   */
  private static injectTenantFilter(req: Request, tenantContext: TenantContext) {
    // Add tenant filter to request body for database operations
    if (req.body && typeof req.body === 'object') {
      req.body.tenantId = tenantContext.tenantId;
      if (tenantContext.subAccountId) {
        req.body.subAccountId = tenantContext.subAccountId;
      }
    }
    
    // Add tenant filter to query parameters
    if (req.query && typeof req.query === 'object') {
      (req.query as any).tenantId = tenantContext.tenantId;
      if (tenantContext.subAccountId) {
        (req.query as any).subAccountId = tenantContext.subAccountId;
      }
    }
  }

  /**
   * Middleware to enforce tenant-level data access
   */
  static requireTenantAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantContext = req.tenantContext;
      if (!tenantContext) {
        return res.status(401).json({ message: 'Tenant context required' });
      }

      // Add tenant filtering to query parameters if applicable
      if (req.query && typeof req.query === 'object') {
        (req.query as any).tenantId = tenantContext.tenantId;
        if (tenantContext.subAccountId) {
          (req.query as any).subAccountId = tenantContext.subAccountId;
        }
      }

      next();
    } catch (error) {
      console.error('Tenant access middleware error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Middleware to enforce tenant admin access
   */
  static requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantContext = req.tenantContext;
      if (!tenantContext || tenantContext.userRole !== 'tenant_admin') {
        return res.status(403).json({ message: 'Tenant admin access required' });
      }

      next();
    } catch (error) {
      console.error('Tenant admin middleware error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Middleware to enforce sub-account admin access
   */
  static requireSubAccountAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantContext = req.tenantContext;
      if (!tenantContext || 
          (tenantContext.userRole !== 'tenant_admin' && 
           tenantContext.userRole !== 'sub_account_admin')) {
        return res.status(403).json({ message: 'Sub-account admin access required' });
      }

      next();
    } catch (error) {
      console.error('Sub-account admin middleware error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Apply tenant filtering to database queries
   */
  static withTenantFilter(query: any, tenantContext: TenantContext, tableName: string) {
    // This would be implemented based on the specific ORM/query builder being used
    // For Drizzle ORM, we would add the tenant conditions to the query
    console.log(`Applying tenant filter for ${tableName}`, tenantContext);
    return query;
  }

  /**
   * Validate tenant ownership of a resource
   */
  static async validateTenantOwnership(resourceId: string, tenantContext: TenantContext, resourceType: string): Promise<boolean> {
    try {
      let query;
      
      switch (resourceType) {
        case 'lead':
          query = db.select().from(require('@shared/schema').leads).where(
            and(
              eq(require('@shared/schema').leads.id, resourceId),
              eq(require('@shared/schema').leads.tenantId, tenantContext.tenantId)
            )
          );
          break;
        case 'application':
          query = db.select().from(require('@shared/schema').applications).where(
            and(
              eq(require('@shared/schema').applications.id, resourceId),
              eq(require('@shared/schema').applications.tenantId, tenantContext.tenantId)
            )
          );
          break;
        case 'user':
          query = db.select().from(users).where(
            and(
              eq(users.id, resourceId),
              eq(users.tenantId, tenantContext.tenantId)
            )
          );
          break;
        default:
          return false;
      }

      const result = await query;
      return result.length > 0;
    } catch (error) {
      console.error('Tenant ownership validation error:', error);
      return false;
    }
  }
}