import nodemailer from "nodemailer";
import { logger } from "./logger";

const DEFAULT_RECIPIENTS = ["rauni@crmgrp.com", "chad@crmgrp.com"];

export function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    logger.warn("SMTP credentials not configured — email will be logged only");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export interface SaleRow {
  clientName: string;
  salesSource: string | null;
  salesType: string;
  soldDate: string;
  effectiveDate: string | null;
  commissionType: string;
  leadSource: string | null;
  hra: number | null;
  estimatedCommission: number | null;
  comments: string | null;
  agentName?: string | null;
  paid?: boolean;
}

export interface LobSaleRow {
  clientName: string;
  carrier: string | null;
  revenue: number | null;
  soldDate: string;
  ancillaryType?: string | null;
  notes: string | null;
  agentName?: string | null;
}

export interface CallLogRow {
  clientName: string;
  contactType: string;
  callDate: string;
  notes: string | null;
  agentName?: string | null;
}

export const LOB_LABELS: Record<string, string> = {
  aca: "ACA / Individual Health",
  ancillary: "Ancillary",
  life: "Life Insurance",
  annuity: "Annuities",
};

function formatCurrency(val: number | null): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

// ---------------------------------------------------------------------------
// Shared email shell — responsive, tested against major clients
// ---------------------------------------------------------------------------
function emailShell(content: string, brandColor: string, brandName: string, logoHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${brandName}</title>
  <style>
    body { margin:0; padding:0; background:#f4f6f8; font-family:Arial,Helvetica,sans-serif; color:#333; }
    .wrapper { width:100%; background:#f4f6f8; padding:24px 0; }
    .card { max-width:600px; margin:0 auto; background:#fff; border-radius:10px; overflow:hidden; border:1px solid #e2e8f0; }
    .header { background:${brandColor}; padding:24px 28px; }
    .body { padding:24px 20px; }
    .stat-row { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
    .stat-cell { flex:1; min-width:120px; background:#f0f4f8; border-radius:8px; padding:14px 12px; text-align:center; }
    .stat-label { font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#6b7280; margin-bottom:4px; }
    .stat-value { font-size:22px; font-weight:700; color:#1a3c5e; }
    .section-title { font-size:15px; font-weight:700; color:#1a3c5e; margin:0 0 12px 0; }
    .agent-header { background:${brandColor}18; border-left:4px solid ${brandColor}; padding:10px 14px; border-radius:0 6px 6px 0; margin-bottom:0; }
    .agent-name { font-weight:700; font-size:14px; color:#1a3c5e; display:block; }
    .agent-meta { font-size:12px; color:#6b7280; margin-top:4px; display:block; }
    .tbl-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
    table { border-collapse:collapse; font-size:13px; min-width:100%; }
    th { padding:8px 10px; text-align:left; font-weight:600; color:#374151; background:#f3f4f6; white-space:nowrap; }
    td { padding:7px 10px; border-bottom:1px solid #eee; vertical-align:top; }
    .badge { display:inline-block; padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:600; }
    .alert-warn { background:#fef3c7; border:1px solid #f59e0b; border-radius:6px; padding:12px 16px; margin-bottom:16px; color:#92400e; font-size:13px; }
    .alert-ok { background:#f0fdf4; border:1px solid #86efac; border-radius:6px; padding:12px 16px; margin-bottom:16px; color:#166534; font-size:13px; }
    .divider { border:none; border-top:2px solid #e5e7eb; margin:24px 0 20px 0; }
    .footer { color:#999; font-size:12px; margin-top:24px; }
    @media only screen and (max-width:480px) {
      .body { padding:16px 12px !important; }
      .header { padding:18px 16px !important; }
      .stat-cell { min-width:calc(50% - 10px); }
      th, td { font-size:12px !important; padding:6px 8px !important; }
    }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      ${logoHtml}
    </div>
    <div class="body">
      ${content}
    </div>
  </div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Weekly report — per-agent Medicare sections
// ---------------------------------------------------------------------------
function buildAgentSection(agentLabel: string, sales: SaleRow[], headerColor: string): string {
  const paid = sales.filter((s) => s.paid);
  const unpaid = sales.filter((s) => !s.paid);
  const totalComm = sales.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const paidComm = paid.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const owedComm = unpaid.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);

  const rows = sales.map((s) => `
    <tr style="background:${s.paid ? "#f0fdf4" : "#fffbeb"};">
      <td style="white-space:nowrap;font-weight:500;">${s.clientName}</td>
      <td style="white-space:nowrap;">${s.salesType}</td>
      <td style="white-space:nowrap;">${s.soldDate}</td>
      <td style="white-space:nowrap;">${s.commissionType}</td>
      <td style="text-align:right;white-space:nowrap;">${s.hra != null ? formatCurrency(s.hra) : "—"}</td>
      <td style="text-align:right;white-space:nowrap;font-weight:600;">${formatCurrency(s.estimatedCommission)}</td>
      <td style="text-align:center;white-space:nowrap;">
        <span class="badge" style="background:${s.paid ? "#dcfce7" : "#fef3c7"};color:${s.paid ? "#166534" : "#92400e"};">
          ${s.paid ? "Paid" : "Unpaid"}
        </span>
      </td>
    </tr>`).join("");

  return `
    <div style="margin-bottom:24px;">
      <div class="agent-header" style="background:${headerColor}18;border-left-color:${headerColor};">
        <span class="agent-name">${agentLabel}</span>
        <span class="agent-meta">
          ${sales.length} sale${sales.length !== 1 ? "s" : ""}
          &nbsp;&middot;&nbsp;
          <span style="color:#166534;">Paid: ${formatCurrency(paidComm)}</span>
          &nbsp;&middot;&nbsp;
          <span style="color:#92400e;">Owed: ${formatCurrency(owedComm)}</span>
          &nbsp;&middot;&nbsp;
          Total: ${formatCurrency(totalComm)}
        </span>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Type</th>
              <th>Sold Date</th>
              <th>Commission Type</th>
              <th style="text-align:right;">HRA</th>
              <th style="text-align:right;">Est. Commission</th>
              <th style="text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// LOB sections (ACA, Ancillary, Life, Annuity)
// ---------------------------------------------------------------------------
function buildLobSalesSection(lobLabel: string, sales: LobSaleRow[], headerColor: string): string {
  const total = sales.reduce((acc, s) => acc + (s.revenue ?? 0), 0);
  const isAncillary = lobLabel === "Ancillary";

  const rows = sales.map((s) => `
    <tr>
      <td style="white-space:nowrap;font-weight:500;">${s.clientName}</td>
      ${isAncillary ? `<td style="white-space:nowrap;">${s.ancillaryType ?? "—"}</td>` : ""}
      <td style="white-space:nowrap;">${s.carrier ?? "—"}</td>
      <td style="white-space:nowrap;">${s.soldDate}</td>
      <td style="text-align:right;white-space:nowrap;">${formatCurrency(s.revenue)}</td>
      <td>${s.notes ?? ""}</td>
    </tr>`).join("");

  return `
    <div style="margin-bottom:20px;">
      <div class="agent-header" style="background:${headerColor}18;border-left-color:${headerColor};">
        <span class="agent-name">${lobLabel}</span>
        <span class="agent-meta">
          ${sales.length} sale${sales.length !== 1 ? "s" : ""}
          &nbsp;&middot;&nbsp;
          <span style="color:#059669;font-weight:600;">Total: ${formatCurrency(total)}</span>
        </span>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              ${isAncillary ? "<th>Type</th>" : ""}
              <th>Carrier</th>
              <th>Date</th>
              <th style="text-align:right;">Revenue</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Call logs section
// ---------------------------------------------------------------------------
const CONTACT_TYPE_LABELS: Record<string, string> = {
  outbound: "Outbound",
  inbound: "Inbound",
  voicemail: "Voicemail",
  text: "Text",
  email: "Email",
  text_message: "Text",
  no_answer: "No Answer",
  contacted: "Contacted",
};

const CONTACT_TYPE_COLORS: Record<string, string> = {
  outbound: "#2563eb",
  inbound: "#16a34a",
  voicemail: "#d97706",
  text: "#7c3aed",
  email: "#0891b2",
  text_message: "#7c3aed",
  no_answer: "#6b7280",
  contacted: "#16a34a",
};

function buildCallLogsSection(callLogs: CallLogRow[]): string {
  if (callLogs.length === 0) return "";

  const counts: Record<string, number> = { contacted: 0, voicemail: 0, text_message: 0, no_answer: 0 };
  for (const l of callLogs) {
    const ct = l.contactType;
    if (ct === "inbound" || ct === "outbound" || ct === "contacted") counts.contacted++;
    else if (ct === "voicemail") counts.voicemail++;
    else if (ct === "text" || ct === "text_message") counts.text_message++;
    else if (ct === "no_answer") counts.no_answer++;
  }
  const contactRate = callLogs.length > 0 ? Math.round((counts.contacted / callLogs.length) * 100) : 0;

  const agentGroups = new Map<string, CallLogRow[]>();
  for (const l of callLogs) {
    const key = l.agentName ?? "Unassigned";
    if (!agentGroups.has(key)) agentGroups.set(key, []);
    agentGroups.get(key)!.push(l);
  }

  const agentSections = [...agentGroups.entries()].map(([agent, logs]) => {
    const detailRows = logs.map((l) => {
      const color = CONTACT_TYPE_COLORS[l.contactType] ?? "#6b7280";
      const label = CONTACT_TYPE_LABELS[l.contactType] ?? l.contactType;
      return `<tr>
        <td style="font-weight:500;white-space:nowrap;">${l.clientName}</td>
        <td style="white-space:nowrap;">
          <span class="badge" style="background:${color}18;color:${color};">${label}</span>
        </td>
        <td style="white-space:nowrap;color:#6b7280;">${l.callDate}</td>
        <td style="color:#6b7280;">${l.notes ?? ""}</td>
      </tr>`;
    }).join("");

    return `
      <div style="margin-top:12px;">
        <div style="font-size:13px;font-weight:600;color:#374151;padding:6px 0 6px 0;border-bottom:1px solid #e5e7eb;margin-bottom:0;">
          ${agent} &mdash; ${logs.length} call${logs.length !== 1 ? "s" : ""}
        </div>
        <div class="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Type</th>
                <th>Date</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${detailRows}</tbody>
          </table>
        </div>
      </div>`;
  }).join("");

  return `
    <hr class="divider"/>
    <h3 class="section-title">Call Activity</h3>
    <p style="color:#6b7280;font-size:13px;margin:0 0 12px 0;">
      ${callLogs.length} total
      &nbsp;&middot;&nbsp; ${counts.contacted} contacted
      &nbsp;&middot;&nbsp; ${counts.voicemail} voicemail${counts.voicemail !== 1 ? "s" : ""}
      &nbsp;&middot;&nbsp; ${counts.text_message} text${counts.text_message !== 1 ? "s" : ""}
      &nbsp;&middot;&nbsp; <strong>${contactRate}% contact rate</strong>
    </p>
    ${agentSections}`;
}

// ---------------------------------------------------------------------------
// Weekly report HTML
// ---------------------------------------------------------------------------
export interface BrandingOptions {
  brandName?: string;
  brandColor?: string;
  logoUrl?: string | null;
}

function buildWeeklyReportHtml(
  sales: SaleRow[],
  weekStart: string,
  weekEnd: string,
  branding: BrandingOptions = {},
  lobSalesMap?: Map<string, LobSaleRow[]>,
  callLogs?: CallLogRow[]
): string {
  const color = branding.brandColor ?? "#1a3c5e";
  const name = branding.brandName ?? "Sales Tracker";
  const logoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${name}" style="height:36px;max-width:180px;object-fit:contain;display:block;margin-bottom:8px;"/>
       <h2 style="color:#fff;margin:0;font-size:18px;">Weekly Sales Report</h2>
       <p style="color:rgba(255,255,255,0.75);margin:4px 0 0 0;font-size:13px;">Week of <strong>${weekStart}</strong> through <strong>${weekEnd}</strong></p>`
    : `<div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:4px;">${name}</div>
       <h2 style="color:#fff;margin:0;font-size:18px;">Weekly Sales Report</h2>
       <p style="color:rgba(255,255,255,0.75);margin:4px 0 0 0;font-size:13px;">Week of <strong>${weekStart}</strong> through <strong>${weekEnd}</strong></p>`;

  const totalComm = sales.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const totalOwed = sales.filter((s) => !s.paid).reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const lobCount = lobSalesMap ? [...lobSalesMap.values()].reduce((a, b) => a + b.length, 0) : 0;

  const agentGroups = new Map<string, SaleRow[]>();
  for (const s of sales) {
    const key = s.agentName ?? "Unassigned";
    if (!agentGroups.has(key)) agentGroups.set(key, []);
    agentGroups.get(key)!.push(s);
  }

  const agentSections = [...agentGroups.entries()]
    .map(([agent, agentSales]) => buildAgentSection(agent, agentSales, color))
    .join("");

  const lobSections = lobSalesMap && [...lobSalesMap.values()].some((v) => v.length > 0)
    ? `<hr class="divider"/>
       <h3 class="section-title">Other Lines of Business</h3>
       ${[...lobSalesMap.entries()]
         .filter(([, s]) => s.length > 0)
         .map(([lob, s]) => buildLobSalesSection(LOB_LABELS[lob] ?? lob, s, color))
         .join("")}`
    : "";

  const unpaidAlert = totalOwed > 0
    ? `<div class="alert-warn"><strong>⚠ Unpaid Commissions: ${formatCurrency(totalOwed)}</strong> &mdash; ${sales.filter((s) => !s.paid).length} record${sales.filter((s) => !s.paid).length !== 1 ? "s" : ""} pending</div>`
    : `<div class="alert-ok"><strong>✓ All commissions paid</strong></div>`;

  const content = `
    <div class="stat-row">
      <div class="stat-cell">
        <div class="stat-label">Medicare Sales</div>
        <div class="stat-value">${sales.length}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Other LOB</div>
        <div class="stat-value">${lobCount}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Est. Commission</div>
        <div class="stat-value" style="font-size:16px;">${formatCurrency(totalComm)}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Still Owed</div>
        <div class="stat-value" style="font-size:16px;color:#92400e;">${formatCurrency(totalOwed)}</div>
      </div>
    </div>

    ${unpaidAlert}

    <h3 class="section-title">Medicare</h3>
    ${agentGroups.size > 0 ? agentSections : `<p style="color:#999;font-size:13px;">No Medicare sales recorded this week.</p>`}

    ${lobSections}

    ${buildCallLogsSection(callLogs ?? [])}

    <p class="footer">This report was automatically generated by ${name}.</p>`;

  return emailShell(content, color, name, logoHtml);
}

// ---------------------------------------------------------------------------
// Monthly / Annual shared template
// ---------------------------------------------------------------------------
function buildSalesTable(sales: SaleRow[]): string {
  const totalCommission = sales.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const totalHra = sales.reduce((acc, s) => acc + (s.hra ?? 0), 0);

  const rows = sales.map((s) => `
    <tr>
      <td style="white-space:nowrap;font-weight:500;">${s.clientName}</td>
      <td style="white-space:nowrap;">${s.salesSource ?? "—"}</td>
      <td style="white-space:nowrap;">${s.salesType}</td>
      <td style="white-space:nowrap;">${s.soldDate}</td>
      <td style="white-space:nowrap;">${s.commissionType}</td>
      <td style="text-align:right;white-space:nowrap;">${s.hra != null ? formatCurrency(s.hra) : "—"}</td>
      <td style="text-align:right;white-space:nowrap;font-weight:600;">${formatCurrency(s.estimatedCommission)}</td>
    </tr>`).join("");

  return `
    <div class="tbl-wrap" style="margin-top:16px;">
      <table>
        <thead>
          <tr style="background:#1a3c5e;color:#fff;">
            <th style="background:#1a3c5e;color:#fff;">Client</th>
            <th style="background:#1a3c5e;color:#fff;">Source</th>
            <th style="background:#1a3c5e;color:#fff;">Type</th>
            <th style="background:#1a3c5e;color:#fff;">Sold Date</th>
            <th style="background:#1a3c5e;color:#fff;">Commission</th>
            <th style="background:#1a3c5e;color:#fff;text-align:right;">HRA</th>
            <th style="background:#1a3c5e;color:#fff;text-align:right;">Est. Commission</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f5f5f5;font-weight:bold;">
            <td colspan="5" style="padding:8px 10px;">Total</td>
            <td style="padding:8px 10px;text-align:right;">${formatCurrency(totalHra)}</td>
            <td style="padding:8px 10px;text-align:right;">${formatCurrency(totalCommission)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function buildEmailHtml(
  sales: SaleRow[],
  reportTitle: string,
  periodLabel: string,
  footerNote: string,
  branding: BrandingOptions = {}
): string {
  const totalCommission = sales.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const color = branding.brandColor ?? "#1a3c5e";
  const name = branding.brandName ?? "Sales Tracker";
  const logoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${name}" style="height:36px;max-width:180px;object-fit:contain;display:block;margin-bottom:8px;"/>
       <h2 style="color:#fff;margin:0;font-size:18px;">${reportTitle}</h2>
       <p style="color:rgba(255,255,255,0.75);margin:4px 0 0 0;font-size:13px;">${periodLabel}</p>`
    : `<div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:4px;">${name}</div>
       <h2 style="color:#fff;margin:0;font-size:18px;">${reportTitle}</h2>
       <p style="color:rgba(255,255,255,0.75);margin:4px 0 0 0;font-size:13px;">${periodLabel}</p>`;

  const content = `
    <div class="stat-row">
      <div class="stat-cell">
        <div class="stat-label">Total Sales</div>
        <div class="stat-value">${sales.length}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Est. Commission</div>
        <div class="stat-value" style="font-size:16px;">${formatCurrency(totalCommission)}</div>
      </div>
    </div>
    ${buildSalesTable(sales)}
    <p class="footer">${footerNote}</p>`;

  return emailShell(content, color, name, logoHtml);
}

// ---------------------------------------------------------------------------
// Dashboard (monthly/annual) breakdown HTML — kept for completeness
// ---------------------------------------------------------------------------
function buildDashboardHtml(
  sales: SaleRow[],
  reportTitle: string,
  periodLabel: string,
  footerNote: string,
  branding: BrandingOptions = {}
): string {
  const totalCommission = sales.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const totalHra = sales.reduce((acc, s) => acc + (s.hra ?? 0), 0);
  const color = branding.brandColor ?? "#1a3c5e";
  const name = branding.brandName ?? "Sales Tracker";

  const byType: Record<string, { count: number; commission: number }> = {};
  const byCommType: Record<string, { count: number; commission: number }> = {};
  const bySource: Record<string, { count: number; commission: number }> = {};

  for (const s of sales) {
    const comm = s.estimatedCommission ?? 0;
    byType[s.salesType] = byType[s.salesType] ?? { count: 0, commission: 0 };
    byType[s.salesType].count++;
    byType[s.salesType].commission += comm;
    byCommType[s.commissionType] = byCommType[s.commissionType] ?? { count: 0, commission: 0 };
    byCommType[s.commissionType].count++;
    byCommType[s.commissionType].commission += comm;
    const src = s.salesSource ?? "Not Specified";
    bySource[src] = bySource[src] ?? { count: 0, commission: 0 };
    bySource[src].count++;
    bySource[src].commission += comm;
  }

  const breakdownTable = (title: string, data: Record<string, { count: number; commission: number }>) => {
    const rows = Object.entries(data)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([label, { count, commission }]) => `
        <tr>
          <td>${label}</td>
          <td style="text-align:center;font-weight:600;color:#1a3c5e;">${count}</td>
          <td style="text-align:right;font-weight:600;color:#059669;">${formatCurrency(commission)}</td>
        </tr>`).join("");
    return `
      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:#374151;padding-bottom:6px;border-bottom:1px solid #e5e7eb;margin-bottom:0;">${title}</div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Category</th><th style="text-align:center;">Sales</th><th style="text-align:right;">Commission</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  };

  const logoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${name}" style="height:36px;max-width:180px;object-fit:contain;display:block;margin-bottom:8px;"/>
       <h2 style="color:#fff;margin:0;font-size:18px;">${reportTitle}</h2>
       <p style="color:rgba(255,255,255,0.75);margin:4px 0 0 0;font-size:13px;">${periodLabel}</p>`
    : `<div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:4px;">${name}</div>
       <h2 style="color:#fff;margin:0;font-size:18px;">${reportTitle}</h2>
       <p style="color:rgba(255,255,255,0.75);margin:4px 0 0 0;font-size:13px;">${periodLabel}</p>`;

  const content = `
    <div class="stat-row">
      <div class="stat-cell">
        <div class="stat-label">Total Sales</div>
        <div class="stat-value">${sales.length}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Est. Commission</div>
        <div class="stat-value" style="font-size:16px;">${formatCurrency(totalCommission)}</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Total HRA</div>
        <div class="stat-value" style="font-size:16px;">${formatCurrency(totalHra)}</div>
      </div>
    </div>

    ${breakdownTable("By Sale Type", byType)}
    ${breakdownTable("By Commission Type", byCommType)}
    ${breakdownTable("By Sales Source", bySource)}

    <hr class="divider"/>
    <h3 class="section-title">All Sales</h3>
    ${buildSalesTable(sales)}
    <p class="footer">${footerNote}</p>`;

  return emailShell(content, color, name, logoHtml);
}

// ---------------------------------------------------------------------------
// Email sender
// ---------------------------------------------------------------------------
async function sendEmail(
  subject: string,
  html: string,
  text: string,
  recipients: string[],
  logContext: Record<string, unknown>
): Promise<void> {
  logger.info({ ...logContext, recipients }, "Sending report email");
  const transporter = getTransporter();
  if (!transporter) {
    logger.info({ subject, html }, "Email not sent (no SMTP config) — content logged");
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: recipients.join(", "),
    subject,
    text,
    html,
  });
  logger.info({ ...logContext, recipients }, "Report email sent successfully");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function sendWeeklyReport(
  sales: SaleRow[],
  weekStart: string,
  weekEnd: string,
  recipients: string[] = DEFAULT_RECIPIENTS,
  branding: BrandingOptions = {},
  lobSalesMap?: Map<string, LobSaleRow[]>,
  callLogs?: CallLogRow[]
): Promise<void> {
  const name = branding.brandName ?? "Sales Tracker";
  const subject = `${name} — Weekly Sales Report — Week of ${weekStart}`;
  const html = buildWeeklyReportHtml(sales, weekStart, weekEnd, branding, lobSalesMap, callLogs);
  const totalOwed = sales.filter((s) => !s.paid).reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const lobCount = lobSalesMap ? [...lobSalesMap.values()].reduce((a, b) => a + b.length, 0) : 0;
  const text = `Weekly Sales Report for ${weekStart} – ${weekEnd}\n\nMedicare Sales: ${sales.length}\nOther LOB Sales: ${lobCount}\nTotal Owed: $${totalOwed.toFixed(2)}\nCalls Logged: ${callLogs?.length ?? 0}`;
  await sendEmail(subject, html, text, recipients, { weekStart, weekEnd, totalSales: sales.length + lobCount });
}

export async function sendMonthlyReport(
  sales: SaleRow[],
  monthLabel: string,
  periodStart: string,
  periodEnd: string,
  recipients: string[] = DEFAULT_RECIPIENTS,
  branding: BrandingOptions = {}
): Promise<void> {
  const name = branding.brandName ?? "Sales Tracker";
  const subject = `${name} — Monthly Report — ${monthLabel}`;
  const html = buildDashboardHtml(
    sales,
    `Monthly Report — ${monthLabel}`,
    `${periodStart} through ${periodEnd}`,
    `This report was automatically generated by ${name}.`,
    branding
  );
  const text = `Monthly Sales Report — ${monthLabel}\n\nTotal Sales: ${sales.length}`;
  await sendEmail(subject, html, text, recipients, { monthLabel, totalSales: sales.length });
}

export async function sendAnnualReport(
  sales: SaleRow[],
  yearLabel: string,
  periodStart: string,
  periodEnd: string,
  recipients: string[] = DEFAULT_RECIPIENTS,
  branding: BrandingOptions = {}
): Promise<void> {
  const name = branding.brandName ?? "Sales Tracker";
  const subject = `${name} — Annual Report — ${yearLabel}`;
  const html = buildDashboardHtml(
    sales,
    `Annual Report — ${yearLabel}`,
    `${periodStart} through ${periodEnd}`,
    `This report was automatically generated by ${name}.`,
    branding
  );
  const text = `Annual Sales Report — ${yearLabel}\n\nTotal Sales: ${sales.length}`;
  await sendEmail(subject, html, text, recipients, { yearLabel, totalSales: sales.length });
}
