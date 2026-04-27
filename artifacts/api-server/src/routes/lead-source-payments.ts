import { Router, type IRouter } from "express";
import { db, leadSourcePaymentsTable, leadSourcesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const PaymentBody = z.object({
  amount: z.number().positive(),
  paidDate: z.string().min(1),
  note: z.string().optional(),
});

// List payments for a lead source
router.get("/lead-sources/:id/payments", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";

  const [source] = await db.select().from(leadSourcesTable).where(eq(leadSourcesTable.id, id));
  if (!source) { res.status(404).json({ error: "Lead source not found" }); return; }
  if (!isAdmin && source.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const payments = await db
    .select()
    .from(leadSourcePaymentsTable)
    .where(eq(leadSourcePaymentsTable.leadSourceId, id))
    .orderBy(desc(leadSourcePaymentsTable.paidDate));

  res.json(payments);
});

// Add a payment to a lead source
router.post("/lead-sources/:id/payments", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";

  const [source] = await db.select().from(leadSourcesTable).where(eq(leadSourcesTable.id, id));
  if (!source) { res.status(404).json({ error: "Lead source not found" }); return; }
  if (!isAdmin && source.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = PaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [payment] = await db
    .insert(leadSourcePaymentsTable)
    .values({
      leadSourceId: id,
      userId: userId!,
      amount: parsed.data.amount,
      paidDate: parsed.data.paidDate,
      note: parsed.data.note ?? null,
    })
    .returning();

  res.status(201).json(payment);
});

// Delete a payment
router.delete("/lead-sources/:id/payments/:paymentId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  const paymentId = parseInt(req.params["paymentId"] as string, 10);
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";

  const [source] = await db.select().from(leadSourcesTable).where(eq(leadSourcesTable.id, id));
  if (!source) { res.status(404).json({ error: "Lead source not found" }); return; }
  if (!isAdmin && source.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(leadSourcePaymentsTable).where(eq(leadSourcePaymentsTable.id, paymentId));
  res.json({ success: true });
});

export default router;
