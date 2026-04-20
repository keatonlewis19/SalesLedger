import { format } from "date-fns";
import { Send, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListReports, 
  useSendReport,
  getListReportsQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgencyUser } from "@/hooks/useAgencyUser";

export default function History() {
  const { data: reports, isLoading } = useListReports();
  const sendReport = useSendReport();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAgencyUser();

  const handleSendReport = () => {
    sendReport.mutate(undefined, {
      onSuccess: (res) => {
        toast({ title: "Report sent successfully!", description: res.message });
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to send report", variant: "destructive" });
      }
    });
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
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Past Reports</h1>
            <p className="text-muted-foreground mt-1">
              History of weekly reports sent to upline managers.
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
            reports?.map((report) => (
              <Card key={report.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-muted/40 px-5 py-3 border-b flex justify-between items-center">
                  <div className="font-medium text-sm">
                    {format(new Date(report.weekStart), "MMM d")} - {format(new Date(report.weekEnd), "MMM d, yyyy")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Sent {format(new Date(report.sentAt), "MMM d")}
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
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
