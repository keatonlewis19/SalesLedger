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

function buildEmailHtml(
  sales: SaleRow[],
  reportTitle: string,
  periodLabel: string,
  footerNote: string
): string {
  const totalCommission = sales.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"/></head>
    <body style="font-family:Arial,sans-serif;color:#333;margin:0;padding:0;">
      <div style="max-width:960px;margin:32px auto;padding:24px;border:1px solid #ddd;border-radius:8px;">
        <h2 style="color:#1a3c5e;margin-top:0;">${reportTitle}</h2>
        <p style="color:#555;">${periodLabel}</p>
        <p><strong>Total Sales:</strong> ${sales.length} &nbsp;&nbsp; <strong>Est. Total Commission:</strong> ${formatCurrency(totalCommission)}</p>
        ${buildSalesTable(sales)}
        <p style="color:#999;font-size:12px;margin-top:24px;">${footerNote}</p>
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

export async function sendWeeklyReport(
  sales: SaleRow[],
  weekStart: string,
  weekEnd: string,
  recipients: string[] = DEFAULT_RECIPIENTS
): Promise<void> {
  const subject = `Weekly Sales Report — Week of ${weekStart}`;
  const html = buildEmailHtml(
    sales,
    "Weekly Sales Report",
    `Week of <strong>${weekStart}</strong> through <strong>${weekEnd}</strong>`,
    "This report was automatically generated and sent by the Sales Tracker."
  );
  const text = `Weekly Sales Report for ${weekStart} – ${weekEnd}\n\nTotal Sales: ${sales.length}`;
  await sendEmail(subject, html, text, recipients, { weekStart, weekEnd, totalSales: sales.length });
}

function buildDashboardHtml(
  sales: SaleRow[],
  reportTitle: string,
  periodLabel: string,
  footerNote: string
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

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"/></head>
    <body style="font-family:Arial,sans-serif;color:#333;margin:0;padding:0;background:#f9fafb;">
      <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">

        <!-- Header -->
        <div style="background:#1a3c5e;padding:28px 32px;">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">${reportTitle}</h1>
          <p style="color:#93c5fd;margin:6px 0 0 0;font-size:14px;">${periodLabel}</p>
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
  recipients: string[] = DEFAULT_RECIPIENTS
): Promise<void> {
  const subject = `Monthly Sales Report — ${monthLabel}`;
  const html = buildDashboardHtml(
    sales,
    `Monthly Sales Report — ${monthLabel}`,
    `${periodStart} &nbsp;through&nbsp; ${periodEnd}`,
    "This monthly summary was automatically generated and sent by the Sales Tracker."
  );
  const text = `Monthly Sales Report for ${monthLabel}\n\nTotal Sales: ${sales.length}\nEst. Commission: ${sales.reduce((a, s) => a + (s.estimatedCommission ?? 0), 0).toFixed(2)}`;
  await sendEmail(subject, html, text, recipients, { monthLabel, periodStart, periodEnd, totalSales: sales.length });
}

export async function sendAnnualReport(
  sales: SaleRow[],
  yearLabel: string,
  periodStart: string,
  periodEnd: string,
  recipients: string[] = DEFAULT_RECIPIENTS
): Promise<void> {
  const subject = `Annual Sales Report — ${yearLabel}`;
  const html = buildDashboardHtml(
    sales,
    `Annual Sales Report — ${yearLabel}`,
    `Full year &nbsp;${periodStart}&nbsp; through&nbsp;${periodEnd}`,
    "This annual summary was automatically generated and sent by the Sales Tracker."
  );
  const text = `Annual Sales Report for ${yearLabel}\n\nTotal Sales: ${sales.length}\nEst. Commission: ${sales.reduce((a, s) => a + (s.estimatedCommission ?? 0), 0).toFixed(2)}`;
  await sendEmail(subject, html, text, recipients, { yearLabel, periodStart, periodEnd, totalSales: sales.length });
}
