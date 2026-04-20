import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";
import { db, agencyUsersTable, pendingInvitesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { clerkClient } from "@clerk/express";

export interface AuthRequest extends Request {
  userId?: string;
  agencyUser?: typeof agencyUsersTable.$inferSelect;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;

  let [agencyUser] = await db
    .select()
    .from(agencyUsersTable)
    .where(eq(agencyUsersTable.clerkUserId, userId));

  if (!agencyUser) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(agencyUsersTable);

    const isFirstUser = Number(total) === 0;

    let fullName: string | null = null;
    let email: string | null = null;

    try {
      const clerkUser = await clerkClient().users.getUser(userId);
      fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
      email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
    } catch (_) {}

    if (!isFirstUser) {
      const invitedEmail = email?.toLowerCase();
      if (!invitedEmail) {
        res.status(403).json({ error: "Access is by invitation only. Contact your agency admin." });
        return;
      }
      const [invite] = await db
        .select()
        .from(pendingInvitesTable)
        .where(eq(pendingInvitesTable.email, invitedEmail));
      if (!invite) {
        res.status(403).json({ error: "Access is by invitation only. Contact your agency admin." });
        return;
      }
      await db.delete(pendingInvitesTable).where(eq(pendingInvitesTable.email, invitedEmail));
    }

    const role = isFirstUser ? "admin" : "agent";
    [agencyUser] = await db
      .insert(agencyUsersTable)
      .values({ clerkUserId: userId, role, fullName, email })
      .returning();
  }

  req.agencyUser = agencyUser;
  next();
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.agencyUser || req.agencyUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }
  next();
};
