import { Router, type IRouter } from "express";
import { eq, gte, lte, and } from "drizzle-orm";
import { db, salesTable, weeklyReportsTable } from "@workspace/db";
import {
  CreateSaleBody,
  UpdateSaleBody,
  GetSaleParams,
  UpdateSaleParams,
  DeleteSaleParams,
  ListSalesQueryParams,
  ListSalesResponse,
  GetSaleResponse,
  UpdateSaleResponse,
  GetCurrentWeekSummaryResponse,
  ListReportsResponse,
  SendReportResponse,
} from "@workspace/api-zod";
import { getCurrentWeekBounds, getWeekStartForDate, runWeeklyReport } from "../lib/scheduler";
import type { SaleEntry } from "@workspace/api-zod";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

function normalizeSale(s: { createdAt: Date | string; updatedAt: Date | string; leadSource?: string | null; annualPremium?: number | null; estimatedCommission: number | null | undefined; notes: string | null | undefined; [key: string]: unknown }) {
  return {
    ...s,
    leadSource: s.leadSource ?? null,
    annualPremium: s.annualPremium ?? null,
    estimatedCommission: s.estimatedCommission ?? null,
    notes: s.notes ?? null,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
  };
}

router.get("/sales", async (req, res): Promise<void> => {
  const parsed = ListSalesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // If a specific weekStart is passed, derive that week's end; otherwise use current week
  const { weekStart, weekEnd } = parsed.data.weekStart
    ? (() => {
        const ws = parsed.data.weekStart!;
        const friday = new Date(ws + "T12:00:00Z");
        const thursday = new Date(friday);
        thursday.setDate(friday.getDate() + 6);
        const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
        return { weekStart: fmt(friday), weekEnd: fmt(thursday) };
      })()
    : getCurrentWeekBounds();

  const sales = await db
    .select()
    .from(salesTable)
    .where(and(gte(salesTable.soldDate, weekStart), lte(salesTable.soldDate, weekEnd)))
    .orderBy(salesTable.soldDate);

  res.json(
    ListSalesResponse.parse(
      sales.map(normalizeSale)
    )
  );
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const weekStart = getWeekStartForDate(data.soldDate);

  const [sale] = await db
    .insert(salesTable)
    .values({
      ...data,
      estimatedCommission: data.estimatedCommission ?? undefined,
      notes: data.notes ?? undefined,
      weekStart,
    })
    .returning();

  res.status(201).json(GetSaleResponse.parse(normalizeSale(sale)));
});

router.get("/sales/summary/current-week", async (_req, res): Promise<void> => {
  const { weekStart, weekEnd } = getCurrentWeekBounds();

  const sales = await db
    .select()
    .from(salesTable)
    .where(and(gte(salesTable.soldDate, weekStart), lte(salesTable.soldDate, weekEnd)));

  const totalSales = sales.length;
  const totalEstimatedCommission = sales.reduce(
    (acc, s) => acc + (s.estimatedCommission ?? 0),
    0
  );

  const agentCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};

  for (const s of sales) {
    agentCounts[s.owningAgent] = (agentCounts[s.owningAgent] ?? 0) + 1;
    typeCounts[s.salesType] = (typeCounts[s.salesType] ?? 0) + 1;
  }

  const byOwningAgent = Object.entries(agentCounts).map(([agent, count]) => ({ agent, count }));
  const bySalesType = Object.entries(typeCounts).map(([salesType, count]) => ({ salesType, count }));

  res.json(
    GetCurrentWeekSummaryResponse.parse({
      totalSales,
      totalEstimatedCommission,
      byOwningAgent,
      bySalesType,
      weekStart,
      weekEnd,
    })
  );
});

router.get("/sales/:id", async (req, res): Promise<void> => {
  const params = GetSaleParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, params.data.id));

  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  res.json(GetSaleResponse.parse(normalizeSale(sale)));
});

router.patch("/sales/:id", async (req, res): Promise<void> => {
  const params = UpdateSaleParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData = parsed.data;
  const updateFields: Record<string, unknown> = {};

  if (updateData.clientName !== undefined) updateFields.clientName = updateData.clientName;
  if (updateData.owningAgent !== undefined) updateFields.owningAgent = updateData.owningAgent;
  if (updateData.salesType !== undefined) updateFields.salesType = updateData.salesType;
  if (updateData.commissionType !== undefined) updateFields.commissionType = updateData.commissionType;
  if (updateData.estimatedCommission !== undefined) updateFields.estimatedCommission = updateData.estimatedCommission;
  if (updateData.notes !== undefined) updateFields.notes = updateData.notes;

  if (updateData.soldDate !== undefined) {
    updateFields.soldDate = updateData.soldDate;
    updateFields.weekStart = getWeekStartForDate(updateData.soldDate);
  }

  const [sale] = await db
    .update(salesTable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(updateFields as any)
    .where(eq(salesTable.id, params.data.id))
    .returning();

  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  res.json(UpdateSaleResponse.parse(normalizeSale(sale)));
});

router.delete("/sales/:id", async (req, res): Promise<void> => {
  const params = DeleteSaleParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [sale] = await db.delete(salesTable).where(eq(salesTable.id, params.data.id)).returning();

  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/reports", async (_req, res): Promise<void> => {
  const reports = await db
    .select()
    .from(weeklyReportsTable)
    .orderBy(weeklyReportsTable.sentAt);

  res.json(
    ListReportsResponse.parse(
      reports.map((r) => ({
        ...r,
        sentAt: r.sentAt.toISOString(),
      }))
    )
  );
});

router.post("/reports/send", async (_req, res): Promise<void> => {
  const { reportId, totalSales } = await runWeeklyReport();
  res.json(
    SendReportResponse.parse({
      message: `Report sent successfully with ${totalSales} sales.`,
      reportId,
    })
  );
});

export default router;
