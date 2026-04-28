import { pgTable, text, serial, timestamp, doublePrecision, integer, jsonb, boolean, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agencyUsersTable = pgTable("agency_users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  role: text("role").notNull().default("agent"), // "admin" | "agent"
  fullName: text("full_name"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AgencyUser = typeof agencyUsersTable.$inferSelect;

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  clientName: text("client_name").notNull(),
  owningAgent: text("owning_agent"),
  salesSource: text("sales_source"),
  salesType: text("sales_type").notNull(),
  soldDate: text("sold_date").notNull(),
  effectiveDate: text("effective_date"),
  commissionType: text("commission_type").notNull(),
  leadSource: text("lead_source"),
  hra: doublePrecision("hra"),
  annualPremium: doublePrecision("annual_premium"),
  estimatedCommission: doublePrecision("estimated_commission"),
  notes: text("notes"),
  paid: boolean("paid").notNull().default(false),
  weekStart: text("week_start").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;

export const weeklyReportsTable = pgTable("weekly_reports", {
  id: serial("id").primaryKey(),
  weekStart: text("week_start").notNull(),
  weekEnd: text("week_end").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  totalSales: integer("total_sales").notNull().default(0),
  totalEstimatedCommission: doublePrecision("total_estimated_commission").notNull().default(0),
  recipients: text("recipients").notNull(),
});

export const insertWeeklyReportSchema = createInsertSchema(weeklyReportsTable).omit({ id: true, sentAt: true });
export type InsertWeeklyReport = z.infer<typeof insertWeeklyReportSchema>;
export type WeeklyReport = typeof weeklyReportsTable.$inferSelect;

export type CommissionTableRow = {
  salesSource: string;
  salesType: string;
  commissionType: string;
  estimatedCommission: number | null;
};

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  reportDayOfWeek: integer("report_day_of_week").notNull().default(4),
  reportHour: integer("report_hour").notNull().default(17),
  reportMinute: integer("report_minute").notNull().default(0),
  recipients: text("recipients").notNull().default("rauni@crmgrp.com,chad@crmgrp.com"),
  commissionRates: jsonb("commission_rates").$type<Record<string, number>>().notNull(),
  commissionTable: jsonb("commission_table").$type<CommissionTableRow[]>(),
  logoPath: text("logo_path"),
  brandColor: text("brand_color").default("#0d9488"),
  panelColor: text("panel_color").default("#0f172a"),
  brandName: text("brand_name").default("CRM Group Insurance"),
  carrierColors: jsonb("carrier_colors").$type<Record<string, string>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AppSettings = typeof appSettingsTable.$inferSelect;

export const pendingInvitesTable = pgTable("pending_invites", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  clerkInvitationId: text("clerk_invitation_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PendingInvite = typeof pendingInvitesTable.$inferSelect;

export const leadSourcesTable = pgTable("lead_sources", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: varchar("name", { length: 255 }).notNull(),
  costPerLead: doublePrecision("cost_per_lead").default(0),
  totalInvested: doublePrecision("total_invested").default(0),
  isPaid: boolean("is_paid").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type LeadSource = typeof leadSourcesTable.$inferSelect;

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  leadOwnership: varchar("lead_ownership", { length: 50 }),
  leadSourceId: integer("lead_source_id").references(() => leadSourcesTable.id),
  state: varchar("state", { length: 100 }),
  county: varchar("county", { length: 100 }),
  zip: varchar("zip", { length: 20 }),
  status: varchar("status", { length: 50 }).notNull().default("new"),
  revenue: doublePrecision("revenue"),
  carrier: varchar("carrier", { length: 255 }),
  salesType: varchar("sales_type", { length: 255 }),
  commissionType: varchar("commission_type", { length: 255 }),
  costPerLead: doublePrecision("cost_per_lead"),
  lineOfBusiness: varchar("line_of_business", { length: 50 }).notNull().default("medicare"),
  ancillaryType: varchar("ancillary_type", { length: 100 }),
  marketplace: varchar("marketplace", { length: 10 }),
  householdCount: integer("household_count"),
  qualified: varchar("qualified", { length: 10 }),
  principal: doublePrecision("principal"),
  faceValue: doublePrecision("face_value"),
  notes: text("notes"),
  enteredDate: text("entered_date").notNull(),
  soldDate: text("sold_date"),
  linkedSaleId: integer("linked_sale_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Lead = typeof leadsTable.$inferSelect;
export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });

export const leadSourcePaymentsTable = pgTable("lead_source_payments", {
  id: serial("id").primaryKey(),
  leadSourceId: integer("lead_source_id").notNull().references(() => leadSourcesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  amount: doublePrecision("amount").notNull(),
  paidDate: date("paid_date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeadSourcePayment = typeof leadSourcePaymentsTable.$inferSelect;
