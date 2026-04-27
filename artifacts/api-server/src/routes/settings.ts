import { Router, IRouter } from "express";
import { db, appSettingsTable } from "@workspace/db";
import type { CommissionTableRow } from "@workspace/db";
import { GetSettingsResponse, UpdateSettingsResponse, UpdateSettingsBody } from "@workspace/api-zod";
import { restartScheduler } from "../lib/scheduler";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const DEFAULT_SETTINGS = {
  reportDayOfWeek: 4,
  reportHour: 17,
  reportMinute: 0,
  recipients: ["rauni@crmgrp.com", "chad@crmgrp.com"],
  commissionRates: {} as Record<string, number>,
  commissionTable: null as CommissionTableRow[] | null,
  logoPath: null as string | null,
  brandColor: "#0d9488",
  panelColor: "#0f172a",
  brandName: "CRM Group Insurance",
  carrierColors: {} as Record<string, string>,
};

const COMMISSION_TABLE_TEMPLATE: CommissionTableRow[] = [
  { salesSource: "Company Provided", salesType: "New Client", commissionType: "Initial", estimatedCommission: null },
  { salesSource: "Company Provided", salesType: "New Client", commissionType: "Monthly Renewal", estimatedCommission: null },
  { salesSource: "Company Provided", salesType: "Plan Change", commissionType: "Initial", estimatedCommission: null },
  { salesSource: "Company Provided", salesType: "Plan Change", commissionType: "Renewal", estimatedCommission: null },
  { salesSource: "Company Provided", salesType: "Plan Change", commissionType: "Prorated Renewal", estimatedCommission: null },
  { salesSource: "Company Provided", salesType: "AOR", commissionType: "Initial", estimatedCommission: null },
  { salesSource: "Company Provided", salesType: "AOR", commissionType: "Renewal", estimatedCommission: null },
  { salesSource: "Company Provided", salesType: "AOR", commissionType: "Prorated Renewal", estimatedCommission: null },
  { salesSource: "Company Provided", salesType: "AOR", commissionType: "Monthly Renewal", estimatedCommission: null },
  { salesSource: "Self-Generated", salesType: "New Client", commissionType: "Initial", estimatedCommission: null },
  { salesSource: "Self-Generated", salesType: "New Client", commissionType: "Monthly Renewal", estimatedCommission: null },
  { salesSource: "Self-Generated", salesType: "Plan Change", commissionType: "Initial", estimatedCommission: null },
  { salesSource: "Self-Generated", salesType: "Plan Change", commissionType: "Renewal", estimatedCommission: null },
  { salesSource: "Self-Generated", salesType: "Plan Change", commissionType: "Prorated Renewal", estimatedCommission: null },
  { salesSource: "Self-Generated", salesType: "AOR", commissionType: "Prorated Renewal", estimatedCommission: null },
];

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
      commissionTable: (r.commissionTable as CommissionTableRow[] | null) ?? null,
      logoPath: r.logoPath ?? null,
      brandColor: r.brandColor ?? "#0d9488",
      panelColor: r.panelColor ?? "#0f172a",
      brandName: r.brandName ?? "CRM Group Insurance",
      carrierColors: (r.carrierColors as Record<string, string>) ?? {},
    };
  }

  await db.insert(appSettingsTable).values({
    ...DEFAULT_SETTINGS,
    recipients: DEFAULT_SETTINGS.recipients.join(","),
    commissionRates: DEFAULT_SETTINGS.commissionRates,
    commissionTable: DEFAULT_SETTINGS.commissionTable,
  });

  return DEFAULT_SETTINGS;
}

router.get("/settings", requireAuth, async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json(GetSettingsResponse.parse(settings));
});

router.patch("/settings", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const current = await getOrCreateSettings();
  const updated = { ...current, ...parsed.data };

  const dbValue = {
    reportDayOfWeek: updated.reportDayOfWeek as number,
    reportHour: updated.reportHour as number,
    reportMinute: updated.reportMinute as number,
    recipients: (updated.recipients as string[]).join(","),
    commissionRates: updated.commissionRates as Record<string, number>,
    commissionTable: (updated.commissionTable ?? null) as CommissionTableRow[] | null,
    logoPath: (updated.logoPath ?? null) as string | null,
    brandColor: (updated.brandColor ?? "#0d9488") as string,
    panelColor: (updated.panelColor ?? "#0f172a") as string,
    brandName: (updated.brandName ?? "CRM Group Insurance") as string,
    carrierColors: (updated.carrierColors ?? {}) as Record<string, string>,
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

router.get("/settings/commission-table-template", (_req, res): void => {
  const header = "Sales Source,Sales Type,Commission Type,Estimated Commission";
  const rows = COMMISSION_TABLE_TEMPLATE.map(
    (r) => `"${r.salesSource}","${r.salesType}","${r.commissionType}",""`
  );
  const csv = [header, ...rows].join("\r\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="commission_table_template.csv"`);
  res.send(csv);
});

export { router as settingsRouter, getOrCreateSettings };
