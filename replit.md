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

- **sales-tracker** (`/`) — React + Vite frontend (Clerk auth, role-based UI)
- **api-server** (`/api`) — Express 5 backend (Clerk middleware, admin/agent routes)

## Authentication & Roles

Clerk is provisioned (appId: `app_3CdToFskCzNkEvnfnkkSvgcU6Nn`). Keys in env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`.

- **First user to sign up** is automatically made **Admin**
- Subsequent users default to **Agent** (admin can change roles)
- Admin can invite agents via email (Clerk invitation API)
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
- "Paid" checkbox on sales — admin marks, agents see
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
