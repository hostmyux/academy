import {
  tenants, subAccounts, users, leads, universities, programs, applications,
  documents, payments, activities, pipelines, tasks,
  type Tenant, type InsertTenant,
  type SubAccount, type InsertSubAccount,
  type User, type InsertUser,
  type Lead, type InsertLead,
  type University, type InsertUniversity,
  type Program, type InsertProgram,
  type Application, type InsertApplication,
  type Document, type InsertDocument,
  type Payment, type InsertPayment,
  type Activity, type InsertActivity,
  type Pipeline, type InsertPipeline,
  type Task, type InsertTask,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, like, ilike, sql, count } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

// Mock storage for development when database is not available
class MockStorage implements IStorage {
  private mockData: any = {};
  sessionStore: any;

  constructor() {
    // Create a simple in-memory session store that implements the required interface
    this.sessionStore = {
      get: (sid: string, callback: any) => callback(null, null),
      set: (sid: string, session: any, callback: any) => callback(null),
      destroy: (sid: string, callback: any) => callback(null),
      on: (event: string, callback: any) => {
        // Mock the event listener interface
        console.log(`Session store event: ${event}`);
      },
      all: (callback: any) => callback(null, []),
      length: (callback: any) => callback(null, 0),
      clear: (callback: any) => callback(null),
      touch: (sid: string, session: any, callback: any) => callback(null),
    };
    
    // Initialize some mock data
    this.mockData.users = [];
    this.mockData.tenants = [];
    this.mockData.leads = [];
    this.mockData.applications = [];
    this.mockData.activities = [];
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.mockData.users.find((u: any) => u.id === id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.mockData.users.find((u: any) => u.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser = { ...user, id: `mock-${Date.now()}`, createdAt: new Date(), updatedAt: new Date() };
    this.mockData.users.push(newUser);
    return newUser;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const userIndex = this.mockData.users.findIndex((u: any) => u.id === id);
    if (userIndex !== -1) {
      this.mockData.users[userIndex] = { ...this.mockData.users[userIndex], ...updates, updatedAt: new Date() };
      return this.mockData.users[userIndex];
    }
    throw new Error('User not found');
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const newTenant = { ...tenant, id: `mock-${Date.now()}`, createdAt: new Date(), updatedAt: new Date() };
    this.mockData.tenants.push(newTenant);
    return newTenant;
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    return this.mockData.tenants.find((t: any) => t.id === id);
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const newLead = { ...lead, id: `mock-${Date.now()}`, createdAt: new Date(), updatedAt: new Date() };
    this.mockData.leads.push(newLead);
    return newLead;
  }

  async getLead(id: string): Promise<Lead | undefined> {
    return this.mockData.leads.find((l: any) => l.id === id);
  }

  async getLeadsByTenant(tenantId: string, subAccountId?: string): Promise<Lead[]> {
    return this.mockData.leads.filter((l: any) => l.tenantId === tenantId && (!subAccountId || l.subAccountId === subAccountId));
  }

  async createApplication(application: InsertApplication): Promise<Application> {
    const newApplication = { ...application, id: `mock-${Date.now()}`, createdAt: new Date(), updatedAt: new Date() };
    this.mockData.applications.push(newApplication);
    return newApplication;
  }

  async getApplicationsByTenant(tenantId: string, subAccountId?: string): Promise<Application[]> {
    return this.mockData.applications.filter((a: any) => a.tenantId === tenantId && (!subAccountId || a.subAccountId === subAccountId));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const newActivity = { ...activity, id: `mock-${Date.now()}`, createdAt: new Date() };
    this.mockData.activities.push(newActivity);
    return newActivity;
  }

  async getActivitiesByTenant(tenantId: string, subAccountId?: string, limit?: number): Promise<Activity[]> {
    let activities = this.mockData.activities.filter((a: any) => a.tenantId === tenantId && (!subAccountId || a.subAccountId === subAccountId));
    if (limit) {
      activities = activities.slice(0, limit);
    }
    return activities;
  }

  async getLeadStats(tenantId: string, subAccountId?: string): Promise<any> {
    return { total: 5, new: 2, contacted: 1, qualified: 1, converted: 1 };
  }

  async getApplicationStats(tenantId: string, subAccountId?: string): Promise<any> {
    return { total: 3, draft: 1, submitted: 1, underReview: 1, accepted: 0, rejected: 0 };
  }

  async getRevenueStats(tenantId: string, subAccountId?: string): Promise<any> {
    return { total: 5000, thisMonth: 2000, lastMonth: 1500, pending: 500 };
  }

  // Mock implementations for remaining methods
  async updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant> {
    throw new Error('Not implemented in mock storage');
  }

  async getSubAccount(id: string): Promise<SubAccount | undefined> {
    throw new Error('Not implemented in mock storage');
  }

  async getSubAccountsByTenant(tenantId: string): Promise<SubAccount[]> {
    return [];
  }

  async createSubAccount(subAccount: InsertSubAccount): Promise<SubAccount> {
    throw new Error('Not implemented in mock storage');
  }

  async updateSubAccount(id: string, updates: Partial<InsertSubAccount>): Promise<SubAccount> {
    throw new Error('Not implemented in mock storage');
  }

  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return this.mockData.users.filter((u: any) => u.tenantId === tenantId);
  }

  async getUsersBySubAccount(subAccountId: string): Promise<User[]> {
    return [];
  }

  async updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId?: string): Promise<User> {
    throw new Error('Not implemented in mock storage');
  }

  async updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead> {
    throw new Error('Not implemented in mock storage');
  }

  async searchLeads(tenantId: string, query: string, subAccountId?: string): Promise<Lead[]> {
    return [];
  }

  async getUniversity(id: string): Promise<University | undefined> {
    throw new Error('Not implemented in mock storage');
  }

  async getUniversities(search?: string, country?: string): Promise<University[]> {
    return [];
  }

  async createUniversity(university: InsertUniversity): Promise<University> {
    throw new Error('Not implemented in mock storage');
  }

  async updateUniversity(id: string, updates: Partial<InsertUniversity>): Promise<University> {
    throw new Error('Not implemented in mock storage');
  }

  async getProgram(id: string): Promise<Program | undefined> {
    throw new Error('Not implemented in mock storage');
  }

  async getProgramsByUniversity(universityId: string): Promise<Program[]> {
    return [];
  }

  async searchPrograms(query?: string, degreeType?: string, field?: string): Promise<Program[]> {
    return [];
  }

  async createProgram(program: InsertProgram): Promise<Program> {
    throw new Error('Not implemented in mock storage');
  }

  async updateProgram(id: string, updates: Partial<InsertProgram>): Promise<Program> {
    throw new Error('Not implemented in mock storage');
  }

  async getApplication(id: string): Promise<Application | undefined> {
    throw new Error('Not implemented in mock storage');
  }

  async getApplicationsByLead(leadId: string): Promise<Application[]> {
    return [];
  }

  async updateApplication(id: string, updates: Partial<InsertApplication>): Promise<Application> {
    throw new Error('Not implemented in mock storage');
  }

  async getDocument(id: string): Promise<Document | undefined> {
    throw new Error('Not implemented in mock storage');
  }

  async getDocumentsByLead(leadId: string): Promise<Document[]> {
    return [];
  }

  async getDocumentsByApplication(applicationId: string): Promise<Document[]> {
    return [];
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    throw new Error('Not implemented in mock storage');
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document> {
    throw new Error('Not implemented in mock storage');
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    throw new Error('Not implemented in mock storage');
  }

  async getPaymentsByTenant(tenantId: string, subAccountId?: string): Promise<Payment[]> {
    return [];
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    throw new Error('Not implemented in mock storage');
  }

  async updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment> {
    throw new Error('Not implemented in mock storage');
  }

  async getPipelinesByTenant(tenantId: string, subAccountId?: string): Promise<Pipeline[]> {
    return [];
  }

  async createPipeline(pipeline: InsertPipeline): Promise<Pipeline> {
    throw new Error('Not implemented in mock storage');
  }

  async updatePipeline(id: string, updates: Partial<InsertPipeline>): Promise<Pipeline> {
    throw new Error('Not implemented in mock storage');
  }
}

export interface IStorage {
  // Session store
  sessionStore: session.SessionStore;

  // Tenant operations
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant>;

  // Sub-account operations
  getSubAccount(id: string): Promise<SubAccount | undefined>;
  getSubAccountsByTenant(tenantId: string): Promise<SubAccount[]>;
  createSubAccount(subAccount: InsertSubAccount): Promise<SubAccount>;
  updateSubAccount(id: string, updates: Partial<InsertSubAccount>): Promise<SubAccount>;

  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByTenant(tenantId: string): Promise<User[]>;
  getUsersBySubAccount(subAccountId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId?: string): Promise<User>;

  // Lead operations
  getLead(id: string): Promise<Lead | undefined>;
  getLeadsByTenant(tenantId: string, subAccountId?: string): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead>;
  searchLeads(tenantId: string, query: string, subAccountId?: string): Promise<Lead[]>;
  getLeadStats(tenantId: string, subAccountId?: string): Promise<{
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
  }>;

  // University operations
  getUniversity(id: string): Promise<University | undefined>;
  getUniversities(search?: string, country?: string): Promise<University[]>;
  createUniversity(university: InsertUniversity): Promise<University>;
  updateUniversity(id: string, updates: Partial<InsertUniversity>): Promise<University>;

  // Program operations
  getProgram(id: string): Promise<Program | undefined>;
  getProgramsByUniversity(universityId: string): Promise<Program[]>;
  searchPrograms(query?: string, degreeType?: string, field?: string): Promise<Program[]>;
  createProgram(program: InsertProgram): Promise<Program>;
  updateProgram(id: string, updates: Partial<InsertProgram>): Promise<Program>;

  // Application operations
  getApplication(id: string): Promise<Application | undefined>;
  getApplicationsByTenant(tenantId: string, subAccountId?: string): Promise<Application[]>;
  getApplicationsByLead(leadId: string): Promise<Application[]>;
  createApplication(application: InsertApplication): Promise<Application>;
  updateApplication(id: string, updates: Partial<InsertApplication>): Promise<Application>;
  getApplicationStats(tenantId: string, subAccountId?: string): Promise<{
    total: number;
    draft: number;
    submitted: number;
    underReview: number;
    accepted: number;
    rejected: number;
  }>;

  // Document operations
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByLead(leadId: string): Promise<Document[]>;
  getDocumentsByApplication(applicationId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document>;

  // Payment operations
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByTenant(tenantId: string, subAccountId?: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment>;
  getRevenueStats(tenantId: string, subAccountId?: string): Promise<{
    total: number;
    thisMonth: number;
    lastMonth: number;
    pending: number;
  }>;

  // Activity operations
  getActivitiesByTenant(tenantId: string, subAccountId?: string, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Pipeline operations
  getPipelinesByTenant(tenantId: string, subAccountId?: string): Promise<Pipeline[]>;
  createPipeline(pipeline: InsertPipeline): Promise<Pipeline>;
  updatePipeline(id: string, updates: Partial<InsertPipeline>): Promise<Pipeline>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // Tenant operations
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [newTenant] = await db.insert(tenants).values(tenant).returning();
    return newTenant;
  }

  async updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant> {
    const [updatedTenant] = await db
      .update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return updatedTenant;
  }

  // Sub-account operations
  async getSubAccount(id: string): Promise<SubAccount | undefined> {
    const [subAccount] = await db.select().from(subAccounts).where(eq(subAccounts.id, id));
    return subAccount;
  }

  async getSubAccountsByTenant(tenantId: string): Promise<SubAccount[]> {
    return await db.select().from(subAccounts).where(eq(subAccounts.tenantId, tenantId));
  }

  async createSubAccount(subAccount: InsertSubAccount): Promise<SubAccount> {
    const [newSubAccount] = await db.insert(subAccounts).values(subAccount).returning();
    return newSubAccount;
  }

  async updateSubAccount(id: string, updates: Partial<InsertSubAccount>): Promise<SubAccount> {
    const [updatedSubAccount] = await db
      .update(subAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subAccounts.id, id))
      .returning();
    return updatedSubAccount;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.tenantId, tenantId));
  }

  async getUsersBySubAccount(subAccountId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.subAccountId, subAccountId));
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId?: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        stripeCustomerId,
        stripeSubscriptionId,
        updatedAt: new Date() 
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Lead operations
  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async getLeadsByTenant(tenantId: string, subAccountId?: string): Promise<Lead[]> {
    const conditions = [eq(leads.tenantId, tenantId)];
    if (subAccountId) {
      conditions.push(eq(leads.subAccountId, subAccountId));
    }
    return await db.select().from(leads).where(and(...conditions)).orderBy(desc(leads.createdAt));
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead> {
    const [updatedLead] = await db
      .update(leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updatedLead;
  }

  async searchLeads(tenantId: string, query: string, subAccountId?: string): Promise<Lead[]> {
    const conditions = [
      eq(leads.tenantId, tenantId),
      sql`${leads.firstName} ILIKE ${`%${query}%`} OR ${leads.lastName} ILIKE ${`%${query}%`} OR ${leads.email} ILIKE ${`%${query}%`}`,
    ];
    if (subAccountId) {
      conditions.push(eq(leads.subAccountId, subAccountId));
    }
    return await db.select().from(leads).where(and(...conditions));
  }

  async getLeadStats(tenantId: string, subAccountId?: string): Promise<{
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
  }> {
    const conditions = [eq(leads.tenantId, tenantId)];
    if (subAccountId) {
      conditions.push(eq(leads.subAccountId, subAccountId));
    }

    const stats = await db
      .select({
        status: leads.status,
        count: count(),
      })
      .from(leads)
      .where(and(...conditions))
      .groupBy(leads.status);

    const result = {
      total: 0,
      new: 0,
      contacted: 0,
      qualified: 0,
      converted: 0,
    };

    stats.forEach((stat) => {
      result.total += stat.count;
      if (stat.status) {
        result[stat.status as keyof typeof result] = stat.count;
      }
    });

    return result;
  }

  // University operations
  async getUniversity(id: string): Promise<University | undefined> {
    const [university] = await db.select().from(universities).where(eq(universities.id, id));
    return university;
  }

  async getUniversities(search?: string, country?: string): Promise<University[]> {
    const conditions = [eq(universities.isActive, true)];
    
    if (search) {
      conditions.push(ilike(universities.name, `%${search}%`));
    }
    
    if (country) {
      conditions.push(eq(universities.country, country));
    }

    return await db.select().from(universities).where(and(...conditions)).orderBy(asc(universities.name));
  }

  async createUniversity(university: InsertUniversity): Promise<University> {
    const [newUniversity] = await db.insert(universities).values(university).returning();
    return newUniversity;
  }

  async updateUniversity(id: string, updates: Partial<InsertUniversity>): Promise<University> {
    const [updatedUniversity] = await db
      .update(universities)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(universities.id, id))
      .returning();
    return updatedUniversity;
  }

  // Program operations
  async getProgram(id: string): Promise<Program | undefined> {
    const [program] = await db.select().from(programs).where(eq(programs.id, id));
    return program;
  }

  async getProgramsByUniversity(universityId: string): Promise<Program[]> {
    return await db.select().from(programs).where(eq(programs.universityId, universityId));
  }

  async searchPrograms(query?: string, degreeType?: string, field?: string): Promise<Program[]> {
    const conditions = [eq(programs.isActive, true)];
    
    if (query) {
      conditions.push(ilike(programs.name, `%${query}%`));
    }
    
    if (degreeType) {
      conditions.push(eq(programs.degreeType, degreeType));
    }
    
    if (field) {
      conditions.push(ilike(programs.field, `%${field}%`));
    }

    return await db.select().from(programs).where(and(...conditions)).orderBy(asc(programs.name));
  }

  async createProgram(program: InsertProgram): Promise<Program> {
    const [newProgram] = await db.insert(programs).values(program).returning();
    return newProgram;
  }

  async updateProgram(id: string, updates: Partial<InsertProgram>): Promise<Program> {
    const [updatedProgram] = await db
      .update(programs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(programs.id, id))
      .returning();
    return updatedProgram;
  }

  // Application operations
  async getApplication(id: string): Promise<Application | undefined> {
    const [application] = await db.select().from(applications).where(eq(applications.id, id));
    return application;
  }

  async getApplicationsByTenant(tenantId: string, subAccountId?: string): Promise<Application[]> {
    const conditions = [eq(applications.tenantId, tenantId)];
    if (subAccountId) {
      conditions.push(eq(applications.subAccountId, subAccountId));
    }
    return await db.select().from(applications).where(and(...conditions)).orderBy(desc(applications.createdAt));
  }

  async getApplicationsByLead(leadId: string): Promise<Application[]> {
    return await db.select().from(applications).where(eq(applications.leadId, leadId));
  }

  async createApplication(application: InsertApplication): Promise<Application> {
    const [newApplication] = await db.insert(applications).values(application).returning();
    return newApplication;
  }

  async updateApplication(id: string, updates: Partial<InsertApplication>): Promise<Application> {
    const [updatedApplication] = await db
      .update(applications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();
    return updatedApplication;
  }

  async getApplicationStats(tenantId: string, subAccountId?: string): Promise<{
    total: number;
    draft: number;
    submitted: number;
    underReview: number;
    accepted: number;
    rejected: number;
  }> {
    const conditions = [eq(applications.tenantId, tenantId)];
    if (subAccountId) {
      conditions.push(eq(applications.subAccountId, subAccountId));
    }

    const stats = await db
      .select({
        status: applications.status,
        count: count(),
      })
      .from(applications)
      .where(and(...conditions))
      .groupBy(applications.status);

    const result = {
      total: 0,
      draft: 0,
      submitted: 0,
      underReview: 0,
      accepted: 0,
      rejected: 0,
    };

    stats.forEach((stat) => {
      result.total += stat.count;
      if (stat.status) {
        result[stat.status as keyof typeof result] = stat.count;
      }
    });

    return result;
  }

  // Document operations
  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async getDocumentsByLead(leadId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.leadId, leadId));
  }

  async getDocumentsByApplication(applicationId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.applicationId, applicationId));
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }

  // Payment operations
  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async getPaymentsByTenant(tenantId: string, subAccountId?: string): Promise<Payment[]> {
    const conditions = [eq(payments.tenantId, tenantId)];
    if (subAccountId) {
      conditions.push(eq(payments.subAccountId, subAccountId));
    }
    return await db.select().from(payments).where(and(...conditions)).orderBy(desc(payments.createdAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment> {
    const [updatedPayment] = await db
      .update(payments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return updatedPayment;
  }

  async getRevenueStats(tenantId: string, subAccountId?: string): Promise<{
    total: number;
    thisMonth: number;
    lastMonth: number;
    pending: number;
  }> {
    const conditions = [eq(payments.tenantId, tenantId)];
    if (subAccountId) {
      conditions.push(eq(payments.subAccountId, subAccountId));
    }

    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Get total revenue (completed payments)
    const [totalResult] = await db
      .select({ total: sql<number>`SUM(${payments.amount})` })
      .from(payments)
      .where(and(...conditions, eq(payments.status, "completed")));

    // Get this month's revenue
    const [thisMonthResult] = await db
      .select({ total: sql<number>`SUM(${payments.amount})` })
      .from(payments)
      .where(and(
        ...conditions,
        eq(payments.status, "completed"),
        sql`${payments.createdAt} >= ${firstDayThisMonth}`
      ));

    // Get last month's revenue
    const [lastMonthResult] = await db
      .select({ total: sql<number>`SUM(${payments.amount})` })
      .from(payments)
      .where(and(
        ...conditions,
        eq(payments.status, "completed"),
        sql`${payments.createdAt} >= ${firstDayLastMonth} AND ${payments.createdAt} < ${firstDayThisMonth}`
      ));

    // Get pending revenue
    const [pendingResult] = await db
      .select({ total: sql<number>`SUM(${payments.amount})` })
      .from(payments)
      .where(and(...conditions, eq(payments.status, "pending")));

    return {
      total: Number(totalResult?.total || 0),
      thisMonth: Number(thisMonthResult?.total || 0),
      lastMonth: Number(lastMonthResult?.total || 0),
      pending: Number(pendingResult?.total || 0),
    };
  }

  // Activity operations
  async getActivitiesByTenant(tenantId: string, subAccountId?: string, limit = 50): Promise<Activity[]> {
    const conditions = [eq(activities.tenantId, tenantId)];
    if (subAccountId) {
      conditions.push(eq(activities.subAccountId, subAccountId));
    }
    return await db
      .select()
      .from(activities)
      .where(and(...conditions))
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }

  // Pipeline operations
  async getPipelinesByTenant(tenantId: string, subAccountId?: string): Promise<Pipeline[]> {
    const conditions = [eq(pipelines.tenantId, tenantId)];
    if (subAccountId) {
      conditions.push(eq(pipelines.subAccountId, subAccountId));
    }
    return await db.select().from(pipelines).where(and(...conditions));
  }

  async createPipeline(pipeline: InsertPipeline): Promise<Pipeline> {
    const [newPipeline] = await db.insert(pipelines).values(pipeline).returning();
    return newPipeline;
  }

  async updatePipeline(id: string, updates: Partial<InsertPipeline>): Promise<Pipeline> {
    const [updatedPipeline] = await db
      .update(pipelines)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pipelines.id, id))
      .returning();
    return updatedPipeline;
  }
}

// Try to use DatabaseStorage, fall back to MockStorage if database is not available
let storage: IStorage;
try {
  // Test if database is accessible
  if (pool && typeof pool.query === 'function') {
    storage = new DatabaseStorage();
    console.log('Using DatabaseStorage');
  } else {
    throw new Error('Database pool not available');
  }
} catch (error) {
  console.log('Database not available, using MockStorage for development');
  storage = new MockStorage();
}

export { storage };
