import { Router, type IRouter } from "express";
import { db, leadSourcesTable } from "@workspace/db";
import { eq, and, or, isNull } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const LeadSourceBody = z.object({
  name: z.string().min(1),
  costPerLead: z.number().nonnegative().optional(),
  totalInvested: z.number().nonnegative().optional(),
  isPaid: z.boolean().optional(),
});

// Each agent sees only their own sources
router.get("/lead-sources", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";

  // Admins see all sources; agents see only their own
  const sources = isAdmin
    ? await db.select().from(leadSourcesTable).orderBy(leadSourcesTable.name)
    : await db
        .select()
        .from(leadSourcesTable)
        .where(eq(leadSourcesTable.userId, userId!))
        .orderBy(leadSourcesTable.name);

  res.json(sources);
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
      totalInvested: parsed.data.totalInvested ?? 0,
      isPaid: parsed.data.isPaid ?? false,
    })
    .returning();
  res.status(201).json(source);
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
  res.json(source);
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
