import cron from "node-cron";
import { db, salesTable, weeklyReportsTable } from "@workspace/db";
import { gte, lte, and } from "drizzle-orm";
import { sendWeeklyReport, RECIPIENTS, type SaleRow } from "./email";
import { logger } from "./logger";

/**
 * Week runs Friday → Thursday.
 * Given any date, returns the Friday that starts that week and the Thursday that ends it.
 */
function getWeekBounds(date: Date): { weekStart: string; weekEnd: string } {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat

  // Days back to the most recent Friday
  const daysBackToFriday = (dayOfWeek - 5 + 7) % 7;

  const friday = new Date(d);
  friday.setDate(d.getDate() - daysBackToFriday);

  const thursday = new Date(friday);
  thursday.setDate(friday.getDate() + 6);

  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { weekStart: fmt(friday), weekEnd: fmt(thursday) };
}

export function getCurrentWeekBounds() {
  return getWeekBounds(new Date());
}

/**
 * Given a sold date string (YYYY-MM-DD), returns the weekStart (Friday) for that week.
 */
export function getWeekStartForDate(soldDate: string): string {
  const d = new Date(soldDate + "T12:00:00Z"); // noon UTC to avoid timezone edge cases
  return getWeekBounds(d).weekStart;
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
  // Thursday at 5:00 PM (17:00) — cron: "0 17 * * 4"
  cron.schedule("0 17 * * 4", async () => {
    logger.info("Scheduled Thursday 5pm report triggered");
    try {
      await runWeeklyReport();
    } catch (err) {
      logger.error({ err }, "Error running scheduled weekly report");
    }
  });

  logger.info("Weekly report scheduler started (Thursdays at 5:00 PM)");
}
