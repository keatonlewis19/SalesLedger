import { Router, type IRouter } from "express";
import { eq, gte, lte, and, getTableColumns } from "drizzle-orm";
import { db, salesTable, weeklyReportsTable, agencyUsersTable, leadsTable } from "@workspace/db";
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
  MarkSalePaidBody,
} from "@workspace/api-zod";
import { getCurrentWeekBounds, getWeekStartForDate, runWeeklyReport } from "../lib/scheduler";
import { requireAuth, requireAdmin, AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

function splitName(fullName: string): { firstName: string; lastName?: string } {
  const trimmed = fullName.trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return { firstName: trimmed };
  return { firstName: trimmed.slice(0, lastSpace), lastName: trimmed.slice(lastSpace + 1) };
}

function normalizeSale(s: { createdAt: Date | string; updatedAt: Date | string; owningAgent?: string | null; salesSource?: string | null; effectiveDate?: string | null; leadSource?: string | null; hra?: number | null; estimatedCommission: number | null | undefined; notes: string | null | undefined; userId?: string | null; paid?: boolean; [key: string]: unknown }) {
  const { notes, ...rest } = s;
  return {
    ...rest,
    userId: s.userId ?? null,
    owningAgent: s.owningAgent ?? null,
    salesSource: s.salesSource ?? null,
    effectiveDate: s.effectiveDate ?? null,
    leadSource: s.leadSource ?? null,
    hra: s.hra ?? null,
    estimatedCommission: s.estimatedCommission ?? null,
    comments: notes ?? null,
    paid: s.paid ?? false,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
  };
}

router.get("/sales", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = ListSalesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

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

  const isAdmin = req.agencyUser?.role === "admin";

  const conditions = [
    gte(salesTable.soldDate, weekStart),
    lte(salesTable.soldDate, weekEnd),
  ];

  if (!isAdmin && req.userId) {
    conditions.push(eq(salesTable.userId, req.userId));
  }

  const sales = await db
    .select({
      ...getTableColumns(salesTable),
      agentName: agencyUsersTable.fullName,
    })
    .from(salesTable)
    .leftJoin(agencyUsersTable, eq(salesTable.userId, agencyUsersTable.clerkUserId))
    .where(and(...conditions))
    .orderBy(salesTable.soldDate);

  res.json(ListSalesResponse.parse(sales.map(normalizeSale)));
});

router.post("/sales", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const weekStart = getWeekStartForDate(data.soldDate);

  // Leads are the source of truth — create the lead record first, then attach the sale
  const { firstName, lastName } = splitName(data.clientName);
  const [lead] = await db
    .insert(leadsTable)
    .values({
      userId: req.userId!,
      firstName,
      lastName,
      status: "sold",
      lineOfBusiness: (data.lineOfBusiness ?? "medicare") as "medicare" | "aca" | "ancillary" | "life" | "annuity",
      carrier: data.carrier ?? undefined,
      salesType: data.salesType ?? undefined,
      commissionType: data.commissionType ?? undefined,
      revenue: data.estimatedCommission ?? undefined,
      soldDate: data.soldDate,
      enteredDate: data.soldDate,
      notes: data.comments ?? undefined,
      leadOwnership: "sale_entry",
    })
    .returning();

  const [sale] = await db
    .insert(salesTable)
    .values({
      userId: req.userId,
      clientName: data.clientName,
      salesSource: data.salesSource ?? undefined,
      salesType: data.salesType,
      soldDate: data.soldDate,
      effectiveDate: data.effectiveDate ?? undefined,
      commissionType: data.commissionType,
      leadSource: data.leadSource ?? undefined,
      hra: data.hra ?? undefined,
      estimatedCommission: data.estimatedCommission ?? undefined,
      notes: data.comments ?? undefined,
      lineOfBusiness: data.lineOfBusiness ?? "medicare",
      carrier: data.carrier ?? undefined,
      metalTier: data.metalTier ?? undefined,
      householdSize: data.householdSize ?? undefined,
      weekStart,
      leadId: lead.id,
    })
    .returning();

  // Point the lead back to its sale
  await db.update(leadsTable).set({ linkedSaleId: sale.id }).where(eq(leadsTable.id, lead.id));

  res.status(201).json(GetSaleResponse.parse(normalizeSale(sale)));
});

router.get("/sales/summary/current-week", requireAuth, async (req: AuthRequest, _res): Promise<void> => {
  const res = _res;
  const { weekStart, weekEnd } = getCurrentWeekBounds();
  const isAdmin = req.agencyUser?.role === "admin";

  const conditions = [
    gte(salesTable.soldDate, weekStart),
    lte(salesTable.soldDate, weekEnd),
  ];

  if (!isAdmin && req.userId) {
    conditions.push(eq(salesTable.userId, req.userId));
  }

  const sales = await db
    .select()
    .from(salesTable)
    .where(and(...conditions));

  const totalSales = sales.length;
  const totalEstimatedCommission = sales.reduce(
    (acc, s) => acc + (s.estimatedCommission ?? 0) + (s.hra ?? 0),
    0
  );

  const agentCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};

  for (const s of sales) {
    const agent = s.owningAgent ?? "Unknown";
    agentCounts[agent] = (agentCounts[agent] ?? 0) + 1;
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

router.patch("/sales/:id/paid", requireAuth, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseId(req.params.id);
  const parsed = MarkSalePaidBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [sale] = await db
    .update(salesTable)
    .set({ paid: parsed.data.paid })
    .where(eq(salesTable.id, id))
    .returning();

  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  res.json(GetSaleResponse.parse(normalizeSale(sale)));
});

router.get("/sales/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
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

  const isAdmin = req.agencyUser?.role === "admin";
  if (!isAdmin && sale.userId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(GetSaleResponse.parse(normalizeSale(sale)));
});

router.patch("/sales/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
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

  const [existing] = await db.select().from(salesTable).where(eq(salesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  const isAdmin = req.agencyUser?.role === "admin";
  if (!isAdmin && existing.userId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const updateData = parsed.data;
  const updateFields: Record<string, unknown> = {};

  if (updateData.clientName !== undefined) updateFields.clientName = updateData.clientName;
  if (updateData.salesSource !== undefined) updateFields.salesSource = updateData.salesSource;
  if (updateData.salesType !== undefined) updateFields.salesType = updateData.salesType;
  if (updateData.effectiveDate !== undefined) updateFields.effectiveDate = updateData.effectiveDate;
  if (updateData.commissionType !== undefined) updateFields.commissionType = updateData.commissionType;
  if (updateData.leadSource !== undefined) updateFields.leadSource = updateData.leadSource;
  if (updateData.hra !== undefined) updateFields.hra = updateData.hra;
  if (updateData.estimatedCommission !== undefined) updateFields.estimatedCommission = updateData.estimatedCommission;
  if (updateData.comments !== undefined) updateFields.notes = updateData.comments;
  if (updateData.lineOfBusiness !== undefined) updateFields.lineOfBusiness = updateData.lineOfBusiness;
  if (updateData.carrier !== undefined) updateFields.carrier = updateData.carrier;
  if (updateData.metalTier !== undefined) updateFields.metalTier = updateData.metalTier;
  if (updateData.householdSize !== undefined) updateFields.householdSize = updateData.householdSize;

  if (updateData.soldDate !== undefined) {
    updateFields.soldDate = updateData.soldDate;
    updateFields.weekStart = getWeekStartForDate(updateData.soldDate);
  }

  const [sale] = await db
    .update(salesTable)
    .set(updateFields as any)
    .where(eq(salesTable.id, params.data.id))
    .returning();

  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  // Sync changes to the parent lead record (Option B: leads are source of truth)
  if (sale.leadId) {
    try {
      const leadUpdate: Record<string, unknown> = {};
      if (updateData.clientName !== undefined) {
        const { firstName, lastName } = splitName(updateData.clientName);
        leadUpdate.firstName = firstName;
        leadUpdate.lastName = lastName ?? null;
      }
      if (updateData.carrier !== undefined) leadUpdate.carrier = updateData.carrier;
      if (updateData.salesType !== undefined) leadUpdate.salesType = updateData.salesType;
      if (updateData.commissionType !== undefined) leadUpdate.commissionType = updateData.commissionType;
      if (updateData.estimatedCommission !== undefined) leadUpdate.revenue = updateData.estimatedCommission;
      if (updateData.soldDate !== undefined) { leadUpdate.soldDate = updateData.soldDate; leadUpdate.enteredDate = updateData.soldDate; }
      if (updateData.lineOfBusiness !== undefined) leadUpdate.lineOfBusiness = updateData.lineOfBusiness;
      if (updateData.comments !== undefined) leadUpdate.notes = updateData.comments;
      if (Object.keys(leadUpdate).length > 0) {
        await db.update(leadsTable).set(leadUpdate as any).where(eq(leadsTable.id, sale.leadId));
      }
    } catch (err) {
      req.log.error({ err }, "Failed to sync lead from sale update");
    }
  }

  res.json(UpdateSaleResponse.parse(normalizeSale(sale)));
});

router.delete("/sales/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteSaleParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(salesTable).where(eq(salesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  const isAdmin = req.agencyUser?.role === "admin";
  if (!isAdmin && existing.userId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // If the sale has a parent lead, handle it based on origin:
  // - 'sale_entry' leads were auto-created alongside this sale → delete them
  // - real pipeline leads (Agency BOB / Self-Generated) → just unlink them
  if (existing.leadId) {
    try {
      const [parentLead] = await db.select().from(leadsTable).where(eq(leadsTable.id, existing.leadId));
      if (parentLead) {
        if (parentLead.leadOwnership === "sale_entry") {
          await db.delete(leadsTable).where(eq(leadsTable.id, parentLead.id));
        } else {
          await db.update(leadsTable)
            .set({ linkedSaleId: null, soldDate: null })
            .where(eq(leadsTable.id, parentLead.id));
        }
      }
    } catch (err) {
      req.log.error({ err }, "Failed to clean up parent lead on sale delete");
    }
  }

  await db.delete(salesTable).where(eq(salesTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/reports", requireAuth, async (_req, res): Promise<void> => {
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

router.post("/reports/send", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const { reportId, totalSales } = await runWeeklyReport();
  res.json(
    SendReportResponse.parse({
      message: `Report sent successfully with ${totalSales} sales.`,
      reportId,
    })
  );
});

export default router;
