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

function buildLobSalesSection(lobLabel: string, sales: LobSaleRow[], headerColor: string): string {
  const total = sales.reduce((acc, s) => acc + (s.revenue ?? 0), 0);
  const fmt = (v: number | null) =>
    v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  const isAncillary = lobLabel === "Ancillary";

  const rows = sales
    .map(
      (s) => `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;">${s.clientName}</td>
        ${isAncillary ? `<td style="padding:7px 10px;border-bottom:1px solid #eee;">${s.ancillaryType ?? "—"}</td>` : ""}
        <td style="padding:7px 10px;border-bottom:1px solid #eee;">${s.carrier ?? "—"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;">${s.soldDate}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;">${fmt(s.revenue)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;color:#6b7280;">${s.notes ?? ""}</td>
      </tr>
    `
    )
    .join("");

  return `
    <div style="margin-bottom:28px;">
      <div style="background:${headerColor}18;border-left:4px solid ${headerColor};padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:10px;">
        <span style="font-weight:700;font-size:15px;color:#1a3c5e;">${lobLabel}</span>
        <span style="margin-left:12px;font-size:13px;color:#6b7280;">${sales.length} sale${sales.length !== 1 ? "s" : ""}</span>
        <span style="float:right;font-size:13px;font-weight:600;color:#059669;">Total: ${fmt(total)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Client</th>
            ${isAncillary ? `<th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Type</th>` : ""}
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Carrier</th>
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Date</th>
            <th style="padding:7px 10px;text-align:right;font-weight:600;color:#374151;">Revenue</th>
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function formatCurrency(val: number | null): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

function buildSalesTable(sales: SaleRow[]): string {
  const totalCommission = sales.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const totalHra = sales.reduce((acc, s) => acc + (s.hra ?? 0), 0);

  const rows = sales
    .map(
      (s) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.clientName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.salesSource ?? ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.salesType}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.soldDate}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.effectiveDate ?? ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.leadSource ?? ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.commissionType}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${s.hra != null ? formatCurrency(s.hra) : "None"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(s.estimatedCommission)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.comments ?? ""}</td>
      </tr>
    `
    )
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
      <thead>
        <tr style="background:#1a3c5e;color:#fff;">
          <th style="padding:10px 12px;text-align:left;">Client Name</th>
          <th style="padding:10px 12px;text-align:left;">Sales Source</th>
          <th style="padding:10px 12px;text-align:left;">Sales Type</th>
          <th style="padding:10px 12px;text-align:left;">Sold Date</th>
          <th style="padding:10px 12px;text-align:left;">Eff. Date</th>
          <th style="padding:10px 12px;text-align:left;">Lead Source</th>
          <th style="padding:10px 12px;text-align:left;">Commission Type</th>
          <th style="padding:10px 12px;text-align:right;">HRA</th>
          <th style="padding:10px 12px;text-align:right;">Est. Commission</th>
          <th style="padding:10px 12px;text-align:left;">Comments</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f5f5f5;font-weight:bold;">
          <td colspan="7" style="padding:10px 12px;">Total</td>
          <td style="padding:10px 12px;text-align:right;">${formatCurrency(totalHra)}</td>
          <td style="padding:10px 12px;text-align:right;">${formatCurrency(totalCommission)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  `;
}

export interface BrandingOptions {
  brandName?: string;
  brandColor?: string;
  logoUrl?: string | null;
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
    ? `<img src="${branding.logoUrl}" alt="${name}" style="height:40px;max-width:200px;object-fit:contain;display:block;margin-bottom:8px;" />`
    : `<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:4px;">${name}</div>`;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"/></head>
    <body style="font-family:Arial,sans-serif;color:#333;margin:0;padding:0;">
      <div style="max-width:960px;margin:32px auto;padding:0;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
        <div style="background:${color};padding:24px 28px;">
          ${logoHtml}
          <h2 style="color:#fff;margin:0;font-size:20px;">${reportTitle}</h2>
          <p style="color:rgba(255,255,255,0.75);margin:4px 0 0 0;font-size:14px;">${periodLabel}</p>
        </div>
        <div style="padding:24px 28px;">
          <p><strong>Total Sales:</strong> ${sales.length} &nbsp;&nbsp; <strong>Est. Total Commission:</strong> ${formatCurrency(totalCommission)}</p>
          ${buildSalesTable(sales)}
          <p style="color:#999;font-size:12px;margin-top:24px;">${footerNote}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

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

function buildAgentSection(agentLabel: string, sales: SaleRow[], headerColor: string): string {
  const paid = sales.filter((s) => s.paid);
  const unpaid = sales.filter((s) => !s.paid);
  const totalComm = sales.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const paidComm = paid.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const owedComm = unpaid.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);

  const rows = sales
    .map(
      (s) => `
      <tr style="background:${s.paid ? "#f0fdf4" : "#fffbeb"};">
        <td style="padding:7px 10px;border-bottom:1px solid #eee;">${s.clientName}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;">${s.salesSource ?? ""}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;">${s.salesType}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;">${s.soldDate}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;">${s.commissionType}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;">${s.hra != null ? formatCurrency(s.hra) : "None"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(s.estimatedCommission)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${s.paid ? "#dcfce7" : "#fef3c7"};color:${s.paid ? "#166534" : "#92400e"};">
            ${s.paid ? "Paid" : "Unpaid"}
          </span>
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <div style="margin-bottom:28px;">
      <div style="background:${headerColor}18;border-left:4px solid ${headerColor};padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:10px;">
        <span style="font-weight:700;font-size:15px;color:#1a3c5e;">${agentLabel}</span>
        <span style="margin-left:12px;font-size:13px;color:#6b7280;">${sales.length} sale${sales.length !== 1 ? "s" : ""}</span>
        <span style="float:right;font-size:13px;">
          <span style="color:#166534;font-weight:600;">Paid: ${formatCurrency(paidComm)}</span>
          &nbsp;&nbsp;
          <span style="color:#92400e;font-weight:600;">Owed: ${formatCurrency(owedComm)}</span>
          &nbsp;&nbsp;
          <span style="color:#374151;">Total: ${formatCurrency(totalComm)}</span>
        </span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Client</th>
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Source</th>
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Type</th>
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Sold Date</th>
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Commission Type</th>
            <th style="padding:7px 10px;text-align:right;font-weight:600;color:#374151;">HRA</th>
            <th style="padding:7px 10px;text-align:right;font-weight:600;color:#374151;">Est. Commission</th>
            <th style="padding:7px 10px;text-align:center;font-weight:600;color:#374151;">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

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
  const contactRate = callLogs.length > 0 ? Math.round(((counts.contacted) / callLogs.length) * 100) : 0;

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
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-weight:500;">${l.clientName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${color}18;color:${color};">${label}</span>
        </td>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:12px;">${l.callDate}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:12px;">${l.notes ?? ""}</td>
      </tr>`;
    }).join("");

    return `
      <div style="margin-top:16px;">
        <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e5e7eb;">
          ${agent} &mdash; ${logs.length} call${logs.length !== 1 ? "s" : ""}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:5px 10px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Client</th>
              <th style="padding:5px 10px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Type</th>
              <th style="padding:5px 10px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Date</th>
              <th style="padding:5px 10px;text-align:left;font-weight:600;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Notes</th>
            </tr>
          </thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>`;
  }).join("");

  return `
    <div style="margin-top:28px;border-top:2px solid #e5e7eb;padding-top:24px;">
      <h3 style="font-size:16px;font-weight:700;color:#1a3c5e;margin:0 0 8px 0;">Call Activity</h3>
      <p style="color:#6b7280;font-size:13px;margin:0 0 16px 0;">
        ${callLogs.length} total &nbsp;|&nbsp; ${counts.contacted} contacted &nbsp;|&nbsp; ${counts.voicemail} voicemails &nbsp;|&nbsp; ${counts.text_message} texts &nbsp;|&nbsp; ${counts.no_answer} no answer &nbsp;|&nbsp; <strong>${contactRate}% contact rate</strong>
      </p>
      ${agentSections}
    </div>
  `;
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
    ? `<img src="${branding.logoUrl}" alt="${name}" style="height:40px;max-width:200px;object-fit:contain;display:block;margin-bottom:8px;" />`
    : `<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:4px;">${name}</div>`;

  const totalComm = sales.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const totalOwed = sales.filter((s) => !s.paid).reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);

  const agentGroups = new Map<string, SaleRow[]>();
  for (const s of sales) {
    const key = s.agentName ?? "Unassigned";
    if (!agentGroups.has(key)) agentGroups.set(key, []);
    agentGroups.get(key)!.push(s);
  }

  const agentSections = [...agentGroups.entries()]
    .map(([agent, agentSales]) => buildAgentSection(agent, agentSales, color))
    .join("");

  const lobSections =
    lobSalesMap && lobSalesMap.size > 0
      ? `<div style="margin-top:28px;border-top:2px solid #e5e7eb;padding-top:24px;">
          <h3 style="font-size:16px;font-weight:700;color:#1a3c5e;margin:0 0 18px 0;">Other Lines of Business</h3>
          ${[...lobSalesMap.entries()]
            .filter(([, sales]) => sales.length > 0)
            .map(([lob, sales]) => buildLobSalesSection(LOB_LABELS[lob] ?? lob, sales, color))
            .join("")}
        </div>`
      : "";

  const unpaidAlert = totalOwed > 0
    ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
        <strong style="color:#92400e;">⚠ Unpaid Commissions: ${formatCurrency(totalOwed)}</strong>
        <span style="color:#92400e;font-size:13px;"> — ${sales.filter(s => !s.paid).length} record${sales.filter(s => !s.paid).length !== 1 ? "s" : ""} still pending payment</span>
      </div>`
    : `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
        <strong style="color:#166534;">✓ All commissions paid</strong>
      </div>`;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"/></head>
    <body style="font-family:Arial,sans-serif;color:#333;margin:0;padding:0;">
      <div style="max-width:960px;margin:32px auto;padding:0;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
        <div style="background:${color};padding:24px 28px;">
          ${logoHtml}
          <h2 style="color:#fff;margin:0;font-size:20px;">Weekly Sales Report</h2>
          <p style="color:rgba(255,255,255,0.75);margin:4px 0 0 0;font-size:14px;">Week of <strong>${weekStart}</strong> through <strong>${weekEnd}</strong></p>
        </div>
        <div style="padding:24px 28px;">
          <p style="margin-bottom:16px;">
            <strong>Total Sales:</strong> ${sales.length} &nbsp;&nbsp;
            <strong>Est. Total Commission:</strong> ${formatCurrency(totalComm)} &nbsp;&nbsp;
            <strong>Total Owed:</strong> <span style="color:#92400e;">${formatCurrency(totalOwed)}</span>
          </p>
          ${unpaidAlert}
          <div style="margin-bottom:8px;"><h3 style="font-size:16px;font-weight:700;color:#1a3c5e;margin:0 0 12px 0;">Medicare</h3>
          ${agentGroups.size > 0 ? agentSections : "<p style=\"color:#999;\">No Medicare sales recorded this week.</p>"}</div>
          ${lobSections}
          ${buildCallLogsSection(callLogs ?? [])}
          <p style="color:#999;font-size:12px;margin-top:24px;">This report was automatically generated and sent by ${name}.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

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
  const totalOwed = sales.filter(s => !s.paid).reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const lobCount = lobSalesMap ? [...lobSalesMap.values()].reduce((a, b) => a + b.length, 0) : 0;
  const text = `Weekly Sales Report for ${weekStart} – ${weekEnd}\n\nMedicare Sales: ${sales.length}\nOther LOB Sales: ${lobCount}\nTotal Owed: $${totalOwed.toFixed(2)}\nCalls Logged: ${callLogs?.length ?? 0}`;
  await sendEmail(subject, html, text, recipients, { weekStart, weekEnd, totalSales: sales.length + lobCount });
}

function buildDashboardHtml(
  sales: SaleRow[],
  reportTitle: string,
  periodLabel: string,
  footerNote: string,
  branding: BrandingOptions = {}
): string {
  const totalCommission = sales.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);
  const totalHra = sales.reduce((acc, s) => acc + (s.hra ?? 0), 0);

  // Breakdowns
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

  const statCard = (label: string, value: string) => `
    <td style="width:33%;padding:0 8px;">
      <div style="background:#f0f4f8;border-radius:8px;padding:20px 16px;text-align:center;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:6px;">${label}</div>
        <div style="font-size:26px;font-weight:700;color:#1a3c5e;">${value}</div>
      </div>
    </td>`;

  const breakdownRows = (data: Record<string, { count: number; commission: number }>) =>
    Object.entries(data)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([label, { count, commission }]) => `
        <tr>
          <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;color:#374151;">${label}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:600;color:#1a3c5e;">${count}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#059669;">${formatCurrency(commission)}</td>
        </tr>`).join("");

  const breakdownTable = (title: string, data: Record<string, { count: number; commission: number }>) => `
    <div style="margin-bottom:24px;">
      <h3 style="font-size:14px;font-weight:700;color:#1a3c5e;margin:0 0 10px 0;text-transform:uppercase;letter-spacing:0.06em;">${title}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        <thead>
          <tr style="background:#1a3c5e;color:#fff;">
            <th style="padding:9px 12px;text-align:left;font-weight:600;">Category</th>
            <th style="padding:9px 12px;text-align:center;font-weight:600;"># Sales</th>
            <th style="padding:9px 12px;text-align:right;font-weight:600;">Est. Commission</th>
          </tr>
        </thead>
        <tbody>${breakdownRows(data)}</tbody>
      </table>
    </div>`;

  const headerColor = branding.brandColor ?? "#1a3c5e";
  const agencyName = branding.brandName ?? "Sales Tracker";
  const logoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${agencyName}" style="height:36px;max-width:180px;object-fit:contain;display:block;margin-bottom:10px;" />`
    : `<div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);margin-bottom:6px;letter-spacing:0.04em;">${agencyName}</div>`;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"/></head>
    <body style="font-family:Arial,sans-serif;color:#333;margin:0;padding:0;background:#f9fafb;">
      <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">

        <!-- Header -->
        <div style="background:${headerColor};padding:28px 32px;">
          ${logoHtml}
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">${reportTitle}</h1>
          <p style="color:rgba(255,255,255,0.65);margin:6px 0 0 0;font-size:14px;">${periodLabel}</p>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px;">

          <!-- Key stats -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
            <tr>
              ${statCard("Total Sales", String(sales.length))}
              ${statCard("Est. Commission", formatCurrency(totalCommission))}
              ${statCard("Total HRA", totalHra > 0 ? formatCurrency(totalHra) : "None")}
            </tr>
          </table>

          <!-- Breakdowns -->
          ${breakdownTable("By Sales Type", byType)}
          ${breakdownTable("By Commission Type", byCommType)}
          ${breakdownTable("By Sales Source", bySource)}

        </div>

        <!-- Footer -->
        <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">${footerNote}</p>
        </div>

      </div>
    </body>
    </html>
  `;
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
  const subject = `${name} — Monthly Sales Report — ${monthLabel}`;
  const html = buildDashboardHtml(
    sales,
    `Monthly Sales Report — ${monthLabel}`,
    `${periodStart} &nbsp;through&nbsp; ${periodEnd}`,
    `This monthly summary was automatically generated and sent by ${name}.`,
    branding
  );
  const text = `Monthly Sales Report for ${monthLabel}\n\nTotal Sales: ${sales.length}\nEst. Commission: ${sales.reduce((a, s) => a + (s.estimatedCommission ?? 0), 0).toFixed(2)}`;
  await sendEmail(subject, html, text, recipients, { monthLabel, periodStart, periodEnd, totalSales: sales.length });
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
  const subject = `${name} — Annual Sales Report — ${yearLabel}`;
  const html = buildDashboardHtml(
    sales,
    `Annual Sales Report — ${yearLabel}`,
    `Full year &nbsp;${periodStart}&nbsp; through&nbsp;${periodEnd}`,
    `This annual summary was automatically generated and sent by ${name}.`,
    branding
  );
  const text = `Annual Sales Report for ${yearLabel}\n\nTotal Sales: ${sales.length}\nEst. Commission: ${sales.reduce((a, s) => a + (s.estimatedCommission ?? 0), 0).toFixed(2)}`;
  await sendEmail(subject, html, text, recipients, { yearLabel, periodStart, periodEnd, totalSales: sales.length });
}
