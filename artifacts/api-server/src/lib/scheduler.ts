import cron from "node-cron";
import { db, salesTable, weeklyReportsTable } from "@workspace/db";
import { eq, gte, lte, and, sql } from "drizzle-orm";
import { sendWeeklyReport, RECIPIENTS, type SaleRow } from "./email";
import { logger } from "./logger";

function getWeekBounds(date: Date): { weekStart: string; weekEnd: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToSunday = day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - diffToSunday);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { weekStart: fmt(sunday), weekEnd: fmt(saturday) };
}

export function getCurrentWeekBounds() {
  return getWeekBounds(new Date());
}

export async function runWeeklyReport(): Promise<{ reportId: number; totalSales: number }> {
  const { weekStart, weekEnd } = getCurrentWeekBounds();

  logger.info({ weekStart, weekEnd }, "Running weekly sales report");

  const sales = await db
    .select()
    .from(salesTable)
    .where(
      and(
        gte(salesTable.soldDate, weekStart),
        lte(salesTable.soldDate, weekEnd)
      )
    );

  const saleRows: SaleRow[] = sales.map((s) => ({
    clientName: s.clientName,
    owningAgent: s.owningAgent,
    salesType: s.salesType,
    soldDate: s.soldDate,
    commissionType: s.commissionType,
    estimatedCommission: s.estimatedCommission ?? null,
    notes: s.notes ?? null,
  }));

  const totalEstimatedCommission = saleRows.reduce(
    (acc, s) => acc + (s.estimatedCommission ?? 0),
    0
  );

  await sendWeeklyReport(saleRows, weekStart, weekEnd);

  const [report] = await db
    .insert(weeklyReportsTable)
    .values({
      weekStart,
      weekEnd,
      totalSales: sales.length,
      totalEstimatedCommission,
      recipients: RECIPIENTS.join(", "),
    })
    .returning();

  logger.info({ reportId: report.id, totalSales: sales.length }, "Weekly report saved");

  return { reportId: report.id, totalSales: sales.length };
}

export function startScheduler(): void {
  // Saturday at 5:00 PM (17:00) — cron: "0 17 * * 6"
  cron.schedule("0 17 * * 6", async () => {
    logger.info("Scheduled Saturday 5pm report triggered");
    try {
      await runWeeklyReport();
    } catch (err) {
      logger.error({ err }, "Error running scheduled weekly report");
    }
  });

  logger.info("Weekly report scheduler started (Saturdays at 5:00 PM)");
}
