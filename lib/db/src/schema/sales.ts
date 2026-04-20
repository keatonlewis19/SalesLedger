import { pgTable, text, serial, timestamp, doublePrecision, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  owningAgent: text("owning_agent").notNull(),
  salesType: text("sales_type").notNull(),
  soldDate: text("sold_date").notNull(),
  commissionType: text("commission_type").notNull(),
  annualPremium: doublePrecision("annual_premium"),
  estimatedCommission: doublePrecision("estimated_commission"),
  notes: text("notes"),
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

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  reportDayOfWeek: integer("report_day_of_week").notNull().default(4),
  reportHour: integer("report_hour").notNull().default(17),
  reportMinute: integer("report_minute").notNull().default(0),
  recipients: text("recipients").notNull().default("rauni@crmgrp.com,chad@crmgrp.com"),
  commissionRates: jsonb("commission_rates").$type<Record<string, number>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AppSettings = typeof appSettingsTable.$inferSelect;
