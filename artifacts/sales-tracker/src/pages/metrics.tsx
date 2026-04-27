import { useGetMetrics } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${fmt(n, 1)}%`;
}
function fmtMoney(n: number) {
  return `$${fmt(n)}`;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function MetricsPage() {
  const { data, isLoading } = useGetMetrics();

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
  const lsp = data?.leadSourcePerformance ?? [];
  const pipeline = data?.leadSourcePipeline ?? [];
  const carriers = data?.carrierPerformance ?? [];

  const roiColor = (roi: number | null | undefined) => {
    if (roi == null) return "";
    return roi >= 0 ? "text-green-600" : "text-red-600";
  };

  return (
    <Layout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Business Analytics</h1>
          <p className="text-muted-foreground text-sm">Medicare business performance dashboard</p>
        </div>

        {/* Business Performance */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Business Performance</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label="Total Leads" value={String(s?.totalLeads ?? 0)} />
            <KpiCard label="New Sales" value={String(s?.newSales ?? 0)} />
            <KpiCard label="Close Rate" value={fmtPct(s?.closeRate)} />
            <KpiCard label="Total Revenue" value={fmtMoney(s?.totalRevenue ?? 0)} />
            <KpiCard label="Avg Revenue / Sale" value={fmtMoney(s?.avgRevenuePerSale ?? 0)} />
            <KpiCard label="Avg Revenue / Lead" value={fmtMoney(s?.avgRevenuePerLead ?? 0)} />
          </div>
        </section>

        {/* Marketing + Pipeline Health */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Marketing + Pipeline Health</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label="Paid Marketing Revenue" value={fmtMoney(s?.paidMarketingRevenue ?? 0)} />
            <KpiCard
              label="Cost per Acquisition"
              value={fmtMoney(s?.costPerAcquisition ?? 0)}
              sub={
                s?.costPerAcquisition && s?.avgRevenuePerSale
                  ? s.costPerAcquisition > s.avgRevenuePerSale
                    ? "⚠ CPA exceeds avg sale"
                    : "✓ Profitable"
                  : undefined
              }
            />
            <KpiCard
              label="Marketing ROI"
              value={fmtPct(s?.marketingRoi)}
            />
            <KpiCard label="Open Leads" value={String(s?.openLeads ?? 0)} />
            <KpiCard label="Avg Days to Close" value={fmt(s?.avgDaysToClose ?? 0, 1)} />
            <KpiCard label="Leads > 14 Days" value={String(s?.leadsOlderThan14 ?? 0)} />
          </div>
        </section>

        {/* Lead Source Performance */}
        {lsp.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Lead Source Performance</h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium">Lead Source</th>
                        <th className="text-right px-4 py-3 font-medium">Leads</th>
                        <th className="text-right px-4 py-3 font-medium">Sales</th>
                        <th className="text-right px-4 py-3 font-medium">Revenue</th>
                        <th className="text-right px-4 py-3 font-medium">Cost / Lead</th>
                        <th className="text-right px-4 py-3 font-medium">CPA</th>
                        <th className="text-right px-4 py-3 font-medium">ROI</th>
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
                          <td className="px-4 py-3 text-right">{row.cpa != null ? fmtMoney(row.cpa) : "—"}</td>
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
          </section>
        )}

        {/* Lead Source Pipeline */}
        {pipeline.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Lead Source Pipeline</h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium">Lead Source</th>
                        <th className="text-right px-4 py-3 font-medium">Leads</th>
                        <th className="text-right px-4 py-3 font-medium">In Comm.</th>
                        <th className="text-right px-4 py-3 font-medium">Appt. Set</th>
                        <th className="text-right px-4 py-3 font-medium">Follow-Up</th>
                        <th className="text-right px-4 py-3 font-medium">Sold</th>
                        <th className="text-right px-4 py-3 font-medium">Lost</th>
                        <th className="text-right px-4 py-3 font-medium">Close Rate</th>
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
                        <td className="px-4 py-3 text-right">{pipeline.reduce((s: number, r: any) => s + r.leads, 0)}</td>
                        <td className="px-4 py-3 text-right">{pipeline.reduce((s: number, r: any) => s + r.inComm, 0)}</td>
                        <td className="px-4 py-3 text-right">{pipeline.reduce((s: number, r: any) => s + r.apptSet, 0)}</td>
                        <td className="px-4 py-3 text-right">{pipeline.reduce((s: number, r: any) => s + r.followUp, 0)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{pipeline.reduce((s: number, r: any) => s + r.sold, 0)}</td>
                        <td className="px-4 py-3 text-right text-red-500">{pipeline.reduce((s: number, r: any) => s + r.lost, 0)}</td>
                        <td className="px-4 py-3 text-right">
                          {(() => {
                            const totalL = pipeline.reduce((s: number, r: any) => s + r.leads, 0);
                            const totalS = pipeline.reduce((s: number, r: any) => s + r.sold, 0);
                            return fmtPct(totalL > 0 ? (totalS / totalL) * 100 : 0);
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Carrier Performance */}
        {carriers.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Carrier Performance</h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium">Carrier</th>
                        <th className="text-right px-4 py-3 font-medium">Sales</th>
                        <th className="text-right px-4 py-3 font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carriers.map((row: any, i: number) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{row.carrier}</td>
                          <td className="px-4 py-3 text-right">{row.sales}</td>
                          <td className="px-4 py-3 text-right">{fmtMoney(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
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
