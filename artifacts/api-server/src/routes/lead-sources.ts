import { Router, type IRouter } from "express";
import { db, leadSourcesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const LeadSourceBody = z.object({
  name: z.string().min(1),
  costPerLead: z.number().nonnegative().optional(),
  isPaid: z.boolean().optional(),
});

router.get("/lead-sources", requireAuth, async (_req: AuthRequest, res) => {
  const sources = await db.select().from(leadSourcesTable).orderBy(leadSourcesTable.name);
  res.json(sources);
});

router.post("/lead-sources", requireAuth, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const parsed = LeadSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [source] = await db
    .insert(leadSourcesTable)
    .values({
      name: parsed.data.name,
      costPerLead: parsed.data.costPerLead ?? 0,
      isPaid: parsed.data.isPaid ?? false,
    })
    .returning();
  res.status(201).json(source);
});

router.patch("/lead-sources/:id", requireAuth, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
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
  if (!source) {
    res.status(404).json({ error: "Lead source not found" });
    return;
  }
  res.json(source);
});

router.delete("/lead-sources/:id", requireAuth, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  const [deleted] = await db
    .delete(leadSourcesTable)
    .where(eq(leadSourcesTable.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Lead source not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
