# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Email**: Nodemailer (SMTP) — weekly report emails; recipients configurable via Settings
- **Scheduling**: node-cron — configurable day/time; defaults to Thursday 5pm; restarts live when settings change

## Artifacts

- **sales-tracker** (`/`) — React + Vite frontend for the weekly sales tracker
- **api-server** (`/api`) — Express 5 backend

## Key Features

- Log client sales with fields: Client Name, Owning Agent (Keaton Lewis / Chad McDonald / CRM Group), Sales Type (Plan Change / New Client / AOR), Sold Date, Commission Type, Annual Premium, Estimated Commission, Notes
- Auto-calculate Estimated Commission from Annual Premium × configured rate (when commission type has a rate set in Settings)
- Weekly summary stats (total sales, total est. commission)
- Auto-send email report on configured day/time (default: Thursday 5pm)
- Manual "Send Report Now" button on the History page
- Past reports log on the History page
- Edit/delete any sale entry
- **Settings page**: configure report recipients, report schedule (day + time), and commission rates per type

## Email Configuration

Email sending requires SMTP environment variables:
- `SMTP_HOST` — SMTP server hostname
- `SMTP_PORT` — Port (default 587)
- `SMTP_USER` — SMTP username/email
- `SMTP_PASS` — SMTP password
- `SMTP_FROM` — From address (optional, defaults to SMTP_USER)

Without these, the server logs email content but doesn't send. The scheduled report still runs.

## Commission Calculation

Commission rates are stored in `app_settings.commissionRates` as `{ [type]: percentage }` (e.g., `{ "FYC": 15 }` = 15%). When adding a sale, entering an Annual Premium + selecting a type with a configured rate auto-fills Estimated Commission = premium × rate%. The field is still manually editable.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## DB Schema

- `sales` — client sale entries (client_name, owning_agent, sales_type, sold_date, commission_type, annual_premium, estimated_commission, notes, week_start)
- `weekly_reports` — log of sent weekly reports (week_start, week_end, sent_at, total_sales, total_estimated_commission, recipients)
- `app_settings` — single-row configuration (report_day_of_week, report_hour, report_minute, recipients as comma-separated text, commission_rates as jsonb)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
