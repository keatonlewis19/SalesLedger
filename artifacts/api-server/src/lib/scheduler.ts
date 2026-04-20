import cron from "node-cron";
import { db, salesTable, weeklyReportsTable } from "@workspace/db";
import { gte, lte, and } from "drizzle-orm";
import { sendWeeklyReport, sendMonthlyReport, sendAnnualReport, type SaleRow } from "./email";
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

/** Returns YYYY-MM-DD for a local date */
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns the first business day (Mon–Fri) on or after the 1st of the given month.
 * month is 0-indexed (0 = January).
 */
function firstBusinessDayOfMonth(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = first.getDay(); // 0=Sun, 6=Sat
  if (dow === 0) first.setDate(2); // Sunday → Monday
  if (dow === 6) first.setDate(3); // Saturday → Monday
  return first;
}

/**
 * Returns the first business day on or after January 1st of the given year.
 */
function firstBusinessDayOfYear(year: number): Date {
  return firstBusinessDayOfMonth(year, 0);
}

/** True if `date` falls on the first business day of its month */
function isFirstBusinessDayOfMonth(date: Date): boolean {
  const target = firstBusinessDayOfMonth(date.getFullYear(), date.getMonth());
  return fmtDate(date) === fmtDate(target);
}

/** True if `date` falls on the first business day of its year AND the month is January */
function isFirstBusinessDayOfYear(date: Date): boolean {
  if (date.getMonth() !== 0) return false; // must be January
  const target = firstBusinessDayOfYear(date.getFullYear());
  return fmtDate(date) === fmtDate(target);
}

function toSaleRows(sales: typeof salesTable.$inferSelect[]): SaleRow[] {
  return sales.map((s) => ({
    clientName: s.clientName,
    salesSource: s.salesSource ?? null,
    salesType: s.salesType,
    soldDate: s.soldDate,
    effectiveDate: s.effectiveDate ?? null,
    commissionType: s.commissionType,
    leadSource: s.leadSource ?? null,
    hra: s.hra ?? null,
    estimatedCommission: s.estimatedCommission ?? null,
    comments: s.notes ?? null,
  }));
}

export async function runWeeklyReport(): Promise<{ reportId: number; totalSales: number }> {
  const { weekStart, weekEnd } = getCurrentWeekBounds();

  logger.info({ weekStart, weekEnd }, "Running weekly sales report");

  const { getOrCreateSettings } = await import("../routes/settings");
  const settings = await getOrCreateSettings();
  const recipients = settings.recipients;

  const sales = await db
    .select()
    .from(salesTable)
    .where(
      and(
        gte(salesTable.soldDate, weekStart),
        lte(salesTable.soldDate, weekEnd)
      )
    );

  const saleRows = toSaleRows(sales);

  const totalEstimatedCommission = saleRows.reduce(
    (acc, s) => acc + (s.estimatedCommission ?? 0),
    0
  );

  await sendWeeklyReport(saleRows, weekStart, weekEnd, recipients);

  const [report] = await db
    .insert(weeklyReportsTable)
    .values({
      weekStart,
      weekEnd,
      totalSales: sales.length,
      totalEstimatedCommission,
      recipients: recipients.join(", "),
    })
    .returning();

  logger.info({ reportId: report.id, totalSales: sales.length }, "Weekly report saved");

  return { reportId: report.id, totalSales: sales.length };
}

export async function runMonthlyReport(forDate: Date = new Date()): Promise<void> {
  // Report covers the previous calendar month
  const prevMonth = new Date(forDate.getFullYear(), forDate.getMonth() - 1, 1);
  const year = prevMonth.getFullYear();
  const month = prevMonth.getMonth(); // 0-indexed

  const periodStart = fmtDate(new Date(year, month, 1));
  const periodEnd = fmtDate(new Date(year, month + 1, 0)); // last day of previous month
  const monthLabel = prevMonth.toLocaleString("en-US", { month: "long", year: "numeric" });

  logger.info({ periodStart, periodEnd, monthLabel }, "Running monthly sales report");

  const { getOrCreateSettings } = await import("../routes/settings");
  const settings = await getOrCreateSettings();

  const sales = await db
    .select()
    .from(salesTable)
    .where(and(gte(salesTable.soldDate, periodStart), lte(salesTable.soldDate, periodEnd)));

  await sendMonthlyReport(toSaleRows(sales), monthLabel, periodStart, periodEnd, settings.recipients);

  logger.info({ monthLabel, totalSales: sales.length }, "Monthly report sent");
}

export async function runAnnualReport(forDate: Date = new Date()): Promise<void> {
  // Report covers the previous calendar year
  const prevYear = forDate.getFullYear() - 1;
  const periodStart = `${prevYear}-01-01`;
  const periodEnd = `${prevYear}-12-31`;
  const yearLabel = String(prevYear);

  logger.info({ periodStart, periodEnd, yearLabel }, "Running annual sales report");

  const { getOrCreateSettings } = await import("../routes/settings");
  const settings = await getOrCreateSettings();

  const sales = await db
    .select()
    .from(salesTable)
    .where(and(gte(salesTable.soldDate, periodStart), lte(salesTable.soldDate, periodEnd)));

  await sendAnnualReport(toSaleRows(sales), yearLabel, periodStart, periodEnd, settings.recipients);

  logger.info({ yearLabel, totalSales: sales.length }, "Annual report sent");
}

type ScheduledTask = ReturnType<typeof cron.schedule>;

let currentWeeklyTask: ScheduledTask | null = null;
let periodicTask: ScheduledTask | null = null;

// In-memory deduplication: track which month/year reports have been sent this process lifetime
let lastMonthlySent = "";  // "YYYY-MM"
let lastAnnualSent = "";   // "YYYY"

function buildCronExpression(dayOfWeek: number, hour: number, minute: number): string {
  return `${minute} ${hour} * * ${dayOfWeek}`;
}

export function restartScheduler(dayOfWeek: number, hour: number, minute: number): void {
  if (currentWeeklyTask) {
    currentWeeklyTask.stop();
    currentWeeklyTask = null;
  }

  const expr = buildCronExpression(dayOfWeek, hour, minute);
  currentWeeklyTask = cron.schedule(expr, async () => {
    logger.info({ expr }, "Scheduled weekly report triggered");
    try {
      await runWeeklyReport();
    } catch (err) {
      logger.error({ err }, "Error running scheduled weekly report");
    }
  });

  logger.info({ expr }, "Weekly report scheduler started");
}

function startPeriodicScheduler(): void {
  if (periodicTask) return; // already running

  // Every day at 9:00 AM — check for monthly and annual reports
  periodicTask = cron.schedule("0 9 * * *", async () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const yearKey = String(now.getFullYear());

    // Annual check first (January 1st region) — only on the first business day of the new year
    if (isFirstBusinessDayOfYear(now) && lastAnnualSent !== String(now.getFullYear() - 1)) {
      try {
        await runAnnualReport(now);
        lastAnnualSent = String(now.getFullYear() - 1);
      } catch (err) {
        logger.error({ err }, "Error running scheduled annual report");
      }
    }

    // Monthly check — only on the first business day of the new month, skip if it's also year-start
    // (Annual covers the full year; monthly still runs for Jan covering the previous December)
    if (isFirstBusinessDayOfMonth(now) && lastMonthlySent !== monthKey) {
      // monthKey here refers to the *current* month; the report is for the *previous* month
      try {
        await runMonthlyReport(now);
        lastMonthlySent = monthKey;
      } catch (err) {
        logger.error({ err }, "Error running scheduled monthly report");
      }
    }
  });

  logger.info("Monthly/annual report scheduler started (daily 9am check)");
}

export async function startScheduler(): Promise<void> {
  const { getOrCreateSettings } = await import("../routes/settings");
  const settings = await getOrCreateSettings();
  restartScheduler(settings.reportDayOfWeek, settings.reportHour, settings.reportMinute);
  startPeriodicScheduler();
}
