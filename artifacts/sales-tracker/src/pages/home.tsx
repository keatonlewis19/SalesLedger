import { useState } from "react";
import { format } from "date-fns";
import { Plus, Edit2, Trash2, TrendingUp, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListSales, 
  useGetCurrentWeekSummary, 
  useDeleteSale,
  getListSalesQueryKey,
  getGetCurrentWeekSummaryQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { SaleForm } from "@/components/sale-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export default function Home() {
  const { data: sales, isLoading: isSalesLoading } = useListSales();
  const { data: summary, isLoading: isSummaryLoading } = useGetCurrentWeekSummary();
  const deleteSale = useDeleteSale();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [saleToDelete, setSaleToDelete] = useState<number | null>(null);

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
        }
      }
    );
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "-";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  };

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Current Week</h1>
            {summary && (
              <p className="text-muted-foreground mt-1">
                {format(new Date(summary.weekStart), "MMM d")} - {format(new Date(summary.weekEnd), "MMM d, yyyy")}
              </p>
            )}
          </div>
          <SaleForm>
            <Button className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              Add Sale
            </Button>
          </SaleForm>
        </div>

        {isSummaryLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                  <p className="text-3xl font-bold font-mono text-foreground">{summary.totalSales}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-secondary/30 border-secondary">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <TrendingUp className="w-6 h-6 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Est. Commission</p>
                  <p className="text-3xl font-bold font-mono text-foreground">
                    {formatCurrency(summary.totalEstimatedCommission)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b bg-muted/20">
            <h2 className="font-semibold text-lg">Sales Log</h2>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/10">
                  <TableHead>Client</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Lead Source</TableHead>
                  <TableHead className="text-right">HRA</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isSalesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : sales?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <TrendingUp className="w-8 h-8 text-muted" />
                        <p>No sales logged this week.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sales?.map((sale) => (
                    <TableRow key={sale.id} className="group">
                      <TableCell className="font-medium">{sale.clientName}</TableCell>
                      <TableCell>{sale.owningAgent}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                          {sale.salesType}
                        </span>
                      </TableCell>
                      <TableCell>{format(new Date(sale.soldDate), "MMM d")}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{sale.leadSource || "—"}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatCurrency(sale.hra)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(sale.estimatedCommission)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <SaleForm sale={sale}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </SaleForm>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setSaleToDelete(sale.id)}
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
        </div>
      </div>

      <AlertDialog open={!!saleToDelete} onOpenChange={(o) => !o && setSaleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this sale from the tracker? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
