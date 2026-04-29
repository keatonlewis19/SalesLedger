import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";
import {
  useCreateSale,
  useUpdateSale,
  useGetSettings,
  useListLeadSources,
  useCreateLeadSource,
  getListSalesQueryKey,
  getGetCurrentWeekSummaryQueryKey,
  getListLeadSourcesQueryKey,
} from "@workspace/api-client-react";
import type { SaleEntry } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const COMMISSION_TYPES = ["Initial", "Renewal", "Prorated Renewal", "Monthly Renewal"] as const;

const METAL_TIERS = ["Catastrophic", "Bronze", "Silver", "Gold", "Platinum", "Non-Qualified"] as const;

const LOB_OPTIONS = [
  { value: "medicare", label: "Medicare" },
  { value: "aca", label: "ACA / Individual Health" },
  { value: "ancillary", label: "Ancillary" },
  { value: "life", label: "Life Insurance" },
  { value: "annuity", label: "Annuities" },
] as const;

type LobValue = "medicare" | "aca" | "ancillary" | "life" | "annuity";

// ---------------------------------------------------------------------------
// Lead Source combobox — shows DB entries + inline "create new" option
// ---------------------------------------------------------------------------
function LeadSourceCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: sources = [] } = useListLeadSources();
  const createLeadSource = useCreateLeadSource();

  const names = sources.map((s) => s.name);
  const trimmed = search.trim();
  const exactMatch = names.some((n) => n.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !exactMatch;

  function handleSelect(name: string) {
    onChange(name);
    setSearch("");
    setOpen(false);
  }

  function handleCreate() {
    if (!trimmed || creating) return;
    setCreating(true);
    createLeadSource.mutate(
      { data: { name: trimmed, isPaid: false } },
      {
        onSuccess: (newSource) => {
          queryClient.invalidateQueries({ queryKey: getListLeadSourcesQueryKey() });
          onChange(newSource.name);
          setSearch("");
          setOpen(false);
          toast({ title: `Lead source "${newSource.name}" created` });
        },
        onError: () => {
          toast({ title: "Failed to create lead source", variant: "destructive" });
        },
        onSettled: () => setCreating(false),
      }
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {value || "Select or create a lead source"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type a new name…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandGroup>
              {names
                .filter((n) => n.toLowerCase().includes(trimmed.toLowerCase()))
                .map((name) => (
                  <CommandItem key={name} value={name} onSelect={() => handleSelect(name)}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {name}
                  </CommandItem>
                ))}
              {names.filter((n) => n.toLowerCase().includes(trimmed.toLowerCase())).length === 0 &&
                !showCreate && (
                  <CommandEmpty>No lead sources found.</CommandEmpty>
                )}
            </CommandGroup>

            {showCreate && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`__create__${trimmed}`}
                    onSelect={handleCreate}
                    disabled={creating}
                    className="text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {creating ? "Creating…" : `Create "${trimmed}"`}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const formSchema = z.object({
  lineOfBusiness: z.string().min(1),
  clientName: z.string().min(1, "Client name is required"),
  salesSource: z.string().optional(),
  leadSource: z.string().optional(),
  carrier: z.string().optional(),
  metalTier: z.string().optional(),
  salesType: z.string().min(1, "Sales type is required"),
  soldDate: z.string().min(1, "Sold date is required"),
  effectiveDate: z.string().optional(),
  commissionType: z.string().optional(),
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

  // Derive carrier list from settings.carrierColors
  const carrierNames: string[] = settings
    ? Object.keys((settings as any).carrierColors ?? {}).sort()
    : [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lineOfBusiness: "medicare",
      clientName: "",
      salesSource: "",
      leadSource: "",
      carrier: "",
      metalTier: "",
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
        lineOfBusiness: (sale as any).lineOfBusiness || "medicare",
        clientName: sale.clientName,
        salesSource: sale.salesSource || "",
        leadSource: sale.leadSource || "",
        carrier: (sale as any).carrier || "",
        metalTier: (sale as any).metalTier || "",
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
        lineOfBusiness: "medicare",
        clientName: "",
        salesSource: "",
        leadSource: "",
        carrier: "",
        metalTier: "",
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
  const watchedLob = (form.watch("lineOfBusiness") as LobValue) || "medicare";

  const isMedicare = watchedLob === "medicare";
  const showCarrier = !isMedicare;
  const showMetalTier = watchedLob === "aca";

  useEffect(() => {
    if (!settings || !watchedCommissionType) return;

    // Only auto-calculate for Medicare
    if (watchedLob !== "medicare") return;

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
        const [, monthStr] = watchedEffectiveDate.split("-");
        const month = parseInt(monthStr, 10);
        const monthsRemaining = 13 - month;
        commission = monthlyRate * monthsRemaining;
      }
    }

    if (commission != null) {
      form.setValue("estimatedCommission", commission.toFixed(2));
    }
  }, [watchedCommissionType, watchedSalesSource, watchedSalesType, watchedEffectiveDate, watchedLob, settings, form]);

  const onSubmit = (data: FormValues) => {
    const formattedData = {
      clientName: data.clientName,
      salesSource: data.salesSource || null,
      leadSource: data.leadSource || null,
      salesType: data.salesType,
      soldDate: data.soldDate,
      effectiveDate: data.effectiveDate || null,
      commissionType: data.lineOfBusiness === "medicare" ? (data.commissionType || "") : "",
      estimatedCommission: data.estimatedCommission ? parseFloat(data.estimatedCommission) : null,
      hra: data.hra ? parseFloat(data.hra) : null,
      comments: data.comments || null,
      lineOfBusiness: data.lineOfBusiness || "medicare",
      carrier: data.carrier || null,
      metalTier: data.metalTier || null,
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sale ? "Edit Sale" : "Add New Sale"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">

            {/* Product Type */}
            <FormField
              control={form.control}
              name="lineOfBusiness"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LOB_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Client */}
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

            {/* Sales Source */}
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

            {/* Lead Source */}
            <FormField
              control={form.control}
              name="leadSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Source</FormLabel>
                  <FormControl>
                    <LeadSourceCombobox
                      value={field.value ?? ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Carrier — non-Medicare only */}
            {showCarrier && (
              <FormField
                control={form.control}
                name="carrier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select carrier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {carrierNames.length > 0 ? (
                          carrierNames.map((name) => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="" disabled>No carriers configured in Settings</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Metal Tier — ACA only */}
            {showMetalTier && (
              <FormField
                control={form.control}
                name="metalTier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Metal Tier</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select metal tier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {METAL_TIERS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Sales Type */}
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

            {isMedicare && (
              <FormField
                control={form.control}
                name="commissionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
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
            )}

            <div className={isMedicare ? "grid grid-cols-2 gap-4" : ""}>
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
                        placeholder={isMedicare ? "Auto-calculated" : "0.00"}
                        readOnly={isMedicare}
                        className={isMedicare ? "bg-muted cursor-not-allowed text-muted-foreground" : ""}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isMedicare && (
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
              )}
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
