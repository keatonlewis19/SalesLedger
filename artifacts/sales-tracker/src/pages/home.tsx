import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Edit2, Trash2, TrendingUp, Users, CheckCircle2, AlertTriangle, DollarSign, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSales,
  useGetCurrentWeekSummary,
  useDeleteSale,
  useMarkSalePaid,
  useListAgencyUsers,
  getListSalesQueryKey,
  getGetCurrentWeekSummaryQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { SaleForm } from "@/components/sale-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useAgencyUser } from "@/hooks/useAgencyUser";

function formatCurrency(val: number | null | undefined) {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d);
}

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
  annuity: "bg-rose-50 text-rose-700 border-rose-200",
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
};

interface SalesTableProps {
  sales: Sale[];
  isLoading: boolean;
  isAdmin: boolean;
  showAgentColumn?: boolean;
  onEdit?: (sale: Sale) => void;
  onDelete: (id: number) => void;
  onTogglePaid: (id: number, current: boolean) => void;
  isPaidPending: boolean;
}

function SalesTable({
  sales,
  isLoading,
  isAdmin,
  showAgentColumn = false,
  onDelete,
  onTogglePaid,
  isPaidPending,
}: SalesTableProps) {
  const colCount = showAgentColumn ? 14 : 13;

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
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: colCount }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : sales.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="h-48 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <TrendingUp className="w-8 h-8 text-muted" />
                  <p>No sales logged this week.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            sales.map((sale) => (
              <TableRow
                key={sale.id}
                className={`group ${
                  sale.paid
                    ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                    : "bg-amber-50/60 dark:bg-amber-950/20"
                }`}
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
                <TableCell className="text-muted-foreground text-sm">
                  {sale.salesSource || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {sale.leadSource || "—"}
                </TableCell>
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
                <TableCell className="text-muted-foreground text-sm">
                  {sale.carrier || "—"}
                </TableCell>
                <TableCell>{format(parseLocalDate(sale.soldDate), "MMM d")}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {sale.effectiveDate
                    ? format(parseLocalDate(sale.effectiveDate), "MMM d")
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {sale.commissionType || "—"}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {sale.hra != null ? formatCurrency(sale.hra) : "None"}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {formatCurrency(sale.estimatedCommission)}
                </TableCell>
                <TableCell className="text-center">
                  {isAdmin ? (
                    <Checkbox
                      checked={sale.paid}
                      onCheckedChange={() => onTogglePaid(sale.id, sale.paid)}
                      disabled={isPaidPending}
                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 mx-auto"
                    />
                  ) : (
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
                        sale.paid
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-amber-100 text-amber-600"
                      }`}
                    >
                      {sale.paid ? "✓" : "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <SaleForm sale={sale as any}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                      >
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function Home() {
  const { data: sales, isLoading: isSalesLoading } = useListSales();
  const { data: summary, isLoading: isSummaryLoading } = useGetCurrentWeekSummary();
  const { data: agencyUsers } = useListAgencyUsers();
  const deleteSale = useDeleteSale();
  const markSalePaid = useMarkSalePaid();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAgencyUser();

  const [saleToDelete, setSaleToDelete] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [filterPaid, setFilterPaid] = useState<"all" | "paid" | "unpaid">("all");

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
    markSalePaid.mutate(
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

  const typedSales = (sales ?? []) as Sale[];

  const unpaidSales = useMemo(() => typedSales.filter((s) => !s.paid), [typedSales]);
  const unpaidCount = unpaidSales.length;
  const unpaidCommission = unpaidSales.reduce(
    (acc, s) => acc + (s.estimatedCommission ?? 0),
    0
  );
  const paidCommission = useMemo(
    () => typedSales.filter((s) => s.paid).reduce((acc, s) => acc + (s.estimatedCommission ?? 0), 0),
    [typedSales]
  );

  const filteredSales = useMemo(() => {
    if (filterPaid === "all") return typedSales;
    if (filterPaid === "paid") return typedSales.filter((s) => s.paid);
    return typedSales.filter((s) => !s.paid);
  }, [typedSales, filterPaid]);

  const agentGroups = useMemo(() => {
    const map = new Map<string, { name: string; sales: Sale[]; unpaid: number }>();
    for (const sale of filteredSales) {
      const key = sale.userId ?? "unassigned";
      const name = sale.agentName ?? "Unassigned";
      if (!map.has(key)) map.set(key, { name, sales: [], unpaid: 0 });
      const group = map.get(key)!;
      group.sales.push(sale);
      if (!sale.paid) group.unpaid++;
    }
    return [...map.entries()].map(([key, val]) => ({ key, ...val }));
  }, [filteredSales]);

  const tableProps = {
    isLoading: isSalesLoading,
    isAdmin,
    onDelete: setSaleToDelete,
    onTogglePaid: handleTogglePaid,
    isPaidPending: markSalePaid.isPending,
  };

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isAdmin ? "Agency Dashboard" : "My Sales"}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Current week</p>
          </div>
          <SaleForm>
            <Button className="gap-2 shrink-0 bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="w-4 h-4" />
              Add Sale
            </Button>
          </SaleForm>
        </div>

        {isSummaryLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                  <p className="text-3xl font-bold font-mono text-foreground">
                    {summary.totalSales}
                  </p>
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
                  <p className="text-3xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(paidCommission)}
                  </p>
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
                  <p className="text-3xl font-bold font-mono text-amber-700 dark:text-amber-400">
                    {formatCurrency(unpaidCommission)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {isAdmin && unpaidCount > 0 && !isSalesLoading && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-900 text-sm">
                {unpaidCount} unpaid commission{unpaidCount !== 1 ? "s" : ""} this week
              </p>
              <p className="text-amber-700 text-sm">
                {formatCurrency(unpaidCommission)} in commissions not yet marked as paid. Check the "Paid" box on each record once payment has been issued.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <DollarSign className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-amber-900 font-mono">{formatCurrency(unpaidCommission)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 flex-wrap">
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
          {isAdmin && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-medium">Green</span> = paid ·{" "}
              <span className="text-amber-700 font-medium">amber</span> = unpaid · check box to mark paid
            </div>
          )}
        </div>

        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          {isAdmin ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="px-4 pt-4 border-b">
                <TabsList className="mb-0">
                  <TabsTrigger value="all" className="relative gap-1.5">
                    All Agents
                    {unpaidCount > 0 && filterPaid !== "paid" && (
                      <Badge variant="destructive" className="h-4 px-1.5 text-[10px] min-w-4">
                        {unpaidCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  {agentGroups.map((group) => (
                    <TabsTrigger key={group.key} value={group.key} className="gap-1.5">
                      {group.name}
                      <span className="text-muted-foreground text-xs">({group.sales.length})</span>
                      {group.unpaid > 0 && filterPaid !== "paid" && (
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px] min-w-4 border-amber-400 text-amber-700 bg-amber-50">
                          {group.unpaid}
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="all" className="m-0">
                <SalesTable
                  {...tableProps}
                  sales={filteredSales}
                  showAgentColumn={true}
                />
              </TabsContent>

              {agentGroups.map((group) => (
                <TabsContent key={group.key} value={group.key} className="m-0">
                  <div className="px-4 py-3 border-b bg-muted/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{group.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.sales.length} sale{group.sales.length !== 1 ? "s" : ""} ·{" "}
                          {formatCurrency(
                            group.sales.reduce((a, s) => a + (s.estimatedCommission ?? 0), 0)
                          )}{" "}
                          total commission
                        </p>
                      </div>
                    </div>
                    {group.unpaid > 0 && filterPaid !== "paid" && (
                      <span className="flex items-center gap-1.5 text-amber-700 text-sm font-medium bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {formatCurrency(
                          group.sales
                            .filter((s) => !s.paid)
                            .reduce((a, s) => a + (s.estimatedCommission ?? 0), 0)
                        )}{" "}
                        unpaid
                      </span>
                    )}
                  </div>
                  <SalesTable
                    {...tableProps}
                    sales={group.sales}
                    showAgentColumn={false}
                  />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <>
              <div className="px-6 py-4 border-b bg-muted/20">
                <h2 className="font-semibold text-lg">Sales Log</h2>
              </div>
              <SalesTable
                {...tableProps}
                sales={filteredSales}
                showAgentColumn={false}
              />
            </>
          )}
        </div>
      </div>

      <AlertDialog open={!!saleToDelete} onOpenChange={(o) => !o && setSaleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this sale from the tracker? This action cannot be
              undone.
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
