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
- **Email**: Nodemailer (SMTP) — weekly report emails sent to rauni@crmgrp.com and chad@crmgrp.com
- **Scheduling**: node-cron — Saturday at 5pm automatic report trigger

## Artifacts

- **sales-tracker** (`/`) — React + Vite frontend for the weekly sales tracker
- **api-server** (`/api`) — Express 5 backend

## Key Features

- Log client sales throughout the week with fields: Client Name, Owning Agent (Keaton Lewis / Chad McDonald / CRM Group), Sales Type (Plan Change / New Client / AOR), Sold Date, Commission Type, Estimated Commission, Notes
- Weekly summary stats (total sales, total est. commission)
- Auto-send email report to rauni@crmgrp.com and chad@crmgrp.com every Saturday at 5pm
- Manual "Send Report Now" button on the History page
- Past reports log on the History page
- Edit/delete any sale entry

## Email Configuration

Email sending requires SMTP environment variables:
- `SMTP_HOST` — SMTP server hostname
- `SMTP_PORT` — Port (default 587)
- `SMTP_USER` — SMTP username/email
- `SMTP_PASS` — SMTP password
- `SMTP_FROM` — From address (optional, defaults to SMTP_USER)

Without these, the server logs email content but doesn't send. The scheduled report still runs.

## Commission Calculation

The Estimated Commission field is currently manual — the user enters the value directly. Calculation logic is pending and can be added later based on Commission Type parameters.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## DB Schema

- `sales` — client sale entries (client_name, owning_agent, sales_type, sold_date, commission_type, estimated_commission, notes, week_start)
- `weekly_reports` — log of sent weekly reports (week_start, week_end, sent_at, total_sales, total_estimated_commission, recipients)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
