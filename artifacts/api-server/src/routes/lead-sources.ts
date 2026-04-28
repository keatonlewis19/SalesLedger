import { Router, type IRouter } from "express";
import { db, leadSourcesTable, leadSourcePaymentsTable, leadsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const LeadSourceBody = z.object({
  name: z.string().min(1),
  isPaid: z.boolean().optional(),
  costPerLead: z.number().min(0).optional(),
});

// Enrich sources with computed totalInvested and costPerLead
async function enrichSources(sources: typeof leadSourcesTable.$inferSelect[]) {
  if (sources.length === 0) return [];

  // Sum payments per source
  const paymentSums = await db
    .select({
      leadSourceId: leadSourcePaymentsTable.leadSourceId,
      total: sql<number>`coalesce(sum(${leadSourcePaymentsTable.amount}), 0)`.as("total"),
    })
    .from(leadSourcePaymentsTable)
    .groupBy(leadSourcePaymentsTable.leadSourceId);

  // Count leads per source
  const leadCounts = await db
    .select({
      leadSourceId: leadsTable.leadSourceId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(leadsTable)
    .groupBy(leadsTable.leadSourceId);

  const paymentMap = new Map(paymentSums.map((p) => [p.leadSourceId, Number(p.total)]));
  const leadCountMap = new Map(leadCounts.map((l) => [l.leadSourceId, Number(l.count)]));

  return sources.map((src) => {
    const totalInvested = paymentMap.get(src.id) ?? 0;
    const leadCount = leadCountMap.get(src.id) ?? 0;
    // When payments exist, compute cost per lead from payment total.
    // Otherwise fall back to the stored default cost per lead on the source.
    const costPerLead = totalInvested > 0 && leadCount > 0
      ? totalInvested / leadCount
      : (src.costPerLead ?? 0);
    return { ...src, totalInvested, costPerLead, leadCount };
  });
}

// All authenticated agents see all agency-wide sources
router.get("/lead-sources", requireAuth, async (_req, res): Promise<void> => {
  const sources = await db.select().from(leadSourcesTable).orderBy(leadSourcesTable.name);
  res.json(await enrichSources(sources));
});

// Any authenticated agent can create their own source
router.post("/lead-sources", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = LeadSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [source] = await db
    .insert(leadSourcesTable)
    .values({
      userId: req.userId!,
      name: parsed.data.name,
      costPerLead: parsed.data.costPerLead ?? 0,
      totalInvested: 0,
      isPaid: parsed.data.isPaid ?? false,
    })
    .returning();
  const enriched = await enrichSources([source]);
  res.status(201).json(enriched[0]);
});

// Agents can only edit their own sources; admins can edit any
router.patch("/lead-sources/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";

  const [existing] = await db.select().from(leadSourcesTable).where(eq(leadSourcesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Lead source not found" });
    return;
  }
  if (!isAdmin && existing.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = LeadSourceBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [source] = await db
    .update(leadSourcesTable)
    .set(parsed.data)
    .where(eq(leadSourcesTable.id, id))
    .returning();
  const enriched = await enrichSources([source]);
  res.json(enriched[0]);
});

// Agents can only delete their own sources; admins can delete any
router.delete("/lead-sources/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";

  const [existing] = await db.select().from(leadSourcesTable).where(eq(leadSourcesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Lead source not found" });
    return;
  }
  if (!isAdmin && existing.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(leadSourcesTable).where(eq(leadSourcesTable.id, id));
  res.json({ success: true });
});

export default router;
