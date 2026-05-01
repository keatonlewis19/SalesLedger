import { useState } from "react";
import { format } from "date-fns";
import { Send, FileText, ChevronRight, Users, TrendingUp, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListReports,
  useSendReport,
  useGetReport,
  getListReportsQueryKey,
  getGetReportQueryKey,
} from "@workspace/api-client-react";
import type { WeeklyReport, SaleEntry } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAgencyUser } from "@/hooks/useAgencyUser";

const LOB_LABELS: Record<string, string> = {
  medicare: "Medicare",
  aca: "ACA",
  ancillary: "Ancillary",
  life: "Life Insurance",
  annuity: "Annuities",
};

const LOB_COLORS: Record<string, string> = {
  medicare: "bg-teal-50 text-teal-700 border-teal-200",
  aca: "bg-blue-50 text-blue-700 border-blue-200",
  ancillary: "bg-purple-50 text-purple-700 border-purple-200",
  life: "bg-orange-50 text-orange-700 border-orange-200",
  annuity: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function formatCurrency(val: number | null | undefined) {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

function formatDate(d: string) {
  return format(new Date(d + "T12:00:00"), "MMM d");
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

// ---------- Report Detail Sheet ----------

function ReportDetailSheet({
  reportId,
  open,
  onClose,
  isAdmin,
}: {
  reportId: number | null;
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const safeId = reportId ?? 0;
  const { data, isLoading } = useGetReport(safeId, {
    query: {
      queryKey: getGetReportQueryKey(safeId),
      enabled: open && reportId !== null,
    },
  });

  const totalHra = data?.sales.reduce((s, sale) => s + (sale.hra ?? 0), 0) ?? 0;
  const salesByLob = data ? groupBy(data.sales, (s) => s.lineOfBusiness ?? "other") : {};

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-xl font-bold">
                {data
                  ? `${formatDate(data.weekStart)} – ${format(new Date(data.weekEnd + "T12:00:00"), "MMM d, yyyy")}`
                  : "Loading report…"}
              </SheetTitle>
              {data && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Sent {format(new Date(data.sentAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>

        {isLoading || !data ? (
          <div className="flex-1 p-6 flex flex-col gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Summary cards */}
            <div className="grid grid-cols-3 divide-x border-b">
              <div className="px-5 py-4 text-center">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sales</p>
                <p className="text-3xl font-bold font-mono">{data.totalSales}</p>
              </div>
              <div className="px-5 py-4 text-center">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Commission</p>
                <p className="text-xl font-bold font-mono text-primary">{formatCurrency(data.totalEstimatedCommission)}</p>
              </div>
              <div className="px-5 py-4 text-center">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">HRA</p>
                <p className="text-xl font-bold font-mono text-teal-600">{formatCurrency(totalHra)}</p>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-8">
              {/* LOB breakdown */}
              {data.lobBreakdown.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    By Line of Business
                  </h3>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">LOB</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Sales</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Commission</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">HRA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.lobBreakdown.map((row) => (
                          <tr key={row.lob} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${LOB_COLORS[row.lob] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}>
                                {LOB_LABELS[row.lob] ?? row.lob}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium">{row.count}</td>
                            <td className="px-4 py-3 text-right font-mono text-primary">{formatCurrency(row.commission)}</td>
                            <td className="px-4 py-3 text-right font-mono text-teal-600">{formatCurrency(row.hra)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Agent breakdown (admin only) */}
              {isAdmin && data.agentBreakdown.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    By Agent
                  </h3>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Agent</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Sales</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Commission</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">HRA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.agentBreakdown.map((row) => (
                          <tr key={row.agentName} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-3 font-medium">{row.agentName}</td>
                            <td className="px-4 py-3 text-right font-mono font-medium">{row.count}</td>
                            <td className="px-4 py-3 text-right font-mono text-primary">{formatCurrency(row.commission)}</td>
                            <td className="px-4 py-3 text-right font-mono text-teal-600">{formatCurrency(row.hra)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Sales by LOB */}
              {Object.keys(salesByLob).length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    All Sales
                  </h3>
                  <div className="flex flex-col gap-5">
                    {Object.entries(salesByLob).map(([lob, lobSales]) => (
                      <div key={lob}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${LOB_COLORS[lob] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}>
                            {LOB_LABELS[lob] ?? lob}
                          </span>
                          <span className="text-xs text-muted-foreground">{lobSales.length} sale{lobSales.length !== 1 ? "s" : ""}</span>
                        </div>
                        <SalesTable sales={lobSales} lob={lob} isAdmin={isAdmin} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {data.sales.length === 0 && (
                <div className="py-10 text-center text-muted-foreground">
                  No sales found for this week.
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SalesTable({
  sales,
  lob,
  isAdmin,
}: {
  sales: SaleEntry[];
  lob: string;
  isAdmin: boolean;
}) {
  const isMedicare = lob === "medicare";
  const isAca = lob === "aca";

  return (
    <div className="border rounded-xl overflow-x-auto">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="bg-muted/40 border-b">
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Client</th>
            {isAdmin && <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Agent</th>}
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Plan</th>
            {isMedicare && <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Type</th>}
            {(isAca) && <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Tier</th>}
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Carrier</th>
            <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Date</th>
            <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Comm.</th>
            {isMedicare && <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">HRA</th>}
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-3 py-2.5 font-medium whitespace-nowrap">{s.clientName}</td>
              {isAdmin && (
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{s.agentName ?? "—"}</td>
              )}
              <td className="px-3 py-2.5 text-muted-foreground">{s.salesType}</td>
              {isMedicare && (
                <td className="px-3 py-2.5">
                  {s.commissionType ? (
                    <Badge variant="outline" className="text-xs font-normal">{s.commissionType}</Badge>
                  ) : "—"}
                </td>
              )}
              {isAca && <td className="px-3 py-2.5 text-muted-foreground">{s.metalTier ?? "—"}</td>}
              <td className="px-3 py-2.5 text-muted-foreground">{s.carrier ?? "—"}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                {formatDate(s.soldDate)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-primary whitespace-nowrap">
                {formatCurrency(s.estimatedCommission)}
              </td>
              {isMedicare && (
                <td className="px-3 py-2.5 text-right font-mono text-teal-600 whitespace-nowrap">
                  {s.hra ? formatCurrency(s.hra) : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Main Page ----------

export default function History() {
  const { data: reports, isLoading } = useListReports();
  const sendReport = useSendReport();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAgencyUser();
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  const handleSendReport = () => {
    sendReport.mutate(undefined, {
      onSuccess: (res) => {
        toast({ title: "Report sent successfully!", description: res.message });
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to send report", variant: "destructive" });
      },
    });
  };

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Past Reports</h1>
            <p className="text-muted-foreground mt-1">
              Click any report to view the full sales breakdown.
            </p>
          </div>
          {isAdmin && (
            <Button
              className="gap-2 shrink-0 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleSendReport}
              disabled={sendReport.isPending}
            >
              <Send className="w-4 h-4" />
              {sendReport.isPending ? "Sending..." : "Send Report Now"}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))
          ) : reports?.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-xl">
              <FileText className="w-12 h-12 mb-4 text-muted" />
              <h3 className="text-lg font-medium text-foreground mb-1">No reports yet</h3>
              <p>Weekly reports will appear here once sent.</p>
            </div>
          ) : (
            reports?.map((report: WeeklyReport) => (
              <Card
                key={report.id}
                className="overflow-hidden hover:shadow-md transition-all cursor-pointer group border-2 hover:border-teal-200"
                onClick={() => setSelectedReportId(report.id)}
              >
                <div className="bg-muted/40 px-5 py-3 border-b flex justify-between items-center">
                  <div className="font-medium text-sm">
                    {formatDate(report.weekStart)} – {format(new Date(report.weekEnd + "T12:00:00"), "MMM d, yyyy")}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Sent {format(new Date(report.sentAt), "MMM d")}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-teal-600 transition-colors" />
                  </div>
                </div>
                <CardContent className="p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Sales</p>
                      <p className="text-2xl font-bold font-mono">{report.totalSales}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Commission</p>
                      <p className="text-xl font-bold font-mono text-primary">
                        {formatCurrency(report.totalEstimatedCommission)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 group-hover:text-teal-600 transition-colors">
                    Click to view full report →
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <ReportDetailSheet
        reportId={selectedReportId}
        open={selectedReportId !== null}
        onClose={() => setSelectedReportId(null)}
        isAdmin={isAdmin}
      />
    </Layout>
  );
}
