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

const formSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  owningAgent: z.string().min(1, "Agent is required"),
  salesType: z.string().min(1, "Sales type is required"),
  soldDate: z.string().min(1, "Sold date is required"),
  commissionType: z.string().min(1, "Commission type is required"),
  annualPremium: z.string().optional(),
  estimatedCommission: z.string().optional(),
  notes: z.string().optional(),
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
      owningAgent: "",
      salesType: "",
      soldDate: format(new Date(), "yyyy-MM-dd"),
      commissionType: "",
      annualPremium: "",
      estimatedCommission: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open && sale) {
      form.reset({
        clientName: sale.clientName,
        owningAgent: sale.owningAgent,
        salesType: sale.salesType,
        soldDate: sale.soldDate.split("T")[0],
        commissionType: sale.commissionType,
        annualPremium: sale.annualPremium?.toString() || "",
        estimatedCommission: sale.estimatedCommission?.toString() || "",
        notes: sale.notes || "",
      });
    } else if (open && !sale) {
      form.reset({
        clientName: "",
        owningAgent: "",
        salesType: "",
        soldDate: format(new Date(), "yyyy-MM-dd"),
        commissionType: "",
        annualPremium: "",
        estimatedCommission: "",
        notes: "",
      });
    }
  }, [open, sale, form]);

  const watchedPremium = form.watch("annualPremium");
  const watchedCommissionType = form.watch("commissionType");

  useEffect(() => {
    if (!settings?.commissionRates) return;
    const premium = parseFloat(watchedPremium || "");
    const rate = settings.commissionRates[watchedCommissionType];
    if (!isNaN(premium) && premium > 0 && rate != null) {
      const calculated = (premium * rate) / 100;
      form.setValue("estimatedCommission", calculated.toFixed(2));
    }
  }, [watchedPremium, watchedCommissionType, settings, form]);

  const onSubmit = (data: FormValues) => {
    const formattedData = {
      ...data,
      annualPremium: data.annualPremium ? parseFloat(data.annualPremium) : null,
      estimatedCommission: data.estimatedCommission ? parseFloat(data.estimatedCommission) : null,
      notes: data.notes || null,
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
      <DialogContent className="sm:max-w-[425px]">
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
                  <FormLabel>Client Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="owningAgent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Keaton Lewis">Keaton Lewis</SelectItem>
                        <SelectItem value="Chad McDonald">Chad McDonald</SelectItem>
                        <SelectItem value="CRM Group">CRM Group</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Plan Change">Plan Change</SelectItem>
                        <SelectItem value="New Client">New Client</SelectItem>
                        <SelectItem value="AOR">AOR</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="soldDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Sold</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="commissionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comm. Type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. FYC, Renewal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="annualPremium"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Annual Premium ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedCommission"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Est. Commission ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Auto-calculated" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
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
