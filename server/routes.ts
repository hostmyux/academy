import type { Express } from "express";
import { createServer, type Server } from "http";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { storage } from "./storage";
import { aiService } from "./services/aiService";
import { universityService } from "./services/universityService";
import { stripeService } from "./services/stripeService";
import { insertUserSchema, insertLeadSchema, insertApplicationSchema } from "@shared/schema";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        
        // Update last login
        await storage.updateUser(user.id, { lastLoginAt: new Date() });
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (error) {
      done(error);
    }
  });

  // Auth routes
  app.post("/api/register", async (req, res, next) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // For first user, create a tenant
      let tenantId = userData.tenantId;
      if (!tenantId) {
        const tenant = await storage.createTenant({
          name: `${userData.firstName}'s Organization`,
          domain: userData.email.split('@')[1],
          branding: {},
          settings: { allowSubAccounts: true, maxSubAccounts: 10 },
        });
        tenantId = tenant.id;
      }

      const user = await storage.createUser({
        ...userData,
        tenantId,
        password: await hashPassword(userData.password),
        role: userData.role || 'tenant_admin',
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({ ...user, password: undefined });
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.json({ ...req.user, password: undefined });
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.sendStatus(401);
    }
    res.json({ ...req.user, password: undefined });
  });
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId;
      const subAccountId = user.role === 'agent' ? user.subAccountId : undefined;

      const [leadStats, appStats, revenueStats] = await Promise.all([
        storage.getLeadStats(tenantId, subAccountId),
        storage.getApplicationStats(tenantId, subAccountId),
        storage.getRevenueStats(tenantId, subAccountId),
      ]);

      res.json({
        leads: leadStats,
        applications: appStats,
        revenue: revenueStats,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Recent activities
  app.get("/api/dashboard/activities", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId;
      const subAccountId = user.role === 'agent' ? user.subAccountId : undefined;
      const limit = parseInt(req.query.limit as string) || 10;

      const activities = await storage.getActivitiesByTenant(tenantId, subAccountId, limit);
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Leads management
  app.get("/api/leads", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId;
      const subAccountId = user.role === 'agent' ? user.subAccountId : undefined;
      const search = req.query.search as string;

      let leads;
      if (search) {
        leads = await storage.searchLeads(tenantId, search, subAccountId);
      } else {
        leads = await storage.getLeadsByTenant(tenantId, subAccountId);
      }

      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/leads", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const leadData = insertLeadSchema.parse(req.body);

      const lead = await storage.createLead({
        ...leadData,
        tenantId: user.tenantId,
        subAccountId: user.subAccountId || null,
        assignedAgentId: user.id,
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
        tenantId: user.tenantId,
        subAccountId: user.subAccountId || null,
        userId: user.id,
        leadId: lead.id,
        type: "lead_added",
        description: `New lead added: ${lead.firstName} ${lead.lastName}`,
      });

      res.status(201).json(lead);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Check access permissions
      const user = req.user as any;
      if (lead.tenantId !== user.tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (user.role === 'agent' && lead.subAccountId !== user.subAccountId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(lead);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Check access permissions
      const user = req.user as any;
      if (lead.tenantId !== user.tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updates = insertLeadSchema.partial().parse(req.body);
      const updatedLead = await storage.updateLead(req.params.id, updates);

      res.json(updatedLead);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // AI endpoints
  app.post("/api/ai/recommend-programs", requireAuth, async (req, res) => {
    try {
      const { leadId } = req.body;
      
      const lead = await storage.getLead(leadId);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      const [programs, universities] = await Promise.all([
        universityService.searchPrograms(),
        universityService.searchUniversities(),
      ]);

      const recommendations = await aiService.recommendPrograms(lead, programs, universities);
      res.json(recommendations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai/generate-email", requireAuth, async (req, res) => {
    try {
      const { type, context } = req.body;
      const template = await aiService.generateEmailTemplate(type, context);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Universities and programs
  app.get("/api/universities", requireAuth, async (req, res) => {
    try {
      const search = req.query.search as string;
      const country = req.query.country as string;
      
      const universities = await universityService.searchUniversities(search, country);
      res.json(universities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/programs", requireAuth, async (req, res) => {
    try {
      const query = req.query.search as string;
      const degreeType = req.query.degreeType as string;
      const field = req.query.field as string;
      const universityId = req.query.universityId as string;
      
      const programs = await universityService.searchPrograms(query, degreeType, field, universityId);
      res.json(programs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/universities/sync", requireAuth, requireRole(['tenant_admin']), async (req, res) => {
    try {
      await universityService.scheduleDataSync();
      res.json({ message: "University data sync initiated" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Applications
  app.get("/api/applications", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId;
      const subAccountId = user.role === 'agent' ? user.subAccountId : undefined;

      const applications = await storage.getApplicationsByTenant(tenantId, subAccountId);
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/applications", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const applicationData = insertApplicationSchema.parse(req.body);

      const application = await storage.createApplication({
        ...applicationData,
        tenantId: user.tenantId,
        subAccountId: user.subAccountId || null,
        assignedAgentId: user.id,
      });

      // Create activity
      await storage.createActivity({
        tenantId: user.tenantId,
        subAccountId: user.subAccountId || null,
        userId: user.id,
        applicationId: application.id,
        type: "application_submitted",
        description: `New application created`,
      });

      res.status(201).json(application);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Stripe payment routes
  app.post("/api/payments/create-intent", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { amount, currency = "USD", leadId, applicationId } = req.body;

      // Get or create Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user);
        customerId = customer.id;
      }

      const paymentIntent = await stripeService.createPaymentIntent(
        amount,
        currency,
        customerId,
        {
          tenantId: user.tenantId,
          subAccountId: user.subAccountId || '',
          leadId: leadId || '',
          applicationId: applicationId || '',
        }
      );

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/payments/webhook", async (req, res) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
      
      await stripeService.handleWebhook(
        req.body,
        signature,
        endpointSecret
      );
      
      res.sendStatus(200);
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  // Reports and analytics
  app.get("/api/reports/revenue", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId;
      const subAccountId = user.role === 'agent' ? user.subAccountId : undefined;

      const revenueStats = await storage.getRevenueStats(tenantId, subAccountId);
      res.json(revenueStats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Sub-accounts (for tenant admins)
  app.get("/api/sub-accounts", requireAuth, requireRole(['tenant_admin']), async (req, res) => {
    try {
      const user = req.user as any;
      const subAccounts = await storage.getSubAccountsByTenant(user.tenantId);
      res.json(subAccounts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sub-accounts", requireAuth, requireRole(['tenant_admin']), async (req, res) => {
    try {
      const user = req.user as any;
      const { name, description } = req.body;

      const subAccount = await storage.createSubAccount({
        tenantId: user.tenantId,
        name,
        description,
        settings: {},
      });

      res.status(201).json(subAccount);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
