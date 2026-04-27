import { Router, type IRouter } from "express";
import { db, leadsTable, leadSourcesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/metrics", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { userId, agencyUser } = req;
  const isAdmin = agencyUser?.role === "admin";

  const rows = isAdmin
    ? await db
        .select()
        .from(leadsTable)
        .leftJoin(leadSourcesTable, eq(leadsTable.leadSourceId, leadSourcesTable.id))
    : await db
        .select()
        .from(leadsTable)
        .leftJoin(leadSourcesTable, eq(leadsTable.leadSourceId, leadSourcesTable.id))
        .where(eq(leadsTable.userId, userId!));

  const leads = rows.map((r) => ({ ...r.leads, leadSource: r.lead_sources }));

  const today = new Date().toISOString().slice(0, 10);

  // Overall KPIs
  const totalLeads = leads.length;
  const soldLeads = leads.filter((l) => l.status === "sold");
  const newSales = soldLeads.length;
  const closeRate = totalLeads > 0 ? (newSales / totalLeads) * 100 : 0;
  const totalRevenue = soldLeads.reduce((sum, l) => sum + (l.revenue ?? 0), 0);
  const avgRevenuePerSale = newSales > 0 ? totalRevenue / newSales : 0;
  const avgRevenuePerLead = totalLeads > 0 ? totalRevenue / totalLeads : 0;

  // Paid lead KPIs
  const paidLeads = leads.filter((l) => l.leadSource?.isPaid);
  const paidSold = paidLeads.filter((l) => l.status === "sold");
  const paidRevenue = paidSold.reduce((sum, l) => sum + (l.revenue ?? 0), 0);
  const totalPaidCost = paidLeads.reduce(
    (sum, l) => sum + (l.costPerLead ?? l.leadSource?.costPerLead ?? 0),
    0,
  );
  const paidSalesCount = paidSold.length;
  const cpa = paidSalesCount > 0 ? totalPaidCost / paidSalesCount : 0;
  const marketingRoi =
    totalPaidCost > 0 ? ((paidRevenue - totalPaidCost) / totalPaidCost) * 100 : null;

  const openLeads = leads.filter((l) => l.status !== "sold" && l.status !== "lost").length;

  // Avg days to close
  const closedWithDates = soldLeads.filter((l) => l.soldDate && l.enteredDate);
  const avgDaysToClose =
    closedWithDates.length > 0
      ? closedWithDates.reduce((sum, l) => {
          const entered = new Date(l.enteredDate).getTime();
          const sold = new Date(l.soldDate!).getTime();
          return sum + (sold - entered) / 86400000;
        }, 0) / closedWithDates.length
      : 0;

  const leadsOlderThan14 = leads.filter((l) => {
    if (l.status === "sold" || l.status === "lost") return false;
    const entered = new Date(l.enteredDate).getTime();
    const now = new Date(today).getTime();
    return (now - entered) / 86400000 > 14;
  }).length;

  // --- Per lead source ---
  const sourceMap = new Map<
    string,
    {
      sourceId: number | null;
      sourceName: string;
      isPaid: boolean;
      costPerLead: number;
      leads: typeof leads;
    }
  >();

  const NO_SOURCE_KEY = "__none__";

  for (const lead of leads) {
    const key = lead.leadSourceId != null ? String(lead.leadSourceId) : NO_SOURCE_KEY;
    const sourceName = lead.leadSource?.name ?? "No Source";
    if (!sourceMap.has(key)) {
      sourceMap.set(key, {
        sourceId: lead.leadSourceId,
        sourceName,
        isPaid: lead.leadSource?.isPaid ?? false,
        costPerLead: lead.leadSource?.costPerLead ?? 0,
        leads: [],
      });
    }
    sourceMap.get(key)!.leads.push(lead);
  }

  const leadSourcePerformance = Array.from(sourceMap.values()).map((src) => {
    const srcLeads = src.leads;
    const srcSold = srcLeads.filter((l) => l.status === "sold");
    const srcRevenue = srcSold.reduce((sum, l) => sum + (l.revenue ?? 0), 0);
    const totalCost = srcLeads.reduce(
      (sum, l) => sum + (l.costPerLead ?? src.costPerLead),
      0,
    );
    const srcSalesCount = srcSold.length;
    const srcCpa = srcSalesCount > 0 ? totalCost / srcSalesCount : null;
    const srcRoi = totalCost > 0 ? ((srcRevenue - totalCost) / totalCost) * 100 : null;

    return {
      sourceId: src.sourceId,
      sourceName: src.sourceName,
      isPaid: src.isPaid,
      leads: srcLeads.length,
      sales: srcSalesCount,
      revenue: srcRevenue,
      costPerLead: src.isPaid ? src.costPerLead : null,
      cpa: src.isPaid ? srcCpa : null,
      roi: src.isPaid ? srcRoi : null,
    };
  });

  const leadSourcePipeline = Array.from(sourceMap.values()).map((src) => {
    const srcLeads = src.leads;
    const count = (s: string) => srcLeads.filter((l) => l.status === s).length;
    const soldCount = count("sold");
    const closeRateSrc = srcLeads.length > 0 ? (soldCount / srcLeads.length) * 100 : 0;

    return {
      sourceId: src.sourceId,
      sourceName: src.sourceName,
      leads: srcLeads.length,
      inComm: count("in_comm"),
      apptSet: count("appt_set"),
      followUp: count("follow_up"),
      sold: soldCount,
      lost: count("lost"),
      closeRate: closeRateSrc,
    };
  });

  // Carrier performance
  const carrierMap = new Map<string, { sales: number; revenue: number }>();
  for (const lead of soldLeads) {
    const carrier = lead.carrier ?? "Unknown";
    if (!carrierMap.has(carrier)) carrierMap.set(carrier, { sales: 0, revenue: 0 });
    const c = carrierMap.get(carrier)!;
    c.sales += 1;
    c.revenue += lead.revenue ?? 0;
  }
  const carrierPerformance = Array.from(carrierMap.entries())
    .map(([carrier, data]) => ({ carrier, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  res.json({
    summary: {
      totalLeads,
      newSales,
      closeRate,
      totalRevenue,
      avgRevenuePerSale,
      avgRevenuePerLead,
      paidMarketingRevenue: paidRevenue,
      costPerAcquisition: cpa,
      marketingRoi,
      openLeads,
      avgDaysToClose,
      leadsOlderThan14,
    },
    leadSourcePerformance,
    leadSourcePipeline,
    carrierPerformance,
  });
});

export default router;
