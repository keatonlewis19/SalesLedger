import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, Save, Download, Upload, CheckCircle2 } from "lucide-react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const DAY_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: new Date(2000, 0, 1, i).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
}));

type CommissionTableRow = {
  salesSource: string;
  salesType: string;
  commissionType: string;
  estimatedCommission: number | null;
};

const settingsSchema = z.object({
  recipients: z.array(z.object({ email: z.string().email("Invalid email") })).min(1, "At least one recipient required"),
  reportDayOfWeek: z.string(),
  reportHour: z.string(),
  reportMinute: z.string(),
  fmvInitial: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

function parseCsv(text: string): CommissionTableRow[] | null {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const rows: CommissionTableRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 4) continue;
    const val = cols[3] === "" ? null : parseFloat(cols[3]);
    rows.push({
      salesSource: cols[0],
      salesType: cols[1],
      commissionType: cols[2],
      estimatedCommission: val != null && !isNaN(val) ? val : null,
    });
  }
  return rows.length > 0 ? rows : null;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [initialized, setInitialized] = useState(false);
  const [commissionTable, setCommissionTable] = useState<CommissionTableRow[] | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      recipients: [{ email: "" }],
      reportDayOfWeek: "4",
      reportHour: "17",
      reportMinute: "0",
      fmvInitial: "",
    },
  });

  const { register, formState: { errors }, watch, setValue } = form;

  useEffect(() => {
    if (settings && !initialized) {
      const rates = settings.commissionRates as Record<string, number>;
      form.reset({
        recipients: settings.recipients.map((e) => ({ email: e })),
        reportDayOfWeek: String(settings.reportDayOfWeek),
        reportHour: String(settings.reportHour),
        reportMinute: String(settings.reportMinute),
        fmvInitial: rates["Initial"] != null ? String(rates["Initial"]) : "",
      });
      if (settings.commissionTable && (settings.commissionTable as CommissionTableRow[]).length > 0) {
        setCommissionTable(settings.commissionTable as CommissionTableRow[]);
      }
      setInitialized(true);
    }
  }, [settings, initialized, form]);

  const fmvInitialVal = parseFloat(watch("fmvInitial") || "0") || 0;
  const derivedRenewal = fmvInitialVal / 2;
  const derivedMonthly = derivedRenewal / 12;

  const onSubmit = (data: SettingsFormValues) => {
    const initial = parseFloat(data.fmvInitial || "0") || 0;
    const commissionRates: Record<string, number> = {
      "Initial": initial,
      "Renewal": initial / 2,
      "Monthly Renewal": initial / 2 / 12,
    };

    updateSettings.mutate(
      {
        data: {
          recipients: data.recipients.map((r) => r.email.trim()).filter(Boolean),
          reportDayOfWeek: parseInt(data.reportDayOfWeek),
          reportHour: parseInt(data.reportHour),
          reportMinute: parseInt(data.reportMinute),
          commissionRates,
          commissionTable: commissionTable ?? null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Settings saved" });
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to save settings", variant: "destructive" });
        },
      }
    );
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/api/settings/commission-table-template";
    link.download = "commission_table_template.csv";
    link.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed) {
        setCommissionTable(parsed);
        toast({ title: `Commission table loaded — ${parsed.length} rows` });
      } else {
        toast({ title: "Could not parse CSV. Check the format and try again.", variant: "destructive" });
        setUploadName(null);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col gap-6 max-w-2xl">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-8 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure reports, schedule, and commission rates.</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">

          {/* Email Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Report Recipients</CardTitle>
              <CardDescription>Who receives the weekly email report.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {watch("recipients").map((_, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      {...register(`recipients.${idx}.email`)}
                    />
                    {errors.recipients?.[idx]?.email && (
                      <p className="text-destructive text-xs mt-1">{errors.recipients[idx]?.email?.message}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => {
                      const curr = watch("recipients");
                      if (curr.length > 1) setValue("recipients", curr.filter((_, i) => i !== idx));
                    }}
                    disabled={watch("recipients").length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 self-start"
                onClick={() => setValue("recipients", [...watch("recipients"), { email: "" }])}
              >
                <Plus className="w-4 h-4" />
                Add Recipient
              </Button>
            </CardContent>
          </Card>

          {/* Report Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Report Schedule</CardTitle>
              <CardDescription>When the weekly report is automatically emailed.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Day of Week</Label>
                  <Select
                    value={watch("reportDayOfWeek")}
                    onValueChange={(v) => setValue("reportDayOfWeek", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAY_OPTIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Time</Label>
                  <Select
                    value={watch("reportHour")}
                    onValueChange={(v) => setValue("reportHour", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.map((h) => (
                        <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fair Market Value Rates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fair Market Value Rates</CardTitle>
              <CardDescription>
                Enter the Initial FMV rate. Renewal and Monthly Renewal are calculated from it automatically.
                Prorated Renewal is calculated per sale as <strong>Monthly Rate × months remaining in the year</strong> based on the effective date (e.g. effective Jun 1 = 7 months of coverage).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">

              {/* Initial — editable */}
              <div className="flex items-center gap-3">
                <div className="w-48 flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-foreground">
                  Initial
                </div>
                <div className="w-44 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-7"
                    {...register("fmvInitial")}
                  />
                </div>
              </div>

              <Separator />

              {/* Derived rates — read-only */}
              {[
                { label: "Renewal", value: derivedRenewal, formula: "Initial ÷ 2" },
                { label: "Monthly Renewal", value: derivedMonthly, formula: "Renewal ÷ 12" },
              ].map(({ label, value, formula }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-48 flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-foreground">
                    {label}
                  </div>
                  <div className="w-44 flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                    {fmvInitialVal > 0 ? formatCurrency(value) : "—"}
                  </div>
                  <span className="text-xs text-muted-foreground">{formula}</span>
                </div>
              ))}

            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-end">
            <Button type="submit" className="gap-2" disabled={updateSettings.isPending}>
              <Save className="w-4 h-4" />
              {updateSettings.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>

        {/* Commission Table — outside the main form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Commission Table Override</CardTitle>
            <CardDescription>
              Optionally upload a CSV to override estimated commissions for specific Sales Source + Sales Type + Commission Type combinations. When a match is found, it takes priority over the formula-based calculation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-3 flex-wrap">
              <Button type="button" variant="outline" className="gap-2" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4" />
                Download Template
              </Button>
              <Button type="button" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4" />
                Upload Filled CSV
              </Button>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </div>

            {commissionTable && commissionTable.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  {uploadName ? `${uploadName} loaded` : "Commission table active"} — {commissionTable.length} rows
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">Sales Source</th>
                        <th className="px-3 py-2 text-left font-medium">Sales Type</th>
                        <th className="px-3 py-2 text-left font-medium">Commission Type</th>
                        <th className="px-3 py-2 text-right font-medium">Est. Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissionTable.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-1.5">{row.salesSource}</td>
                          <td className="px-3 py-1.5">{row.salesType}</td>
                          <td className="px-3 py-1.5">{row.commissionType}</td>
                          <td className="px-3 py-1.5 text-right">
                            {row.estimatedCommission != null
                              ? formatCurrency(row.estimatedCommission)
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start gap-2 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    updateSettings.mutate(
                      { data: { commissionTable: null } },
                      {
                        onSuccess: () => {
                          setCommissionTable(null);
                          setUploadName(null);
                          toast({ title: "Commission table cleared" });
                          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
                        },
                      }
                    );
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Table
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No override table uploaded. Commissions are calculated automatically from the FMV Initial rate.
              </p>
            )}
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
}
