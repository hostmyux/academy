import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  uuid,
  pgEnum,
  serial,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum("role", ["tenant_admin", "sub_account_admin", "agent", "student"]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "qualified", "unqualified", "converted"]);
export const applicationStatusEnum = pgEnum("application_status", ["draft", "submitted", "under_review", "accepted", "rejected", "withdrawn"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "completed", "failed", "refunded"]);
export const activityTypeEnum = pgEnum("activity_type", ["lead_added", "application_submitted", "payment_received", "document_uploaded", "status_changed"]);

// Core Tables
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }).unique(),
  branding: jsonb("branding").$type<{
    logo?: string;
    colors?: { primary: string; secondary: string };
    theme?: string;
  }>(),
  settings: jsonb("settings").$type<{
    allowSubAccounts?: boolean;
    maxSubAccounts?: number;
    features?: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const subAccounts = pgTable("sub_accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  settings: jsonb("settings").$type<{
    branding?: { logo?: string; colors?: object };
    permissions?: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("sub_accounts_tenant_id_idx").on(table.tenantId),
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  subAccountId: uuid("sub_account_id").references(() => subAccounts.id),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }).notNull(),
  password: text("password").notNull(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  role: roleEnum("role").notNull().default("agent"),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("users_tenant_id_idx").on(table.tenantId),
  index("users_sub_account_id_idx").on(table.subAccountId),
  index("users_email_idx").on(table.email),
]);

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  subAccountId: uuid("sub_account_id").references(() => subAccounts.id),
  assignedAgentId: uuid("assigned_agent_id").references(() => users.id),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  source: varchar("source", { length: 100 }),
  status: leadStatusEnum("status").default("new"),
  score: integer("score").default(0),
  programInterest: text("program_interest"),
  targetCountry: varchar("target_country", { length: 100 }),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  notes: text("notes"),
  customFields: jsonb("custom_fields"),
  engagementHistory: jsonb("engagement_history").$type<Array<{
    type: string;
    date: string;
    details: string;
  }>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("leads_tenant_id_idx").on(table.tenantId),
  index("leads_sub_account_id_idx").on(table.subAccountId),
  index("leads_assigned_agent_id_idx").on(table.assignedAgentId),
  index("leads_status_idx").on(table.status),
]);

export const universities = pgTable("universities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 500 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }),
  city: varchar("city", { length: 100 }),
  website: varchar("website", { length: 500 }),
  ranking: jsonb("ranking").$type<{
    global?: number;
    national?: number;
    subject?: Record<string, number>;
  }>(),
  contactInfo: jsonb("contact_info").$type<{
    admissions?: { email: string; phone: string };
    international?: { email: string; phone: string };
  }>(),
  isActive: boolean("is_active").default(true),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("universities_country_idx").on(table.country),
  index("universities_name_idx").on(table.name),
]);

export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  universityId: uuid("university_id").references(() => universities.id).notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  degreeType: varchar("degree_type", { length: 100 }).notNull(),
  field: varchar("field", { length: 200 }),
  duration: varchar("duration", { length: 100 }),
  language: varchar("language", { length: 100 }).default("English"),
  tuitionFee: decimal("tuition_fee", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  applicationDeadline: timestamp("application_deadline"),
  startDate: timestamp("start_date"),
  requirements: jsonb("requirements").$type<{
    gpa?: number;
    testScores?: Record<string, number>;
    documents?: string[];
    experience?: string;
  }>(),
  scholarships: jsonb("scholarships").$type<Array<{
    name: string;
    amount: number;
    criteria: string;
  }>>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("programs_university_id_idx").on(table.universityId),
  index("programs_degree_type_idx").on(table.degreeType),
  index("programs_field_idx").on(table.field),
]);

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  subAccountId: uuid("sub_account_id").references(() => subAccounts.id),
  leadId: uuid("lead_id").references(() => leads.id).notNull(),
  programId: uuid("program_id").references(() => programs.id).notNull(),
  assignedAgentId: uuid("assigned_agent_id").references(() => users.id),
  status: applicationStatusEnum("status").default("draft"),
  submittedAt: timestamp("submitted_at"),
  decisionDate: timestamp("decision_date"),
  decisionType: varchar("decision_type", { length: 50 }),
  applicationData: jsonb("application_data").$type<{
    personalInfo?: object;
    academicInfo?: object;
    documents?: string[];
    essays?: object;
  }>(),
  timeline: jsonb("timeline").$type<Array<{
    stage: string;
    date: string;
    status: string;
    notes?: string;
  }>>(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("applications_tenant_id_idx").on(table.tenantId),
  index("applications_lead_id_idx").on(table.leadId),
  index("applications_status_idx").on(table.status),
]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  subAccountId: uuid("sub_account_id").references(() => subAccounts.id),
  leadId: uuid("lead_id").references(() => leads.id),
  applicationId: uuid("application_id").references(() => applications.id),
  uploadedById: uuid("uploaded_by_id").references(() => users.id).notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  originalName: varchar("original_name", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: varchar("file_path", { length: 1000 }).notNull(),
  category: varchar("category", { length: 100 }),
  isVerified: boolean("is_verified").default(false),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("documents_tenant_id_idx").on(table.tenantId),
  index("documents_lead_id_idx").on(table.leadId),
  index("documents_application_id_idx").on(table.applicationId),
]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  subAccountId: uuid("sub_account_id").references(() => subAccounts.id),
  leadId: uuid("lead_id").references(() => leads.id),
  applicationId: uuid("application_id").references(() => applications.id),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD"),
  status: paymentStatusEnum("status").default("pending"),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("payments_tenant_id_idx").on(table.tenantId),
  index("payments_lead_id_idx").on(table.leadId),
  index("payments_status_idx").on(table.status),
]);

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  subAccountId: uuid("sub_account_id").references(() => subAccounts.id),
  userId: uuid("user_id").references(() => users.id),
  leadId: uuid("lead_id").references(() => leads.id),
  applicationId: uuid("application_id").references(() => applications.id),
  type: activityTypeEnum("type").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("activities_tenant_id_idx").on(table.tenantId),
  index("activities_user_id_idx").on(table.userId),
  index("activities_type_idx").on(table.type),
  index("activities_created_at_idx").on(table.createdAt),
]);

export const pipelines = pgTable("pipelines", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  subAccountId: uuid("sub_account_id").references(() => subAccounts.id),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'lead' or 'application'
  stages: jsonb("stages").$type<Array<{
    id: string;
    name: string;
    order: number;
    color: string;
  }>>(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("pipelines_tenant_id_idx").on(table.tenantId),
  index("pipelines_type_idx").on(table.type),
]);

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  subAccounts: many(subAccounts),
  users: many(users),
  leads: many(leads),
  applications: many(applications),
  documents: many(documents),
  payments: many(payments),
  activities: many(activities),
  pipelines: many(pipelines),
}));

export const subAccountsRelations = relations(subAccounts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [subAccounts.tenantId],
    references: [tenants.id],
  }),
  users: many(users),
  leads: many(leads),
  applications: many(applications),
  documents: many(documents),
  payments: many(payments),
  activities: many(activities),
  pipelines: many(pipelines),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  subAccount: one(subAccounts, {
    fields: [users.subAccountId],
    references: [subAccounts.id],
  }),
  assignedLeads: many(leads),
  assignedApplications: many(applications),
  uploadedDocuments: many(documents),
  activities: many(activities),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [leads.tenantId],
    references: [tenants.id],
  }),
  subAccount: one(subAccounts, {
    fields: [leads.subAccountId],
    references: [subAccounts.id],
  }),
  assignedAgent: one(users, {
    fields: [leads.assignedAgentId],
    references: [users.id],
  }),
  applications: many(applications),
  documents: many(documents),
  payments: many(payments),
  activities: many(activities),
}));

export const universitiesRelations = relations(universities, ({ many }) => ({
  programs: many(programs),
}));

export const programsRelations = relations(programs, ({ one, many }) => ({
  university: one(universities, {
    fields: [programs.universityId],
    references: [universities.id],
  }),
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [applications.tenantId],
    references: [tenants.id],
  }),
  subAccount: one(subAccounts, {
    fields: [applications.subAccountId],
    references: [subAccounts.id],
  }),
  lead: one(leads, {
    fields: [applications.leadId],
    references: [leads.id],
  }),
  program: one(programs, {
    fields: [applications.programId],
    references: [programs.id],
  }),
  assignedAgent: one(users, {
    fields: [applications.assignedAgentId],
    references: [users.id],
  }),
  documents: many(documents),
  payments: many(payments),
  activities: many(activities),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [documents.tenantId],
    references: [tenants.id],
  }),
  subAccount: one(subAccounts, {
    fields: [documents.subAccountId],
    references: [subAccounts.id],
  }),
  lead: one(leads, {
    fields: [documents.leadId],
    references: [leads.id],
  }),
  application: one(applications, {
    fields: [documents.applicationId],
    references: [applications.id],
  }),
  uploadedBy: one(users, {
    fields: [documents.uploadedById],
    references: [users.id],
  }),
  verifiedBy: one(users, {
    fields: [documents.verifiedBy],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  subAccount: one(subAccounts, {
    fields: [payments.subAccountId],
    references: [subAccounts.id],
  }),
  lead: one(leads, {
    fields: [payments.leadId],
    references: [leads.id],
  }),
  application: one(applications, {
    fields: [payments.applicationId],
    references: [applications.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  tenant: one(tenants, {
    fields: [activities.tenantId],
    references: [tenants.id],
  }),
  subAccount: one(subAccounts, {
    fields: [activities.subAccountId],
    references: [subAccounts.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  lead: one(leads, {
    fields: [activities.leadId],
    references: [leads.id],
  }),
  application: one(applications, {
    fields: [activities.applicationId],
    references: [applications.id],
  }),
}));

export const pipelinesRelations = relations(pipelines, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pipelines.tenantId],
    references: [tenants.id],
  }),
  subAccount: one(subAccounts, {
    fields: [pipelines.subAccountId],
    references: [subAccounts.id],
  }),
}));

// Insert Schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubAccountSchema = createInsertSchema(subAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUniversitySchema = createInsertSchema(universities).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertProgramSchema = createInsertSchema(programs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertPipelineSchema = createInsertSchema(pipelines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

export type SubAccount = typeof subAccounts.$inferSelect;
export type InsertSubAccount = z.infer<typeof insertSubAccountSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export type University = typeof universities.$inferSelect;
export type InsertUniversity = z.infer<typeof insertUniversitySchema>;

export type Program = typeof programs.$inferSelect;
export type InsertProgram = z.infer<typeof insertProgramSchema>;

export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type Pipeline = typeof pipelines.$inferSelect;
export type InsertPipeline = z.infer<typeof insertPipelineSchema>;
