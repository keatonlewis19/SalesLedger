import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, Save, Download, Upload, CheckCircle2, Lock, ImageIcon, Palette, X } from "lucide-react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey, useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAgencyUser } from "@/hooks/useAgencyUser";
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
  const { isAdmin, agencyUser } = useAgencyUser();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const updateMe = useUpdateMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [initialized, setInitialized] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [hexInput, setHexInput] = useState("#0d9488");
  const [commissionTable, setCommissionTable] = useState<CommissionTableRow[] | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [brandColor, setBrandColor] = useState("#0d9488");
  const [brandName, setBrandName] = useState("CRM Group Insurance");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

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
    if (agencyUser?.fullName) {
      setDisplayName(agencyUser.fullName);
    }
  }, [agencyUser]);

  const handleSaveName = () => {
    const trimmed = displayName.trim();
    setSavingName(true);
    updateMe.mutate(
      { data: { fullName: trimmed || null } },
      {
        onSuccess: () => {
          toast({ title: "Display name updated" });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setSavingName(false);
        },
        onError: () => {
          toast({ title: "Failed to update name", variant: "destructive" });
          setSavingName(false);
        },
      }
    );
  };

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
      if (settings.brandColor) { setBrandColor(settings.brandColor); setHexInput(settings.brandColor); }
      if (settings.brandName) setBrandName(settings.brandName);
      if (settings.logoPath) {
        setLogoPath(settings.logoPath);
        setLogoPreviewUrl(`/api/storage${settings.logoPath}`);
      }
      setInitialized(true);
    }
  }, [settings, initialized, form]);

  const fmvInitialVal = parseFloat(watch("fmvInitial") || "0") || 0;
  const derivedRenewal = fmvInitialVal / 2;
  const derivedMonthly = derivedRenewal / 12;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    setLogoUploading(true);
    try {
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      await new Promise<void>((resolve, reject) => {
        updateSettings.mutate(
          { data: { logoPath: objectPath } },
          {
            onSuccess: () => {
              setLogoPath(objectPath);
              setLogoPreviewUrl(`/api/storage${objectPath}`);
              queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
              toast({ title: "Logo uploaded" });
              resolve();
            },
            onError: () => {
              reject(new Error("Failed to save logo path"));
            },
          }
        );
      });
    } catch {
      toast({ title: "Logo upload failed", variant: "destructive" });
    } finally {
      setLogoUploading(false);
      if (logoFileInputRef.current) logoFileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    updateSettings.mutate(
      { data: { logoPath: null } },
      {
        onSuccess: () => {
          setLogoPath(null);
          setLogoPreviewUrl(null);
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          toast({ title: "Logo removed" });
        },
      }
    );
  };

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
          brandColor,
          brandName,
          logoPath,
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
          <p className="text-muted-foreground mt-1">
            {isAdmin
              ? "Configure reports, schedule, and commission rates."
              : "View commission rates and report settings (read-only for agents)."}
          </p>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
            <Lock className="w-5 h-5 shrink-0 text-amber-600" />
            <div>
              <div className="font-semibold text-sm">View only</div>
              <div className="text-xs text-amber-700 mt-0.5">
                Commission rates and settings are managed by your agency admin.
              </div>
            </div>
          </div>
        )}

        {/* Your Profile — visible to all users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Profile</CardTitle>
            <CardDescription>Update your display name shown in team lists and reports.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Display Name</Label>
              <div className="flex items-center gap-3 max-w-xs">
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                />
                <Button
                  type="button"
                  size="sm"
                  className="gap-2 shrink-0"
                  onClick={handleSaveName}
                  disabled={savingName}
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingName ? "Saving…" : "Save"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Shown on the Team page and in email reports.</p>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={form.handleSubmit(isAdmin ? onSubmit : (e) => e.preventDefault())} className="flex flex-col gap-6">

          {/* Agency Branding — admin only */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Agency Branding
                </CardTitle>
                <CardDescription>
                  Your logo, name, and color appear in the sidebar, on all dashboards, and in email reports.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">

                {/* Logo */}
                <div className="flex flex-col gap-2">
                  <Label className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Agency Logo
                  </Label>
                  {logoPreviewUrl ? (
                    <div className="flex items-center gap-4">
                      <div className="relative w-32 h-16 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
                        <img src={logoPreviewUrl} alt="Agency logo" className="max-h-14 max-w-28 object-contain" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 text-muted-foreground hover:text-destructive"
                        onClick={handleRemoveLogo}
                      >
                        <X className="w-3.5 h-3.5" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-48 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/40 hover:bg-muted/70 transition-colors flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => logoFileInputRef.current?.click()}
                      disabled={logoUploading}
                    >
                      {logoUploading ? (
                        <span className="text-xs">Uploading…</span>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span className="text-xs font-medium">Upload logo</span>
                          <span className="text-[11px]">PNG, JPG, or SVG</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>

                {/* Agency Name */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="brandName">Agency Name</Label>
                  <Input
                    id="brandName"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. CRM Group Insurance"
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground">Shown in the sidebar and email reports.</p>
                </div>

                {/* Brand Color */}
                <div className="flex flex-col gap-2">
                  <Label>Brand Color</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={brandColor}
                        onChange={(e) => { setBrandColor(e.target.value); setHexInput(e.target.value.toUpperCase()); }}
                        className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
                      />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40">
                      <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: brandColor }} />
                      <input
                        type="text"
                        value={hexInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          setHexInput(v);
                          if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                            setBrandColor(v);
                          }
                        }}
                        onBlur={() => setHexInput(brandColor.toUpperCase())}
                        className="text-sm font-mono text-foreground bg-transparent outline-none w-20"
                        maxLength={7}
                        spellCheck={false}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Updates the sidebar, buttons, and accents in real-time.
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          )}

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

          {isAdmin && (
            <div className="flex justify-end">
              <Button type="submit" className="gap-2" disabled={updateSettings.isPending}>
                <Save className="w-4 h-4" />
                {updateSettings.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          )}
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
