import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSales,
  useMarkSalePaid,
  getListSalesQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgencyUser } from "@/hooks/useAgencyUser";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle2, Clock } from "lucide-react";

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

type FilterPaid = "all" | "paid" | "unpaid";

export default function AdminSalesPage() {
  const { isAdmin } = useAgencyUser();
  const { data: sales = [], isLoading } = useListSales();
  const markPaid = useMarkSalePaid();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [filterPaid, setFilterPaid] = useState<FilterPaid>("all");
  const [filterAgent, setFilterAgent] = useState<string>("__all");
  const [toggling, setToggling] = useState<Set<number>>(new Set());

  if (!agencyLoading && !isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  const agents = useMemo(() => {
    const names = new Set<string>();
    for (const s of sales) {
      if (s.agentName) names.add(s.agentName);
    }
    return [...names].sort();
  }, [sales]);

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (filterPaid === "paid" && !s.paid) return false;
      if (filterPaid === "unpaid" && s.paid) return false;
      if (filterAgent !== "__all" && s.agentName !== filterAgent) return false;
      return true;
    });
  }, [sales, filterPaid, filterAgent]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.soldDate.localeCompare(a.soldDate)),
    [filtered]
  );

  const totalComm = sorted.reduce((a, s) => a + (s.estimatedCommission ?? 0), 0);
  const paidComm = sorted.filter((s) => s.paid).reduce((a, s) => a + (s.estimatedCommission ?? 0), 0);
  const owedComm = sorted.filter((s) => !s.paid).reduce((a, s) => a + (s.estimatedCommission ?? 0), 0);

  const handleToggle = (id: number, currentPaid: boolean) => {
    if (toggling.has(id)) return;
    setToggling((prev) => new Set(prev).add(id));
    markPaid.mutate(
      { id, data: { paid: !currentPaid } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to update payment status", variant: "destructive" });
        },
        onSettled: () => {
          setToggling((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      }
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Sales</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin
              ? "Track commission payments across all agents. Check the box once you've paid an agent."
              : "Your sales and commission payment status. Paid rows turn green when the agency marks you paid."}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Total Commission
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{fmt(totalComm)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{sorted.length} sales</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Paid Out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{fmt(paidComm)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{sorted.filter((s) => s.paid).length} sales</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" /> Still Owed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{fmt(owedComm)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{sorted.filter((s) => !s.paid).length} sales</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={filterPaid} onValueChange={(v) => setFilterPaid(v as FilterPaid)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="unpaid">Unpaid only</SelectItem>
              <SelectItem value="paid">Paid only</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin && (
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All agents</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">No sales match the current filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground w-12">Paid</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Client</th>
                      {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Agent</th>}
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sold Date</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Commission Type</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">HRA</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Est. Commission</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((sale, i) => (
                      <tr
                        key={sale.id}
                        className={`border-b transition-colors ${
                          sale.paid
                            ? "bg-green-50/60 dark:bg-green-950/20"
                            : i % 2 === 0
                            ? "bg-background"
                            : "bg-muted/20"
                        } hover:bg-muted/40`}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={sale.paid}
                            disabled={!isAdmin || toggling.has(sale.id)}
                            onCheckedChange={isAdmin ? () => handleToggle(sale.id, sale.paid) : undefined}
                            aria-label={sale.paid ? "Commission paid" : "Commission pending"}
                            className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{sale.clientName}</td>
                        {isAdmin && <td className="px-4 py-3 text-muted-foreground">{sale.agentName ?? "—"}</td>}
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">{sale.salesType}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{sale.salesSource ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{sale.soldDate}</td>
                        <td className="px-4 py-3 text-muted-foreground">{sale.commissionType}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {sale.hra != null ? fmt(sale.hra) : "None"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                          {fmt(sale.estimatedCommission)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={sale.comments ?? ""}>
                          {sale.comments ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/50 font-semibold">
                      <td colSpan={isAdmin ? 8 : 7} className="px-4 py-3 text-muted-foreground text-xs">
                        {sorted.filter((s) => s.paid).length} of {sorted.length} paid
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(totalComm)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
