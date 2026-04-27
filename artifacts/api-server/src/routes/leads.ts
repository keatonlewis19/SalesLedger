import { Router, type IRouter } from "express";
import { db, leadsTable, leadSourcesTable, salesTable, agencyUsersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getWeekStartForDate } from "../lib/scheduler";
import { z } from "zod";

const router: IRouter = Router();

const VALID_STATUSES = ["new", "in_comm", "appt_set", "follow_up", "sold", "lost"] as const;

const VALID_LOBS = ["medicare", "aca", "ancillary", "life", "annuity"] as const;

const LeadBody = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  leadSourceId: z.number().int().optional().nullable(),
  status: z.enum(VALID_STATUSES).optional(),
  revenue: z.number().nonnegative().optional().nullable(),
  carrier: z.string().optional().nullable(),
  salesType: z.string().optional().nullable(),
  commissionType: z.string().optional().nullable(),
  costPerLead: z.number().nonnegative().optional().nullable(),
  lineOfBusiness: z.enum(VALID_LOBS).optional(),
  ancillaryType: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  enteredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  soldDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const PatchLeadBody = LeadBody.partial();

router.get("/leads", requireAuth, async (req: AuthRequest, res) => {
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";

  const rows = isAdmin
    ? await db
        .select()
        .from(leadsTable)
        .leftJoin(leadSourcesTable, eq(leadsTable.leadSourceId, leadSourcesTable.id))
        .orderBy(desc(leadsTable.createdAt))
    : await db
        .select()
        .from(leadsTable)
        .leftJoin(leadSourcesTable, eq(leadsTable.leadSourceId, leadSourcesTable.id))
        .where(eq(leadsTable.userId, userId!))
        .orderBy(desc(leadsTable.createdAt));

  const leads = rows.map((r) => ({
    ...r.leads,
    leadSource: r.lead_sources ?? null,
  }));

  res.json(leads);
});

router.get("/leads/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";

  const [row] = await db
    .select()
    .from(leadsTable)
    .leftJoin(leadSourcesTable, eq(leadsTable.leadSourceId, leadSourcesTable.id))
    .where(eq(leadsTable.id, id));

  if (!row) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  if (!isAdmin && row.leads.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json({ ...row.leads, leadSource: row.lead_sources ?? null });
});

router.post("/leads", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = LeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const lob = data.lineOfBusiness ?? "medicare";
  const [lead] = await db
    .insert(leadsTable)
    .values({
      userId: req.userId!,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      leadSourceId: data.leadSourceId ?? null,
      status: lob === "medicare" ? (data.status ?? "new") : "sold",
      revenue: data.revenue ?? null,
      carrier: data.carrier ?? null,
      salesType: data.salesType ?? null,
      commissionType: data.commissionType ?? null,
      costPerLead: data.costPerLead ?? null,
      lineOfBusiness: lob,
      ancillaryType: data.ancillaryType ?? null,
      notes: data.notes ?? null,
      enteredDate: data.enteredDate,
      soldDate: data.soldDate ?? null,
    })
    .returning();

  res.status(201).json(lead);
});

// Bulk import endpoint — must be before /:id routes
router.post("/leads/import", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { userId } = req;
  const rows = req.body?.leads;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "No leads provided" });
    return;
  }

  const VALID_STATUSES = ["new", "in_comm", "appt_set", "follow_up", "sold", "lost"];
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const today = new Date().toISOString().slice(0, 10);

  let imported = 0;
  const errors: string[] = [];

  // Cache of source name -> id for this request
  const sourceCache = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `Row ${i + 1} (${row.firstName ?? "?"})`;

    if (!row.firstName?.trim()) {
      errors.push(`${label}: First name is required`);
      continue;
    }

    // Resolve lead source
    let leadSourceId: number | null = null;
    const srcName = row.leadSource?.trim();
    if (srcName) {
      if (sourceCache.has(srcName)) {
        leadSourceId = sourceCache.get(srcName)!;
      } else {
        let [src] = await db
          .select()
          .from(leadSourcesTable)
          .where(eq(leadSourcesTable.name, srcName));
        if (!src) {
          [src] = await db.insert(leadSourcesTable).values({
            userId: userId!,
            name: srcName,
            isPaid: false,
            costPerLead: 0,
            totalInvested: 0,
          }).returning();
        }
        sourceCache.set(srcName, src.id);
        leadSourceId = src.id;
      }
    }

    const status = VALID_STATUSES.includes(row.status) ? row.status : "new";
    const enteredDate = dateRe.test(row.enteredDate ?? "") ? row.enteredDate : today;
    const soldDate = dateRe.test(row.soldDate ?? "") ? row.soldDate : null;

    try {
      const rowLob = VALID_LOBS.includes(row.lineOfBusiness) ? row.lineOfBusiness : "medicare";
      await db.insert(leadsTable).values({
        userId: userId!,
        firstName: row.firstName.trim(),
        lastName: row.lastName?.trim() || null,
        phone: row.phone?.trim() || null,
        email: row.email?.trim() || null,
        leadSourceId,
        status,
        revenue: row.revenue != null && !isNaN(Number(row.revenue)) ? Number(row.revenue) : null,
        carrier: row.carrier?.trim() || null,
        salesType: row.salesType?.trim() || null,
        commissionType: row.commissionType?.trim() || null,
        costPerLead: row.costPerLead != null && !isNaN(Number(row.costPerLead)) ? Number(row.costPerLead) : null,
        lineOfBusiness: rowLob,
        ancillaryType: row.ancillaryType?.trim() || null,
        notes: row.notes?.trim() || null,
        enteredDate,
        soldDate,
      });
      imported++;
    } catch (e: any) {
      errors.push(`${label}: ${e.message}`);
    }
  }

  res.json({ imported, errors });
});

router.patch("/leads/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  if (!isAdmin && existing.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = PatchLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const wasAlreadySold = existing.status === "sold";
  const isNowSold = data.status === "sold";

  let soldDate = data.soldDate ?? existing.soldDate;
  if (isNowSold && !soldDate) {
    soldDate = new Date().toISOString().slice(0, 10);
  }

  const updatePayload: Record<string, unknown> = {
    ...(data.firstName !== undefined && { firstName: data.firstName }),
    ...(data.lastName !== undefined && { lastName: data.lastName }),
    ...(data.phone !== undefined && { phone: data.phone }),
    ...(data.email !== undefined && { email: data.email }),
    ...(data.leadSourceId !== undefined && { leadSourceId: data.leadSourceId }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.revenue !== undefined && { revenue: data.revenue }),
    ...(data.carrier !== undefined && { carrier: data.carrier }),
    ...(data.salesType !== undefined && { salesType: data.salesType }),
    ...(data.commissionType !== undefined && { commissionType: data.commissionType }),
    ...(data.costPerLead !== undefined && { costPerLead: data.costPerLead }),
    ...(data.lineOfBusiness !== undefined && { lineOfBusiness: data.lineOfBusiness }),
    ...(data.ancillaryType !== undefined && { ancillaryType: data.ancillaryType }),
    ...(data.notes !== undefined && { notes: data.notes }),
    ...(data.enteredDate !== undefined && { enteredDate: data.enteredDate }),
    soldDate,
  };

  const [updated] = await db
    .update(leadsTable)
    .set(updatePayload)
    .where(eq(leadsTable.id, id))
    .returning();

  // Auto-sync to sales when newly marked as sold
  if (isNowSold && !wasAlreadySold) {
    try {
      const effectiveSoldDate = soldDate ?? new Date().toISOString().slice(0, 10);
      const weekStart = getWeekStartForDate(effectiveSoldDate);

      let leadSourceName: string | undefined;
      const sourceId = updated.leadSourceId ?? existing.leadSourceId;
      if (sourceId) {
        const [src] = await db.select().from(leadSourcesTable).where(eq(leadSourcesTable.id, sourceId));
        leadSourceName = src?.name;
      }

      const [agentRecord] = await db
        .select()
        .from(agencyUsersTable)
        .where(eq(agencyUsersTable.clerkUserId, existing.userId));
      const owningAgent = agentRecord?.fullName ?? agentRecord?.email ?? existing.userId;

      const clientName = [updated.firstName, updated.lastName].filter(Boolean).join(" ");

      const [sale] = await db
        .insert(salesTable)
        .values({
          userId: existing.userId,
          clientName,
          owningAgent,
          salesSource: leadSourceName ?? null,
          salesType: updated.salesType ?? "Medicare",
          soldDate: effectiveSoldDate,
          commissionType: updated.commissionType ?? "Standard",
          leadSource: leadSourceName ?? null,
          annualPremium: updated.revenue ?? null,
          weekStart,
        })
        .returning();

      await db
        .update(leadsTable)
        .set({ linkedSaleId: sale.id })
        .where(eq(leadsTable.id, id));
    } catch (err) {
      console.error("Failed to auto-create sale from lead:", err);
    }
  }

  // Remove linked sale if reverted from sold
  if (!isNowSold && wasAlreadySold && existing.linkedSaleId) {
    try {
      await db.delete(salesTable).where(eq(salesTable.id, existing.linkedSaleId));
      await db.update(leadsTable).set({ linkedSaleId: null, soldDate: null }).where(eq(leadsTable.id, id));
    } catch (err) {
      console.error("Failed to remove linked sale:", err);
    }
  }

  res.json(updated);
});

router.delete("/leads/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  if (!isAdmin && existing.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (existing.linkedSaleId) {
    await db.delete(salesTable).where(eq(salesTable.id, existing.linkedSaleId));
  }

  await db.delete(leadsTable).where(eq(leadsTable.id, id));
  res.json({ success: true });
});

export default router;
