import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, Save } from "lucide-react";
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

const settingsSchema = z.object({
  recipients: z.array(z.object({ email: z.string().email("Invalid email") })).min(1, "At least one recipient required"),
  reportDayOfWeek: z.string(),
  reportHour: z.string(),
  reportMinute: z.string(),
  commissionRates: z.array(z.object({
    type: z.string().min(1, "Type is required"),
    rate: z.string().min(1, "Rate is required"),
  })),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [initialized, setInitialized] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      recipients: [{ email: "" }],
      reportDayOfWeek: "4",
      reportHour: "17",
      reportMinute: "0",
      commissionRates: [],
    },
  });

  const {
    fields: recipientFields,
    append: appendRecipient,
    remove: removeRecipient,
  } = useFieldArray({ control: form.control, name: "recipients" });

  const {
    fields: rateFields,
    append: appendRate,
    remove: removeRate,
  } = useFieldArray({ control: form.control, name: "commissionRates" });

  useEffect(() => {
    if (settings && !initialized) {
      form.reset({
        recipients: settings.recipients.map((e) => ({ email: e })),
        reportDayOfWeek: String(settings.reportDayOfWeek),
        reportHour: String(settings.reportHour),
        reportMinute: String(settings.reportMinute),
        commissionRates: Object.entries(settings.commissionRates).map(([type, rate]) => ({
          type,
          rate: String(rate),
        })),
      });
      setInitialized(true);
    }
  }, [settings, initialized, form]);

  const onSubmit = (data: SettingsFormValues) => {
    const commissionRates: Record<string, number> = {};
    data.commissionRates.forEach(({ type, rate }) => {
      commissionRates[type.trim()] = parseFloat(rate);
    });

    updateSettings.mutate(
      {
        data: {
          recipients: data.recipients.map((r) => r.email.trim()),
          reportDayOfWeek: parseInt(data.reportDayOfWeek),
          reportHour: parseInt(data.reportHour),
          reportMinute: parseInt(data.reportMinute),
          commissionRates,
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

  const { register, formState: { errors }, watch, setValue } = form;

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
              {recipientFields.map((field, idx) => (
                <div key={field.id} className="flex gap-2 items-start">
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
                    onClick={() => removeRecipient(idx)}
                    disabled={recipientFields.length === 1}
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
                onClick={() => appendRecipient({ email: "" })}
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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

          {/* Commission Rates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Commission Rates</CardTitle>
              <CardDescription>
                Set a flat dollar amount per commission type (e.g., 500 = $500.00). When you select a commission type on a sale, the estimated commission is automatically filled with this flat rate.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {rateFields.length === 0 && (
                <p className="text-sm text-muted-foreground">No rates configured yet. Add one below.</p>
              )}
              {rateFields.map((field, idx) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      placeholder="Commission type (e.g. FYC)"
                      {...register(`commissionRates.${idx}.type`)}
                    />
                    {errors.commissionRates?.[idx]?.type && (
                      <p className="text-destructive text-xs mt-1">{errors.commissionRates[idx]?.type?.message}</p>
                    )}
                  </div>
                  <div className="w-36 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-7"
                      {...register(`commissionRates.${idx}.rate`)}
                    />
                    {errors.commissionRates?.[idx]?.rate && (
                      <p className="text-destructive text-xs mt-1">{errors.commissionRates[idx]?.rate?.message}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeRate(idx)}
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
                onClick={() => appendRate({ type: "", rate: "" })}
              >
                <Plus className="w-4 h-4" />
                Add Rate
              </Button>
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
      </div>
    </Layout>
  );
}
