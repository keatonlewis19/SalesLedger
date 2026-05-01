import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSales,
  useDeleteSale,
  useMarkSalePaid,
  getListSalesQueryKey,
  getGetCurrentWeekSummaryQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { SaleForm } from "@/components/sale-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAgencyUser } from "@/hooks/useAgencyUser";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, ChevronLeft, ChevronRight, CheckCircle2, Clock,
  Users, TrendingUp, Edit2, Trash2, AlertTriangle,
} from "lucide-react";

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getCurrentWeekStart(): string {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysBack = (dayOfWeek - 5 + 7) % 7;
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split("T")[0];
}

function shiftWeek(weekStart: string, n: number): string {
  const d = new Date(weekStart + "T12:00:00Z");
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split("T")[0];
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00Z");
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}

const LOB_ORDER = [
  { value: "medicare", label: "Medicare" },
  { value: "aca", label: "ACA / Individual Health" },
  { value: "ancillary", label: "Ancillary" },
  { value: "life", label: "Life Insurance" },
  { value: "annuity", label: "Annuities" },
] as const;

const LOB_LABELS: Record<string, string> = {
  medicare: "Medicare",
  aca: "ACA / Individual Health",
  ancillary: "Ancillary",
  life: "Life Insurance",
  annuity: "Annuities",
};

const LOB_COLORS: Record<string, string> = {
  medicare: "bg-teal-50 text-teal-700 border-teal-200",
  aca: "bg-blue-50 text-blue-700 border-blue-200",
  ancillary: "bg-purple-50 text-purple-700 border-purple-200",
  life: "bg-orange-50 text-orange-700 border-orange-200",
  annuity: "bg-rose-50 text-rose-700 border-rose-200",
};

const LOB_HEADER_COLORS: Record<string, string> = {
  medicare: "bg-teal-50/60 border-teal-100",
  aca: "bg-blue-50/60 border-blue-100",
  ancillary: "bg-purple-50/60 border-purple-100",
  life: "bg-orange-50/60 border-orange-100",
  annuity: "bg-rose-50/60 border-rose-100",
};

type Sale = {
  id: number;
  userId: string | null;
  agentName?: string | null;
  clientName: string;
  salesSource: string | null;
  leadSource: string | null;
  salesType: string;
  lineOfBusiness: string | null;
  carrier: string | null;
  soldDate: string;
  effectiveDate: string | null;
  commissionType: string;
  hra: number | null;
  estimatedCommission: number | null;
  paid: boolean;
  comments?: string | null;
};

function groupByLob(sales: Sale[]) {
  const known = new Set(LOB_ORDER.map((l) => l.value as string));
  const result: { lob: string; label: string; sales: Sale[] }[] = [];
  for (const { value, label } of LOB_ORDER) {
    const s = sales.filter((x) => (x.lineOfBusiness ?? "medicare") === value);
    if (s.length > 0) result.push({ lob: value, label, sales: s });
  }
  const other = sales.filter((x) => !known.has(x.lineOfBusiness ?? "medicare"));
  if (other.length > 0) result.push({ lob: "other", label: "Other", sales: other });
  return result;
}

interface SalesTableProps {
  sales: Sale[];
  isAdmin: boolean;
  showAgentColumn: boolean;
  onEdit?: (sale: Sale) => void;
  onDelete: (id: number) => void;
  onTogglePaid: (id: number, current: boolean) => void;
  isPaidPending: boolean;
}

function SalesTable({ sales, isAdmin, showAgentColumn, onDelete, onTogglePaid, isPaidPending }: SalesTableProps) {
  const colCount = showAgentColumn ? 14 : 13;
  if (sales.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/10">
            <TableHead>Client</TableHead>
            {showAgentColumn && <TableHead>Agent</TableHead>}
            <TableHead>Sales Source</TableHead>
            <TableHead>Lead Source</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Product Type</TableHead>
            <TableHead>Carrier</TableHead>
            <TableHead>Sold Date</TableHead>
            <TableHead>Eff. Date</TableHead>
            <TableHead>Comm. Type</TableHead>
            <TableHead className="text-right">HRA</TableHead>
            <TableHead className="text-right">Est. Commission</TableHead>
            <TableHead className="text-center">Paid</TableHead>
            <TableHead className="w-[80px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <TableRow
              key={sale.id}
              className={`group ${sale.paid ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "bg-amber-50/60 dark:bg-amber-950/20"}`}
            >
              <TableCell className="font-medium">{sale.clientName}</TableCell>
              {showAgentColumn && (
                <TableCell className="text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {(sale.agentName ?? "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="text-foreground font-medium">{sale.agentName ?? "—"}</span>
                  </span>
                </TableCell>
              )}
              <TableCell className="text-muted-foreground text-sm">{sale.salesSource || "—"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{sale.leadSource || "—"}</TableCell>
              <TableCell>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                  {sale.salesType}
                </span>
              </TableCell>
              <TableCell>
                {sale.lineOfBusiness ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${LOB_COLORS[sale.lineOfBusiness] ?? "bg-slate-50 text-slate-700 border-slate-200"}`}>
                    {LOB_LABELS[sale.lineOfBusiness] ?? sale.lineOfBusiness}
                  </span>
                ) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{sale.carrier || "—"}</TableCell>
              <TableCell>{format(parseLocalDate(sale.soldDate), "MMM d")}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {sale.effectiveDate ? format(parseLocalDate(sale.effectiveDate), "MMM d") : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{sale.commissionType || "—"}</TableCell>
              <TableCell className="text-right font-mono font-medium">
                {sale.hra != null ? fmt(sale.hra) : "None"}
              </TableCell>
              <TableCell className="text-right font-mono font-medium">{fmt(sale.estimatedCommission)}</TableCell>
              <TableCell className="text-center">
                {isAdmin ? (
                  <Checkbox
                    checked={sale.paid}
                    onCheckedChange={() => onTogglePaid(sale.id, sale.paid)}
                    disabled={isPaidPending}
                    className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 mx-auto"
                  />
                ) : (
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${sale.paid ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                    {sale.paid ? "✓" : "—"}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <SaleForm sale={sale as any}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </SaleForm>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(sale.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface LobSectionsProps {
  sales: Sale[];
  isLoading: boolean;
  isAdmin: boolean;
  showAgentColumn: boolean;
  onDelete: (id: number) => void;
  onTogglePaid: (id: number, current: boolean) => void;
  isPaidPending: boolean;
}

function LobSections({ sales, isLoading, isAdmin, showAgentColumn, onDelete, onTogglePaid, isPaidPending }: LobSectionsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b bg-muted/20"><Skeleton className="h-5 w-36" /></div>
            <div className="p-4 space-y-2">{[0, 1, 2].map((j) => <Skeleton key={j} className="h-10 w-full" />)}</div>
          </div>
        ))}
      </div>
    );
  }

  const groups = groupByLob(sales);

  if (groups.length === 0) {
    return (
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <TrendingUp className="w-8 h-8 text-muted" />
          <p className="text-sm">No sales found for this week.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(({ lob, label, sales: lobSales }) => {
        const totalComm = lobSales.reduce((a, s) => a + (s.estimatedCommission ?? 0), 0);
        const paidCount = lobSales.filter((s) => s.paid).length;
        const unpaidCount = lobSales.length - paidCount;
        const headerCls = LOB_HEADER_COLORS[lob] ?? "bg-muted/20 border-border";
        return (
          <div key={lob} className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className={`px-5 py-3.5 border-b flex items-center justify-between gap-3 ${headerCls}`}>
              <div className="flex items-center gap-2.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${LOB_COLORS[lob] ?? "bg-slate-50 text-slate-700 border-slate-200"}`}>
                  {label}
                </span>
                <span className="text-sm text-muted-foreground">
                  {lobSales.length} sale{lobSales.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {paidCount > 0 && (
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />{paidCount} paid
                  </span>
                )}
                {unpaidCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <Clock className="w-3.5 h-3.5" />{unpaidCount} unpaid
                  </span>
                )}
                <span className="font-semibold text-foreground tabular-nums">{fmt(totalComm)}</span>
              </div>
            </div>
            <SalesTable
              sales={lobSales}
              isAdmin={isAdmin}
              showAgentColumn={showAgentColumn}
              onDelete={onDelete}
              onTogglePaid={onTogglePaid}
              isPaidPending={isPaidPending}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function AdminSalesPage() {
  const { isAdmin } = useAgencyUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentWeekStart = useMemo(() => getCurrentWeekStart(), []);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [filterPaid, setFilterPaid] = useState<"all" | "paid" | "unpaid">("all");
  const [filterAgent, setFilterAgent] = useState("__all");
  const [saleToDelete, setSaleToDelete] = useState<number | null>(null);

  const weekEnd = getWeekEnd(weekStart);
  const isCurrentWeek = weekStart === currentWeekStart;

  const { data: salesRaw = [], isLoading } = useListSales({ weekStart });
  const deleteSale = useDeleteSale();
  const markPaid = useMarkSalePaid();

  const typedSales = salesRaw as Sale[];

  const agents = useMemo(() => {
    const names = new Set<string>();
    for (const s of typedSales) if (s.agentName) names.add(s.agentName);
    return [...names].sort();
  }, [typedSales]);

  const filtered = useMemo(() => {
    return typedSales.filter((s) => {
      if (filterPaid === "paid" && !s.paid) return false;
      if (filterPaid === "unpaid" && s.paid) return false;
      if (filterAgent !== "__all" && s.agentName !== filterAgent) return false;
      return true;
    });
  }, [typedSales, filterPaid, filterAgent]);

  const totalComm = filtered.reduce((a, s) => a + (s.estimatedCommission ?? 0), 0);
  const paidComm = filtered.filter((s) => s.paid).reduce((a, s) => a + (s.estimatedCommission ?? 0), 0);
  const owedComm = filtered.filter((s) => !s.paid).reduce((a, s) => a + (s.estimatedCommission ?? 0), 0);
  const unpaidCount = typedSales.filter((s) => !s.paid).length;

  const handleDelete = () => {
    if (!saleToDelete) return;
    deleteSale.mutate(
      { id: saleToDelete },
      {
        onSuccess: () => {
          toast({ title: "Sale removed" });
          queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCurrentWeekSummaryQueryKey() });
          setSaleToDelete(null);
        },
        onError: () => {
          toast({ title: "Failed to delete sale", variant: "destructive" });
          setSaleToDelete(null);
        },
      }
    );
  };

  const handleTogglePaid = (id: number, current: boolean) => {
    markPaid.mutate(
      { id, data: { paid: !current } },
      {
        onSuccess: () => {
          toast({ title: !current ? "Marked as paid" : "Marked as unpaid" });
          queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCurrentWeekSummaryQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to update paid status", variant: "destructive" });
        },
      }
    );
  };

  const weekLabel = `${format(parseLocalDate(weekStart), "MMM d")} – ${format(parseLocalDate(weekEnd), "MMM d, yyyy")}`;

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sales Ledger</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Browse all sales by week</p>
          </div>
          <SaleForm>
            <Button className="gap-2 shrink-0 bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="w-4 h-4" />
              Add Sale
            </Button>
          </SaleForm>
        </div>

        {/* Summary cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                  <p className="text-3xl font-bold font-mono">{filtered.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Paid Out</p>
                  <p className="text-3xl font-bold font-mono text-emerald-700 dark:text-emerald-400">{fmt(paidComm)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Still Owed</p>
                  <p className="text-3xl font-bold font-mono text-amber-700 dark:text-amber-400">{fmt(owedComm)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Week navigation */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-card border rounded-lg shadow-sm overflow-hidden">
            <button
              onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
              className="p-2.5 hover:bg-muted/50 transition-colors border-r"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 py-2 text-sm font-medium tabular-nums min-w-[200px] text-center">
              {weekLabel}
            </span>
            <button
              onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
              disabled={isCurrentWeek}
              className="p-2.5 hover:bg-muted/50 transition-colors border-l disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {!isCurrentWeek && (
            <Button variant="outline" size="sm" onClick={() => setWeekStart(currentWeekStart)}>
              This Week
            </Button>
          )}
          {isCurrentWeek && (
            <Badge variant="secondary" className="text-xs">Current Week</Badge>
          )}
        </div>

        {/* Unpaid alert */}
        {isAdmin && unpaidCount > 0 && !isLoading && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-900 text-sm">
                {unpaidCount} unpaid commission{unpaidCount !== 1 ? "s" : ""} this week
              </p>
              <p className="text-amber-700 text-sm">
                Check the "Paid" box on each record once payment has been issued.
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg p-1">
              {(["all", "unpaid", "paid"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterPaid(f)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    filterPaid === f
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "All" : f === "unpaid" ? "Unpaid" : "Paid"}
                </button>
              ))}
            </div>
            {isAdmin && agents.length > 0 && (
              <Select value={filterAgent} onValueChange={setFilterAgent}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All agents</SelectItem>
                  {agents.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          {isAdmin && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-medium">Green</span> = paid ·{" "}
              <span className="text-amber-700 font-medium">amber</span> = unpaid · check box to mark paid
            </div>
          )}
        </div>

        {/* LOB sections */}
        <LobSections
          sales={filtered}
          isLoading={isLoading}
          isAdmin={isAdmin}
          showAgentColumn={isAdmin && filterAgent === "__all"}
          onDelete={setSaleToDelete}
          onTogglePaid={handleTogglePaid}
          isPaidPending={markPaid.isPending}
        />
      </div>

      <AlertDialog open={!!saleToDelete} onOpenChange={(o) => !o && setSaleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this sale? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
