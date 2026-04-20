import { Router, IRouter } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { GetSettingsResponse, UpdateSettingsResponse, UpdateSettingsBody } from "@workspace/api-zod";
import { restartScheduler } from "../lib/scheduler";

const router: IRouter = Router();

const DEFAULT_SETTINGS = {
  reportDayOfWeek: 4,
  reportHour: 17,
  reportMinute: 0,
  recipients: ["rauni@crmgrp.com", "chad@crmgrp.com"],
  commissionRates: {} as Record<string, number>,
};

async function getOrCreateSettings() {
  const rows = await db.select().from(appSettingsTable).limit(1);
  if (rows.length > 0) {
    const r = rows[0];
    return {
      reportDayOfWeek: r.reportDayOfWeek,
      reportHour: r.reportHour,
      reportMinute: r.reportMinute,
      recipients: r.recipients.split(",").map((s) => s.trim()).filter(Boolean),
      commissionRates: (r.commissionRates as Record<string, number>) ?? {},
    };
  }

  await db.insert(appSettingsTable).values({
    ...DEFAULT_SETTINGS,
    recipients: DEFAULT_SETTINGS.recipients.join(","),
    commissionRates: DEFAULT_SETTINGS.commissionRates,
  });

  return DEFAULT_SETTINGS;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json(GetSettingsResponse.parse(settings));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const current = await getOrCreateSettings();
  const updated = { ...current, ...parsed.data };

  const dbValue = {
    reportDayOfWeek: updated.reportDayOfWeek,
    reportHour: updated.reportHour,
    reportMinute: updated.reportMinute,
    recipients: (updated.recipients as string[]).join(","),
    commissionRates: updated.commissionRates as Record<string, number>,
  };

  const rows = await db.select().from(appSettingsTable).limit(1);
  if (rows.length > 0) {
    await db
      .update(appSettingsTable)
      .set({ ...dbValue, updatedAt: new Date() });
  } else {
    await db.insert(appSettingsTable).values(dbValue);
  }

  restartScheduler(updated.reportDayOfWeek as number, updated.reportHour as number, updated.reportMinute as number);

  res.json(UpdateSettingsResponse.parse(updated));
});

export { router as settingsRouter, getOrCreateSettings };
