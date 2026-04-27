# CRM Group Insurance — Agency Sales Platform

## Overview

pnpm workspace monorepo using TypeScript. Multi-tenant agency management platform for CRM Group Insurance with Clerk authentication, role-based access control (admin/agent), and automated reporting.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Clerk (email + Google Sign-In)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Email**: Nodemailer (SMTP) — weekly/monthly/annual report emails; recipients configurable via Settings
- **Scheduling**: node-cron — configurable day/time; defaults to Thursday 5pm

## Artifacts

- **sales-tracker** (`/`) — React + Vite frontend (Clerk auth, role-based UI). Pages: Dashboard, History, Leads, Metrics (charts + sortable tables), Team (admin), Settings (carrier colors, branding, FMV, commission table)
- **api-server** (`/api`) — Express 5 backend (Clerk middleware, admin/agent routes)

## Lead Pipeline & Metrics System

### Database Tables
- `lead_sources` — App-wide lead sources with name, costPerLead, isPaid flag
- `leads` — Individual lead tracking per agent with: firstName, lastName, phone, email, leadSourceId, status (new/in_comm/appt_set/follow_up/sold/lost), revenue, carrier, salesType, commissionType, costPerLead override, notes, enteredDate, soldDate, linkedSaleId

### Auto-sync
When a lead status changes to "sold", the API automatically creates a corresponding entry in the `sales` table (weekly report), linking it via `linkedSaleId`. When a lead is un-sold or deleted, the linked sale is removed.

### API Routes
- `GET/POST /api/lead-sources` — list/create (create: admin only)
- `PATCH/DELETE /api/lead-sources/:id` — update/delete (admin only)
- `GET/POST /api/leads` — list (own for agents, all for admins) / create
- `PATCH/DELETE /api/leads/:id` — update (triggers sale sync) / delete
- `GET /api/metrics` — computed KPIs: summary, leadSourcePerformance, leadSourcePipeline, carrierPerformance

## Authentication & Roles

Clerk is provisioned (appId: `app_3CdToFskCzNkEvnfnkkSvgcU6Nn`). Keys in env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`.

- **Closed platform**: Only invited users can create accounts (invite-only sign-up)
- **First user to sign up** is automatically made **Admin** (bypasses invite check)
- Subsequent users must have their email in `pending_invites` table to register
- Invitations stored in `pending_invites` table (auto-deleted on first sign-in)
- Admin can invite agents via email (Clerk invitation API + `pending_invites` row)
- Roles are stored in `agency_users.role` column

## Role Permissions

| Feature | Admin | Agent |
|---|---|---|
| View own sales | ✅ | ✅ |
| View all agents' sales | ✅ | ❌ |
| Add/edit/delete own sales | ✅ | ✅ |
| Mark sale as "Paid" | ✅ | View only |
| Edit settings/commission rates | ✅ | View only |
| Send reports | ✅ | ❌ |
| Team management | ✅ | ❌ |

## Key Features

- Log client sales with commission auto-calculation using FMV rates
- Weekly summary stats (total sales, total est. commission)
- Auto-send email report on configured day/time (default: Thursday 5pm)
- Monthly and annual email reports (dashboard-style)
- **Weekly email**: per-agent sections (paid ✓ green / unpaid ✗ amber), unpaid commission alert banner
- "Paid" checkbox on sales — admin marks, agents see read-only status
- **Admin dashboard**: agent tab system — "All Agents" + one tab per agent; unpaid banner showing total owed; amber row highlighting for unpaid records
- Each sale linked to its agent via LEFT JOIN on `agency_users` — `agentName` returned on all sale responses
- Team management page: invite agents, change roles
- Settings: read-only for agents, editable by admin
- FMV rate structure: Initial (editable), Renewal (Initial÷2), Monthly Renewal (Renewal÷12)

## Email Configuration

Email sending requires SMTP environment variables:
- `SMTP_HOST` — SMTP server hostname
- `SMTP_PORT` — Port (default 587)
- `SMTP_USER` — SMTP username/email
- `SMTP_PASS` — SMTP password (secret)
- `SMTP_FROM` — From address (optional, defaults to SMTP_USER)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## DB Schema

- `agency_users` — Clerk user profiles (clerk_user_id, role: admin|agent, full_name, email)
- `sales` — client sale entries with `user_id` (Clerk ID) and `paid` boolean
- `weekly_reports` — log of sent weekly reports
- `app_settings` — single-row configuration (commission_rates as jsonb, schedule, recipients)

## Auth Middleware

- `requireAuth` — validates Clerk session, auto-creates agency_users record on first login (first user = admin)
- `requireAdmin` — checks `role === 'admin'` in agency_users table

## Codegen Workflow

1. Edit `lib/api-spec/openapi.yaml`
2. `pnpm --filter @workspace/db run push` (if schema changed)
3. `pnpm --filter @workspace/api-spec run codegen`
4. Restart `artifacts/api-server: API Server` workflow

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
