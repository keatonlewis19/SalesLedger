import { useState } from "react";
import { useGetMetrics, useGetSettings, useListAgencyUsers } from "@workspace/api-client-react";
import { useAgencyUser } from "@/hooks/useAgencyUser";
import { Layout } from "@/components/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const FALLBACK_COLORS = [
  "#0d9488","#3b82f6","#f59e0b","#8b5cf6","#ec4899",
  "#10b981","#f97316","#06b6d4","#84cc16","#6366f1",
];

const STATUS_COLORS: Record<string, string> = {
  new: "#94a3b8",
  in_comm: "#3b82f6",
  appt_set: "#f59e0b",
  follow_up: "#8b5cf6",
  sold: "#10b981",
  lost: "#ef4444",
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${fmt(n, 1)}%`;
}
function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${fmt(n)}`;
}
function roiColor(roi: number | null | undefined) {
  if (roi == null) return "";
  return roi > 0 ? "text-green-600" : "text-red-600";
}

function cpaColor(cpa: number | null | undefined, avgRevPerSale: number | null | undefined) {
  if (cpa == null || !avgRevPerSale || avgRevPerSale === 0) return "";
  if (cpa > avgRevPerSale) return "text-red-600";
  if (cpa >= avgRevPerSale * 0.7) return "text-yellow-600";
  return "text-green-600";
}

function KpiCard({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 leading-tight">{label}</p>
        <p className={cn("text-lg sm:text-2xl font-bold break-all leading-tight", valueColor ?? "text-foreground")}>{value}</p>
        {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">{sub}</p>}
      </CardContent>
    </Card>
  );
}

type SortDir = "asc" | "desc";
function useSortState(defaultCol: string, defaultDir: SortDir = "asc") {
  const [col, setCol] = useState(defaultCol);
  const [dir, setDir] = useState<SortDir>(defaultDir);
  const toggle = (c: string) => {
    if (col === c) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setCol(c); setDir("asc"); }
  };
  return { col, dir, toggle };
}

function SortTh({
  label, col, sort, align = "right",
}: { label: string; col: string; sort: ReturnType<typeof useSortState>; align?: "left" | "right" }) {
  const active = sort.col === col;
  return (
    <th className={cn("px-4 py-3 font-medium", align === "right" ? "text-right" : "text-left")}>
      <button
        onClick={() => sort.toggle(col)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground transition-colors group",
          align === "right" ? "flex-row-reverse" : "flex-row",
          active ? "text-foreground" : "text-foreground/70")}
      >
        {label}
        {active
          ? sort.dir === "asc"
            ? <ChevronUp className="w-3.5 h-3.5" />
            : <ChevronDown className="w-3.5 h-3.5" />
          : <ChevronsUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-70 transition-opacity" />}
      </button>
    </th>
  );
}

function sortRows<T extends Record<string, any>>(rows: T[], col: string, dir: SortDir): T[] {
  return [...rows].sort((a, b) => {
    let av = a[col] ?? null;
    let bv = b[col] ?? null;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
    return dir === "asc" ? cmp : -cmp;
  });
}

function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-background border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold">{d.name}</p>
      <p className="text-muted-foreground">{fmtMoney(d.value)}</p>
      <p className="text-muted-foreground text-xs">{fmtPct(d.payload.pct)}</p>
    </div>
  );
}

function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg px-3 py-2 text-sm max-w-[200px]">
      <p className="font-semibold mb-1 truncate">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-xs" style={{ color: p.fill ?? p.color }}>
          {p.name}: {typeof p.value === "number" && p.name.includes("Revenue") ? fmtMoney(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function MetricsPage() {
  const { isAdmin } = useAgencyUser();
  const [selectedAgent, setSelectedAgent] = useState<string>("__all");
  const { data: agencyUsers = [] } = useListAgencyUsers();

  const metricsParams = isAdmin && selectedAgent !== "__all"
    ? { agentUserId: selectedAgent }
    : undefined;

  const { data, isLoading } = useGetMetrics(metricsParams);
  const { data: settings } = useGetSettings();

  const carrierColors: Record<string, string> = (settings as any)?.carrierColors ?? {};

  const getCarrierColor = (name: string, idx: number) =>
    carrierColors[name] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

  const lspSort = useSortState("revenue", "desc");
  const pipeSort = useSortState("leads", "desc");
  const carrierSort = useSortState("revenue", "desc");

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </Layout>
    );
  }

  const s = data?.summary;
  const lsp = sortRows(data?.leadSourcePerformance ?? [], lspSort.col, lspSort.dir);
  const pipeline = sortRows(data?.leadSourcePipeline ?? [], pipeSort.col, pipeSort.dir);
  const carriers = sortRows(data?.carrierPerformance ?? [], carrierSort.col, carrierSort.dir);

  const rawCarriers = data?.carrierPerformance ?? [];
  const totalCarrierRev = rawCarriers.reduce((s: number, c: any) => s + (c.revenue ?? 0), 0);
  const carrierPieData = rawCarriers.map((c: any) => ({
    name: c.carrier,
    value: c.revenue,
    pct: totalCarrierRev > 0 ? (c.revenue / totalCarrierRev) * 100 : 0,
  }));

  const sourceBarData = (data?.leadSourcePerformance ?? []).map((r: any) => ({
    name: r.sourceName,
    Revenue: r.revenue,
    Leads: r.leads,
  }));

  const pipelineBarData = (data?.leadSourcePipeline ?? []).map((r: any) => ({
    name: r.sourceName,
    "In Comm": r.inComm,
    "Appt Set": r.apptSet,
    "Follow Up": r.followUp,
    Sold: r.sold,
    Lost: r.lost,
  }));

  return (
    <Layout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Medicare Analytics</h1>
            <p className="text-muted-foreground text-sm">Medicare business performance — all metrics reflect Medicare leads only</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">View:</span>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Whole Agency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Whole Agency</SelectItem>
                  {(agencyUsers as any[]).map((u) => (
                    <SelectItem key={u.clerkUserId} value={u.clerkUserId}>
                      {u.fullName || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Business Performance KPIs */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Business Performance</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label="Total Leads" value={String(s?.totalLeads ?? 0)} />
            <KpiCard label="New Sales" value={String(s?.newSales ?? 0)} />
            <KpiCard label="Close Rate" value={fmtPct(s?.closeRate)} />
            <KpiCard label="Total Revenue" value={fmtMoney(s?.totalRevenue ?? 0) ?? "—"} />
            <KpiCard label="Avg Revenue / Sale" value={fmtMoney(s?.avgRevenuePerSale ?? 0) ?? "—"} />
            <KpiCard label="Avg Revenue / Lead" value={fmtMoney(s?.avgRevenuePerLead ?? 0) ?? "—"} />
          </div>
        </section>

        {/* Marketing + Pipeline Health KPIs */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Marketing + Pipeline Health</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label="Paid Marketing Revenue" value={fmtMoney(s?.paidMarketingRevenue ?? 0) ?? "—"} />
            <KpiCard
              label="Cost per Acquisition"
              value={s?.costPerAcquisition != null ? fmtMoney(s.costPerAcquisition) : "—"}
              valueColor={cpaColor(s?.costPerAcquisition, s?.avgRevenuePerSale)}
              sub={s?.costPerAcquisition != null && s?.avgRevenuePerSale
                ? s.costPerAcquisition > s.avgRevenuePerSale
                  ? "⚠ CPA exceeds avg sale"
                  : s.costPerAcquisition >= s.avgRevenuePerSale * 0.7
                    ? "⚠ CPA approaching avg sale"
                    : "✓ CPA well below avg sale"
                : undefined}
            />
            <KpiCard
              label="Marketing ROI"
              value={fmtPct(s?.marketingRoi)}
              valueColor={s?.marketingRoi != null ? (s.marketingRoi > 0 ? "text-green-600" : "text-red-600") : undefined}
            />
            <KpiCard label="Open Leads" value={String(s?.openLeads ?? 0)} />
            <KpiCard label="Avg Days to Close" value={fmt(s?.avgDaysToClose ?? 0, 1)} />
            <KpiCard label="Leads > 14 Days" value={String(s?.leadsOlderThan14 ?? 0)} />
          </div>
        </section>

        {/* Lead Source Performance */}
        {(data?.leadSourcePerformance ?? []).length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Lead Source Performance</h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <SortTh label="Lead Source" col="sourceName" sort={lspSort} align="left" />
                        <SortTh label="Leads" col="leads" sort={lspSort} />
                        <SortTh label="Sales" col="sales" sort={lspSort} />
                        <SortTh label="Revenue" col="revenue" sort={lspSort} />
                        <SortTh label="Cost / Lead" col="costPerLead" sort={lspSort} />
                        <SortTh label="CPA" col="cpa" sort={lspSort} />
                        <SortTh label="ROI" col="roi" sort={lspSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {lsp.map((row: any, i: number) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">
                            {row.sourceName}
                            {row.isPaid && <Badge variant="outline" className="ml-2 text-xs">Paid</Badge>}
                          </td>
                          <td className="px-4 py-3 text-right">{row.leads}</td>
                          <td className="px-4 py-3 text-right">{row.sales}</td>
                          <td className="px-4 py-3 text-right">{fmtMoney(row.revenue)}</td>
                          <td className="px-4 py-3 text-right">{row.costPerLead != null ? fmtMoney(row.costPerLead) : "—"}</td>
                          <td className={cn("px-4 py-3 text-right font-medium", cpaColor(row.cpa, s?.avgRevenuePerSale))}>
                            {row.cpa != null ? fmtMoney(row.cpa) : "—"}
                          </td>
                          <td className={cn("px-4 py-3 text-right font-medium", roiColor(row.roi))}>
                            {fmtPct(row.roi)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Revenue by Lead Source chart */}
            {sourceBarData.length > 0 && (
              <Card>
                <CardContent className="pt-5 pb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Revenue by Source</p>
                  <ResponsiveContainer width="100%" height={Math.max(180, sourceBarData.length * 42)}>
                    <BarChart data={sourceBarData} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="Revenue" radius={[0, 4, 4, 0]} fill="#0d9488" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* Lead Source Pipeline */}
        {(data?.leadSourcePipeline ?? []).length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Lead Source Pipeline</h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <SortTh label="Lead Source" col="sourceName" sort={pipeSort} align="left" />
                        <SortTh label="Leads" col="leads" sort={pipeSort} />
                        <SortTh label="In Comm." col="inComm" sort={pipeSort} />
                        <SortTh label="Appt. Set" col="apptSet" sort={pipeSort} />
                        <SortTh label="Follow-Up" col="followUp" sort={pipeSort} />
                        <SortTh label="Sold" col="sold" sort={pipeSort} />
                        <SortTh label="Lost" col="lost" sort={pipeSort} />
                        <SortTh label="Close Rate" col="closeRate" sort={pipeSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {pipeline.map((row: any, i: number) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{row.sourceName}</td>
                          <td className="px-4 py-3 text-right">{row.leads}</td>
                          <td className="px-4 py-3 text-right">{row.inComm}</td>
                          <td className="px-4 py-3 text-right">{row.apptSet}</td>
                          <td className="px-4 py-3 text-right">{row.followUp}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-medium">{row.sold}</td>
                          <td className="px-4 py-3 text-right text-red-500">{row.lost}</td>
                          <td className="px-4 py-3 text-right font-medium">{fmtPct(row.closeRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/40 font-semibold border-t">
                        <td className="px-4 py-3">Totals</td>
                        {(["leads","inComm","apptSet","followUp"] as const).map((k) => (
                          <td key={k} className="px-4 py-3 text-right">
                            {(data?.leadSourcePipeline ?? []).reduce((s: number, r: any) => s + (r[k] ?? 0), 0)}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right text-green-600">
                          {(data?.leadSourcePipeline ?? []).reduce((s: number, r: any) => s + (r.sold ?? 0), 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-red-500">
                          {(data?.leadSourcePipeline ?? []).reduce((s: number, r: any) => s + (r.lost ?? 0), 0)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(() => {
                            const tL = (data?.leadSourcePipeline ?? []).reduce((s: number, r: any) => s + r.leads, 0);
                            const tS = (data?.leadSourcePipeline ?? []).reduce((s: number, r: any) => s + r.sold, 0);
                            return fmtPct(tL > 0 ? (tS / tL) * 100 : 0);
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Pipeline stacked bar chart */}
            {pipelineBarData.length > 0 && (
              <Card>
                <CardContent className="pt-5 pb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Pipeline Status by Source</p>
                  <ResponsiveContainer width="100%" height={Math.max(200, pipelineBarData.length * 48)}>
                    <BarChart data={pipelineBarData} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {Object.entries({ "In Comm": "in_comm", "Appt Set": "appt_set", "Follow Up": "follow_up", Sold: "sold", Lost: "lost" }).map(([label, key]) => (
                        <Bar key={label} dataKey={label} stackId="a" fill={STATUS_COLORS[key]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* Carrier Performance */}
        {carriers.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Carrier Performance</h2>
            <div className={cn(carrierPieData.length > 1 ? "grid md:grid-cols-2 gap-4" : "")}>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <SortTh label="Carrier" col="carrier" sort={carrierSort} align="left" />
                          <SortTh label="Sales" col="sales" sort={carrierSort} />
                          <SortTh label="Revenue" col="revenue" sort={carrierSort} />
                        </tr>
                      </thead>
                      <tbody>
                        {carriers.map((row: any, i: number) => {
                          const color = getCarrierColor(row.carrier, rawCarriers.findIndex((c: any) => c.carrier === row.carrier));
                          return (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-4 py-3 font-medium">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span style={{ color }}>{row.carrier}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">{row.sales}</td>
                              <td className="px-4 py-3 text-right">{fmtMoney(row.revenue)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Carrier donut chart */}
              {carrierPieData.length > 1 && (
                <Card>
                  <CardContent className="pt-5 pb-3 flex flex-col items-center">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 self-start">Revenue Distribution</p>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={carrierPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={105}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {carrierPieData.map((_: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={getCarrierColor(carrierPieData[index].name, index)}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                        <Legend
                          formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
                          wrapperStyle={{ fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}

        {!s?.totalLeads && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium mb-1">No leads yet</p>
              <p className="text-sm">Add leads in the Leads page to start seeing metrics here.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
