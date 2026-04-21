import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, agencyUsersTable, pendingInvitesTable } from "@workspace/db";
import { requireAuth, requireAdmin, AuthRequest } from "../middlewares/auth";
import { clerkClient } from "@clerk/express";

const router: IRouter = Router();

function normalizeUser(u: typeof agencyUsersTable.$inferSelect) {
  return {
    ...u,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    updatedAt: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : u.updatedAt,
  };
}

router.get("/users/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (!req.agencyUser) {
    res.status(404).json({ error: "User profile not found" });
    return;
  }
  res.json(normalizeUser(req.agencyUser));
});

router.get("/users", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select().from(agencyUsersTable).orderBy(agencyUsersTable.createdAt);
  res.json(users.map(normalizeUser));
});

router.post("/users/invite", requireAuth, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const { email, role = "agent", redirectUrl: bodyRedirectUrl } = req.body as { email: string; role?: string; redirectUrl?: string };

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  // Derive a sign-up redirect URL from the request origin if the client didn't provide one
  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, "");
  const redirectUrl = bodyRedirectUrl || (origin ? `${origin}/sign-up` : undefined);

  try {
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { role },
      redirectUrl,
    });

    await db
      .insert(pendingInvitesTable)
      .values({ email: email.toLowerCase(), clerkInvitationId: (invitation as any).id })
      .onConflictDoNothing();

    res.json({ message: `Invitation sent to ${email}`, invitationId: (invitation as any).id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to send invitation" });
  }
});

router.patch("/users/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { fullName } = req.body as { fullName?: string | null };
  const [updated] = await db
    .update(agencyUsersTable)
    .set({ fullName: fullName ?? null, updatedAt: new Date() })
    .where(eq(agencyUsersTable.clerkUserId, req.userId!))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(normalizeUser(updated));
});

router.patch("/users/:id/role", requireAuth, requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const clerkUserId = req.params.id;
  const { role } = req.body as { role: string };

  if (!["admin", "agent"].includes(role)) {
    res.status(400).json({ error: "Role must be admin or agent" });
    return;
  }

  const [updated] = await db
    .update(agencyUsersTable)
    .set({ role, updatedAt: new Date() })
    .where(eq(agencyUsersTable.clerkUserId, clerkUserId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(normalizeUser(updated));
});

export default router;
