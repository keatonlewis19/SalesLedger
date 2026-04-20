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
  owningAgent: string;
  salesType: string;
  soldDate: string;
  effectiveDate: string | null;
  commissionType: string;
  leadSource: string | null;
  hra: number | null;
  estimatedCommission: number | null;
  notes: string | null;
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
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.owningAgent}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.salesType}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.soldDate}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.effectiveDate ?? ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.leadSource ?? ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.commissionType}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(s.hra)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(s.estimatedCommission)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.notes ?? ""}</td>
      </tr>
    `
    )
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
      <thead>
        <tr style="background:#1a3c5e;color:#fff;">
          <th style="padding:10px 12px;text-align:left;">Client Name</th>
          <th style="padding:10px 12px;text-align:left;">Owning Agent</th>
          <th style="padding:10px 12px;text-align:left;">Sales Type</th>
          <th style="padding:10px 12px;text-align:left;">Sold Date</th>
          <th style="padding:10px 12px;text-align:left;">Eff. Date</th>
          <th style="padding:10px 12px;text-align:left;">Lead Source</th>
          <th style="padding:10px 12px;text-align:left;">Commission Type</th>
          <th style="padding:10px 12px;text-align:right;">HRA</th>
          <th style="padding:10px 12px;text-align:right;">Est. Commission</th>
          <th style="padding:10px 12px;text-align:left;">Notes</th>
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

export async function sendMonthlyReport(
  sales: SaleRow[],
  monthLabel: string,
  periodStart: string,
  periodEnd: string,
  recipients: string[] = DEFAULT_RECIPIENTS
): Promise<void> {
  const subject = `Monthly Sales Report — ${monthLabel}`;
  const html = buildEmailHtml(
    sales,
    `Monthly Sales Report — ${monthLabel}`,
    `Period: <strong>${periodStart}</strong> through <strong>${periodEnd}</strong>`,
    "This monthly report was automatically generated and sent by the Sales Tracker."
  );
  const text = `Monthly Sales Report for ${monthLabel}\n\nTotal Sales: ${sales.length}`;
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
  const html = buildEmailHtml(
    sales,
    `Annual Sales Report — ${yearLabel}`,
    `Period: <strong>${periodStart}</strong> through <strong>${periodEnd}</strong>`,
    "This annual report was automatically generated and sent by the Sales Tracker."
  );
  const text = `Annual Sales Report for ${yearLabel}\n\nTotal Sales: ${sales.length}`;
  await sendEmail(subject, html, text, recipients, { yearLabel, periodStart, periodEnd, totalSales: sales.length });
}
