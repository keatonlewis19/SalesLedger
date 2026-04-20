import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { useCreateSale, useUpdateSale, useGetSettings, getListSalesQueryKey, getGetCurrentWeekSummaryQueryKey } from "@workspace/api-client-react";
import type { SaleEntry } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const COMMISSION_TYPES = ["Initial", "Renewal", "Prorated Renewal", "Monthly Renewal"] as const;

const formSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  salesSource: z.string().optional(),
  leadSource: z.string().optional(),
  salesType: z.string().min(1, "Sales type is required"),
  soldDate: z.string().min(1, "Sold date is required"),
  effectiveDate: z.string().optional(),
  commissionType: z.string().min(1, "Commission type is required"),
  estimatedCommission: z.string().optional(),
  hra: z.string().optional(),
  comments: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function SaleForm({
  sale,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  sale?: SaleEntry;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();
  const { data: settings } = useGetSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: "",
      salesSource: "",
      leadSource: "",
      salesType: "",
      soldDate: format(new Date(), "yyyy-MM-dd"),
      effectiveDate: "",
      commissionType: "",
      estimatedCommission: "",
      hra: "",
      comments: "",
    },
  });

  useEffect(() => {
    if (open && sale) {
      form.reset({
        clientName: sale.clientName,
        salesSource: sale.salesSource || "",
        leadSource: sale.leadSource || "",
        salesType: sale.salesType,
        soldDate: sale.soldDate.split("T")[0],
        effectiveDate: sale.effectiveDate?.split("T")[0] || "",
        commissionType: sale.commissionType,
        estimatedCommission: sale.estimatedCommission?.toString() || "",
        hra: sale.hra?.toString() || "",
        comments: sale.comments || "",
      });
    } else if (open && !sale) {
      form.reset({
        clientName: "",
        salesSource: "",
        leadSource: "",
        salesType: "",
        soldDate: format(new Date(), "yyyy-MM-dd"),
        effectiveDate: "",
        commissionType: "",
        estimatedCommission: "",
        hra: "",
        comments: "",
      });
    }
  }, [open, sale, form]);

  const watchedCommissionType = form.watch("commissionType");
  const watchedSalesSource = form.watch("salesSource");
  const watchedSalesType = form.watch("salesType");
  const watchedEffectiveDate = form.watch("effectiveDate");

  useEffect(() => {
    if (!settings || !watchedCommissionType) return;

    // 1. Commission table override (exact match on all 3 dims)
    const table = settings.commissionTable as Array<{ salesSource: string; salesType: string; commissionType: string; estimatedCommission: number | null }> | null | undefined;
    if (table && watchedSalesSource && watchedSalesType) {
      const match = table.find(
        (r) =>
          r.salesSource === watchedSalesSource &&
          r.salesType === watchedSalesType &&
          r.commissionType === watchedCommissionType
      );
      if (match?.estimatedCommission != null) {
        form.setValue("estimatedCommission", match.estimatedCommission.toFixed(2));
        return;
      }
    }

    // 2. Formula-based calculation from FMV Initial rate
    const rates = (settings.commissionRates ?? {}) as Record<string, number>;
    const initialRate = rates["Initial"] ?? 0;
    if (initialRate === 0) return;

    const renewalRate = initialRate / 2;
    const monthlyRate = renewalRate / 12;

    let commission: number | null = null;

    if (watchedCommissionType === "Initial") {
      commission = initialRate;
    } else if (watchedCommissionType === "Renewal") {
      commission = renewalRate;
    } else if (watchedCommissionType === "Monthly Renewal") {
      commission = monthlyRate;
    } else if (watchedCommissionType === "Prorated Renewal") {
      if (watchedEffectiveDate) {
        // Parse the date in local time to avoid UTC offset shifting the month
        const [, monthStr] = watchedEffectiveDate.split("-");
        const month = parseInt(monthStr, 10); // 1–12
        const monthsRemaining = 13 - month;   // Jun=7, Jul=6, etc.
        commission = monthlyRate * monthsRemaining;
      }
    }

    if (commission != null) {
      form.setValue("estimatedCommission", commission.toFixed(2));
    }
  }, [watchedCommissionType, watchedSalesSource, watchedSalesType, watchedEffectiveDate, settings, form]);

  const onSubmit = (data: FormValues) => {
    const formattedData = {
      clientName: data.clientName,
      salesSource: data.salesSource || null,
      leadSource: data.leadSource || null,
      salesType: data.salesType,
      soldDate: data.soldDate,
      effectiveDate: data.effectiveDate || null,
      commissionType: data.commissionType,
      estimatedCommission: data.estimatedCommission ? parseFloat(data.estimatedCommission) : null,
      hra: data.hra ? parseFloat(data.hra) : null,
      comments: data.comments || null,
    };

    if (sale) {
      updateSale.mutate(
        { id: sale.id, data: formattedData },
        {
          onSuccess: () => {
            toast({ title: "Sale updated successfully" });
            queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetCurrentWeekSummaryQueryKey() });
            setOpen(false);
          },
          onError: () => {
            toast({ title: "Failed to update sale", variant: "destructive" });
          },
        }
      );
    } else {
      createSale.mutate(
        { data: formattedData },
        {
          onSuccess: () => {
            toast({ title: "Sale added successfully" });
            queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetCurrentWeekSummaryQueryKey() });
            setOpen(false);
          },
          onError: () => {
            toast({ title: "Failed to add sale", variant: "destructive" });
          },
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sale ? "Edit Sale" : "Add New Sale"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">

            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="salesSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sales Source</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Company Provided">Company Provided</SelectItem>
                      <SelectItem value="Self-Generated">Self-Generated</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leadSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Source</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Referral, Cold Call, Walk-in" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="salesType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sales Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="New Client">New Client</SelectItem>
                      <SelectItem value="Plan Change">Plan Change</SelectItem>
                      <SelectItem value="AOR">AOR</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="soldDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sold Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effectiveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="commissionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commission Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select commission type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMMISSION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estimatedCommission"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Est. Commission ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Auto-calculated"
                        readOnly
                        className="bg-muted cursor-not-allowed text-muted-foreground"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hra"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HRA ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="None if blank" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any additional context..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSale.isPending || updateSale.isPending}>
                {sale ? "Save Changes" : "Add Sale"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
