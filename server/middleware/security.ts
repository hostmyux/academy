import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { activities } from '@shared/schema';

export interface AuditLog {
  id: string;
  userId: string;
  tenantId: string;
  subAccountId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export class SecurityMiddleware {
  /**
   * Request validation and sanitization middleware
   */
  static validateRequest(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate content type
      if (req.body && Object.keys(req.body).length > 0) {
        if (!req.is('application/json') && !req.is('application/x-www-form-urlencoded')) {
          return res.status(415).json({ message: 'Unsupported media type' });
        }
      }

      // Sanitize input
      if (req.body) {
        this.sanitizeObject(req.body);
      }

      // Validate query parameters
      if (req.query) {
        this.sanitizeObject(req.query);
      }

      next();
    } catch (error) {
      console.error('Request validation error:', error);
      res.status(400).json({ message: 'Invalid request' });
    }
  }

  /**
   * Rate limiting middleware (simplified implementation)
   */
  private static rateLimits = new Map<string, { count: number; resetTime: number }>();

  static rateLimit(req: Request, res: Response, next: NextFunction) {
    try {
      const clientId = this.getClientId(req);
      const now = Date.now();
      const windowMs = 15 * 60 * 1000; // 15 minutes
      const maxRequests = 100; // Limit each IP to 100 requests per window

      let rateLimit = this.rateLimits.get(clientId);
      
      if (!rateLimit || now > rateLimit.resetTime) {
        // Reset window
        rateLimit = {
          count: 1,
          resetTime: now + windowMs
        };
        this.rateLimits.set(clientId, rateLimit);
      } else {
        rateLimit.count++;
        if (rateLimit.count > maxRequests) {
          return res.status(429).json({ 
            message: 'Too many requests',
            retryAfter: Math.ceil((rateLimit.resetTime - now) / 1000)
          });
        }
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - rateLimit.count).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetTime / 1000).toString());

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      next(); // Fail open   * Audit logging middleware
   */

    }
  }

  /**
  static async auditLog(req: Request, res: Response, next: NextFunction) {
    const originalSend = res.send;
    const startTime = Date.now();

    res.send = function(data: any) {
      const responseTime = Date.now() - startTime;
      
      // Log the request asynchronously
      setImmediate(async () => {
        try {
          await SecurityMiddleware.logAuditTrail(req, res, data, responseTime);
        } catch (error) {
          console.error('Audit logging error:', error);
        }
      });

      return originalSend.call(this, data);
    };

    next();
  }

  /**
   * Security headers middleware
   */
  static securityHeaders(req: Request, res: Response, next: NextFunction) {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss:; frame-ancestors 'none';");
    
    // Remove sensitive headers
    res.removeHeader('X-Powered-By');
    
    next();
  }

  /**
   * Data encryption utilities
   */
  static encryptData(data: string, key: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, key);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Encryption failed');
    }
  }

  static decryptData(encryptedData: string, key: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipher(algorithm, key);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Input sanitization
   */
  private static sanitizeObject(obj: any): void {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potential XSS characters
        obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        obj[key] = obj[key].replace(/javascript:/gi, '');
        obj[key] = obj[key].replace(/on\w+\s*=/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeObject(obj[key]);
      }
    }
  }

  /**
   * Get client identifier for rate limiting
   */
  private static getClientId(req: Request): string {
    // Use IP address as client identifier
    const ip = req.headers['x-forwarded-for'] || 
                req.headers['x-real-ip'] || 
                req.connection.remoteAddress || 
                req.socket.remoteAddress || 
                'unknown';
    
    return Array.isArray(ip) ? ip[0] : ip as string;
  }

  /**
   * Log audit trail
   */
  private static async logAuditTrail(req: Request, res: Response, responseData: any, responseTime: number): Promise<void> {
    try {
      const tenantContext = (req as any).tenantContext;
      const user = (req as any).user;

      if (!tenantContext || !user) return; // Skip logging for unauthenticated requests

      const auditLog: Omit<AuditLog, 'id'> = {
        userId: user.id,
        tenantId: tenantContext.tenantId,
        subAccountId: tenantContext.subAccountId,
        action: this.getActionFromMethod(req.method, req.path),
        resource: this.getResourceFromPath(req.path),
        resourceId: this.getResourceIdFromPath(req.path),
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: this.sanitizeForLogging(req.body),
          responseStatus: res.statusCode,
          responseTime,
          userAgent: req.headers['user-agent']
        },
        ipAddress: this.getClientId(req),
        userAgent: req.headers['user-agent'] || '',
        timestamp: new Date()
      };

      // Store audit log in database
      await db.insert(activities).values({
        tenantId: auditLog.tenantId,
        subAccountId: auditLog.subAccountId || null,
        userId: auditLog.userId,
        type: 'security_audit',
        description: `${auditLog.action} ${auditLog.resource}`,
        metadata: auditLog.details
      });

    } catch (error) {
      console.error('Failed to log audit trail:', error);
    }
  }

  /**
   * Get action from HTTP method and path
   */
  private static getActionFromMethod(method: string, path: string): string {
    const methodMap: { [key: string]: string } = {
      'GET': 'read',
      'POST': 'create',
      'PUT': 'update',
      'PATCH': 'update',
      'DELETE': 'delete'
    };

    const baseAction = methodMap[method] || method;
    
    if (path.includes('/auth/')) return 'authenticate';
    if (path.includes('/users/')) return `${baseAction}_user`;
    if (path.includes('/leads/')) return `${baseAction}_lead`;
    if (path.includes('/applications/')) return `${baseAction}_application`;
    if (path.includes('/universities/')) return `${baseAction}_university`;
    
    return baseAction;
  }

  /**
   * Get resource type from path
   */
  private static getResourceFromPath(path: string): string {
    if (path.includes('/users/')) return 'user';
    if (path.includes('/leads/')) return 'lead';
    if (path.includes('/applications/')) return 'application';
    if (path.includes('/universities/')) return 'university';
    if (path.includes('/sub-accounts/')) return 'sub_account';
    if (path.includes('/pipelines/')) return 'pipeline';
    if (path.includes('/documents/')) return 'document';
    if (path.includes('/payments/')) return 'payment';
    
    return 'system';
  }

  /**
   * Get resource ID from path
   */
  private static getResourceIdFromPath(path: string): string | undefined {
    const parts = path.split('/');
    const idIndex = parts.findIndex(part => part.length > 0 && part !== 'api');
    
    if (idIndex !== -1 && idIndex < parts.length - 1) {
      const potentialId = parts[idIndex + 1];
      // Check if it looks like a UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(potentialId)) {
        return potentialId;
      }
    }
    
    return undefined;
  }

  /**
   * Sanitize data for logging (remove sensitive information)
   */
  private static sanitizeForLogging(data: any): any {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credit_card', 'ssn'];
    
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized: any = Array.isArray(data) ? [] : {};
    
    for (const key in data) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        sanitized[key] = this.sanitizeForLogging(data[key]);
      } else {
        sanitized[key] = data[key];
      }
    }
    
    return sanitized;
  }
}