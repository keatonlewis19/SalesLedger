import nodemailer from "nodemailer";
import { logger } from "./logger";

const RECIPIENTS = ["rauni@crmgrp.com", "chad@crmgrp.com"];

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
  commissionType: string;
  estimatedCommission: number | null;
  notes: string | null;
}

function formatCurrency(val: number | null): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

function buildEmailHtml(sales: SaleRow[], weekStart: string, weekEnd: string): string {
  const totalCommission = sales.reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0);

  const rows = sales
    .map(
      (s) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.clientName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.owningAgent}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.salesType}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.soldDate}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.commissionType}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(s.estimatedCommission)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${s.notes ?? ""}</td>
      </tr>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"/></head>
    <body style="font-family:Arial,sans-serif;color:#333;margin:0;padding:0;">
      <div style="max-width:900px;margin:32px auto;padding:24px;border:1px solid #ddd;border-radius:8px;">
        <h2 style="color:#1a3c5e;margin-top:0;">Weekly Sales Report</h2>
        <p style="color:#555;">Week of <strong>${weekStart}</strong> through <strong>${weekEnd}</strong></p>
        <p><strong>Total Sales:</strong> ${sales.length} &nbsp;&nbsp; <strong>Est. Total Commission:</strong> ${formatCurrency(totalCommission)}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
          <thead>
            <tr style="background:#1a3c5e;color:#fff;">
              <th style="padding:10px 12px;text-align:left;">Client Name</th>
              <th style="padding:10px 12px;text-align:left;">Owning Agent</th>
              <th style="padding:10px 12px;text-align:left;">Sales Type</th>
              <th style="padding:10px 12px;text-align:left;">Sold Date</th>
              <th style="padding:10px 12px;text-align:left;">Commission Type</th>
              <th style="padding:10px 12px;text-align:right;">Est. Commission</th>
              <th style="padding:10px 12px;text-align:left;">Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:#f5f5f5;font-weight:bold;">
              <td colspan="5" style="padding:10px 12px;">Total</td>
              <td style="padding:10px 12px;text-align:right;">${formatCurrency(totalCommission)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <p style="color:#999;font-size:12px;margin-top:24px;">This report was automatically generated and sent by the Weekly Sales Tracker.</p>
      </div>
    </body>
    </html>
  `;
}

export async function sendWeeklyReport(
  sales: SaleRow[],
  weekStart: string,
  weekEnd: string
): Promise<void> {
  const subject = `Weekly Sales Report — Week of ${weekStart}`;
  const html = buildEmailHtml(sales, weekStart, weekEnd);
  const text = `Weekly Sales Report for ${weekStart} – ${weekEnd}\n\nTotal Sales: ${sales.length}\nSee attached HTML for full details.`;

  logger.info({ recipients: RECIPIENTS, weekStart, weekEnd, totalSales: sales.length }, "Sending weekly report email");

  const transporter = getTransporter();
  if (!transporter) {
    logger.info({ subject, html }, "Email not sent (no SMTP config) — content logged");
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: RECIPIENTS.join(", "),
    subject,
    text,
    html,
  });

  logger.info({ recipients: RECIPIENTS }, "Weekly report email sent successfully");
}

export { RECIPIENTS };
