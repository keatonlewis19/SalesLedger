import { pgTable, text, serial, timestamp, doublePrecision, integer, jsonb, boolean } from "drizzle-orm/pg-core";
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
