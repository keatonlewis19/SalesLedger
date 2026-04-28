import { Router, type IRouter } from "express";
import { db, callLogsTable, agencyUsersTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getCurrentWeekBounds, getWeekStartForDate } from "../lib/scheduler";

const router: IRouter = Router();

const CallLogBody = z.object({
  clientName: z.string().min(1),
  contactType: z.enum(["contacted", "voicemail", "text_message", "no_answer"]),
  callDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

router.get("/call-logs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";
  const agentUserId = typeof req.query["agentUserId"] === "string" ? req.query["agentUserId"] : null;
  const weekStart = typeof req.query["weekStart"] === "string" ? req.query["weekStart"] : null;
  const weekEnd = typeof req.query["weekEnd"] === "string" ? req.query["weekEnd"] : null;

  const filterUserId = isAdmin ? (agentUserId ?? null) : (userId ?? null);

  let rows = await db
    .select({
      id: callLogsTable.id,
      userId: callLogsTable.userId,
      clientName: callLogsTable.clientName,
      contactType: callLogsTable.contactType,
      callDate: callLogsTable.callDate,
      notes: callLogsTable.notes,
      weekStart: callLogsTable.weekStart,
      createdAt: callLogsTable.createdAt,
      agentName: agencyUsersTable.fullName,
    })
    .from(callLogsTable)
    .leftJoin(agencyUsersTable, eq(callLogsTable.userId, agencyUsersTable.clerkUserId))
    .orderBy(desc(callLogsTable.callDate), desc(callLogsTable.createdAt));

  if (filterUserId) rows = rows.filter((r) => r.userId === filterUserId);
  if (weekStart) rows = rows.filter((r) => r.weekStart >= weekStart);
  if (weekEnd) {
    const { weekEnd: we } = getCurrentWeekBounds();
    const endBound = weekEnd || we;
    rows = rows.filter((r) => r.weekStart <= endBound);
  }

  res.json(rows);
});

router.post("/call-logs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { userId } = req;
  const parsed = CallLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const weekStart = getWeekStartForDate(parsed.data.callDate);

  const [log] = await db
    .insert(callLogsTable)
    .values({
      userId: userId!,
      clientName: parsed.data.clientName,
      contactType: parsed.data.contactType,
      callDate: parsed.data.callDate,
      notes: parsed.data.notes ?? null,
      weekStart,
    })
    .returning();

  res.status(201).json(log);
});

router.delete("/call-logs/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";
  const id = parseInt(req.params["id"] as string, 10);

  const [existing] = await db.select().from(callLogsTable).where(eq(callLogsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Call log not found" });
    return;
  }
  if (!isAdmin && existing.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(callLogsTable).where(eq(callLogsTable.id, id));
  res.json({ success: true });
});

export default router;
