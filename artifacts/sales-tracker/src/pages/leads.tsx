import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  useListLeadSources,
  useCreateLeadSource,
  useUpdateLeadSource,
  useDeleteLeadSource,
  useListLeadSourcePayments,
  useCreateLeadSourcePayment,
  useDeleteLeadSourcePayment,
  getListLeadsQueryKey,
  getListLeadSourcesQueryKey,
  getListLeadSourcePaymentsQueryKey,
  getGetMetricsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { LeadImportDialog } from "@/components/lead-import-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAgencyUser } from "@/hooks/useAgencyUser";
import { Plus, Trash2, Pencil, ChevronDown, Settings2, ArrowLeft, DollarSign, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

const STATUSES = [
  { value: "new", label: "New", color: "bg-slate-100 text-slate-700" },
  { value: "in_comm", label: "In Comm.", color: "bg-blue-100 text-blue-700" },
  { value: "appt_set", label: "Appt. Set", color: "bg-purple-100 text-purple-700" },
  { value: "follow_up", label: "Follow-Up", color: "bg-amber-100 text-amber-700" },
  { value: "sold", label: "Sold", color: "bg-green-100 text-green-700" },
  { value: "lost", label: "Lost", color: "bg-red-100 text-red-700" },
] as const;

type LeadStatus = typeof STATUSES[number]["value"];

function StatusBadge({ status }: { status: string }) {
  const found = STATUSES.find((s) => s.value === status);
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", found?.color ?? "bg-slate-100 text-slate-700")}>
      {found?.label ?? status}
    </span>
  );
}

const today = new Date().toISOString().slice(0, 10);

type LeadForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  leadSourceId: string;
  status: LeadStatus;
  revenue: string;
  carrier: string;
  salesType: string;
  commissionType: string;
  costPerLead: string;
  notes: string;
  enteredDate: string;
  soldDate: string;
};

const emptyForm = (): LeadForm => ({
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  leadSourceId: "",
  status: "new",
  revenue: "",
  carrier: "",
  salesType: "",
  commissionType: "",
  costPerLead: "",
  notes: "",
  enteredDate: today,
  soldDate: "",
});

function formToPayload(f: LeadForm) {
  return {
    firstName: f.firstName,
    lastName: f.lastName || undefined,
    phone: f.phone || undefined,
    email: f.email || undefined,
    leadSourceId: f.leadSourceId ? parseInt(f.leadSourceId) : null,
    status: f.status,
    revenue: f.revenue ? parseFloat(f.revenue) : null,
    carrier: f.carrier || null,
    salesType: f.salesType || null,
    commissionType: f.commissionType || null,
    costPerLead: f.costPerLead ? parseFloat(f.costPerLead) : null,
    notes: f.notes || null,
    enteredDate: f.enteredDate,
    soldDate: f.soldDate || null,
  };
}

export default function LeadsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAgencyUser();

  const { data: leads = [], isLoading } = useListLeads();
  const { data: leadSources = [] } = useListLeadSources();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const createSource = useCreateLeadSource();
  const updateSource = useUpdateLeadSource();
  const deleteSource = useDeleteLeadSource();
  const createPayment = useCreateLeadSourcePayment();
  const deletePayment = useDeleteLeadSourcePayment();

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editLead, setEditLead] = useState<any | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm());

  const [sourceOpen, setSourceOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<any | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceIsPaid, setSourceIsPaid] = useState(false);

  // Payments sub-view — null = show sources list, set = show payments for that source
  const [paymentsSource, setPaymentsSource] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentNote, setPaymentNote] = useState("");

  const { data: sourcePayments = [] } = useListLeadSourcePayments(
    paymentsSource?.id ?? 0,
    {
      query: {
        enabled: !!paymentsSource,
        queryKey: getListLeadSourcePaymentsQueryKey(paymentsSource?.id ?? 0),
      },
    },
  );

  const [filterStatus, setFilterStatus] = useState<string>("all");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
  };

  const openAdd = () => {
    setForm(emptyForm());
    setEditLead(null);
    setAddOpen(true);
  };

  const openEdit = (lead: any) => {
    setEditLead(lead);
    setForm({
      firstName: lead.firstName ?? "",
      lastName: lead.lastName ?? "",
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      leadSourceId: lead.leadSourceId != null ? String(lead.leadSourceId) : "",
      status: lead.status as LeadStatus,
      revenue: lead.revenue != null ? String(lead.revenue) : "",
      carrier: lead.carrier ?? "",
      salesType: lead.salesType ?? "",
      commissionType: lead.commissionType ?? "",
      costPerLead: lead.costPerLead != null ? String(lead.costPerLead) : "",
      notes: lead.notes ?? "",
      enteredDate: lead.enteredDate ?? today,
      soldDate: lead.soldDate ?? "",
    });
    setAddOpen(true);
  };

  const handleSave = () => {
    if (!form.firstName.trim()) {
      toast({ title: "First name is required", variant: "destructive" });
      return;
    }
    const payload = formToPayload(form);
    if (editLead) {
      updateLead.mutate(
        { id: editLead.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Lead updated" });
            invalidate();
            setAddOpen(false);
          },
          onError: () => toast({ title: "Failed to update lead", variant: "destructive" }),
        },
      );
    } else {
      createLead.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Lead added" });
            invalidate();
            setAddOpen(false);
          },
          onError: () => toast({ title: "Failed to add lead", variant: "destructive" }),
        },
      );
    }
  };

  const handleStatusChange = (lead: any, status: LeadStatus) => {
    const payload: any = { status };
    if (status === "sold" && !lead.soldDate) {
      payload.soldDate = today;
    }
    updateLead.mutate(
      { id: lead.id, data: payload },
      {
        onSuccess: () => {
          if (status === "sold") toast({ title: "Lead marked as Sold — added to weekly report" });
          invalidate();
        },
        onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this lead? This will also remove any linked sale entry.")) return;
    deleteLead.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Lead deleted" });
          invalidate();
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      },
    );
  };

  const resetSourceForm = () => {
    setEditingSource(null);
    setSourceName("");
    setSourceIsPaid(false);
  };

  const openEditSource = (src: any) => {
    setEditingSource(src);
    setSourceName(src.name ?? "");
    setSourceIsPaid(src.isPaid ?? false);
    setPaymentsSource(null);
  };

  const openPaymentsView = (src: any) => {
    setPaymentsSource(src);
    setEditingSource(null);
    setPaymentAmount("");
    setPaymentDate(today);
    setPaymentNote("");
  };

  const handleSaveSource = () => {
    if (!sourceName.trim()) return;
    const payload = { name: sourceName.trim(), isPaid: sourceIsPaid };
    if (editingSource) {
      updateSource.mutate(
        { id: editingSource.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Lead source updated" });
            qc.invalidateQueries({ queryKey: getListLeadSourcesQueryKey() });
            qc.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
            resetSourceForm();
          },
          onError: () => toast({ title: "Failed to update source", variant: "destructive" }),
        },
      );
    } else {
      createSource.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Lead source added" });
            qc.invalidateQueries({ queryKey: getListLeadSourcesQueryKey() });
            resetSourceForm();
          },
          onError: () => toast({ title: "Failed to add source", variant: "destructive" }),
        },
      );
    }
  };

  const handleAddPayment = () => {
    if (!paymentAmount || !paymentDate || !paymentsSource) return;
    createPayment.mutate(
      {
        id: paymentsSource.id,
        data: { amount: parseFloat(paymentAmount), paidDate: paymentDate, note: paymentNote || undefined },
      },
      {
        onSuccess: () => {
          toast({ title: "Payment added" });
          qc.invalidateQueries({ queryKey: getListLeadSourcePaymentsQueryKey(paymentsSource.id) });
          qc.invalidateQueries({ queryKey: getListLeadSourcesQueryKey() });
          qc.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
          setPaymentAmount("");
          setPaymentDate(today);
          setPaymentNote("");
        },
        onError: () => toast({ title: "Failed to add payment", variant: "destructive" }),
      },
    );
  };

  const handleDeletePayment = (paymentId: number) => {
    if (!paymentsSource) return;
    deletePayment.mutate(
      { id: paymentsSource.id, paymentId },
      {
        onSuccess: () => {
          toast({ title: "Payment removed" });
          qc.invalidateQueries({ queryKey: getListLeadSourcePaymentsQueryKey(paymentsSource.id) });
          qc.invalidateQueries({ queryKey: getListLeadSourcesQueryKey() });
          qc.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
        },
        onError: () => toast({ title: "Failed to delete payment", variant: "destructive" }),
      },
    );
  };

  const handleDeleteSource = (id: number) => {
    if (!confirm("Delete this lead source?")) return;
    deleteSource.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Lead source deleted" });
          qc.invalidateQueries({ queryKey: getListLeadSourcesQueryKey() });
        },
        onError: () => toast({ title: "Failed to delete source", variant: "destructive" }),
      },
    );
  };

  const filtered = filterStatus === "all" ? leads : leads.filter((l: any) => l.status === filterStatus);

  const f = (key: keyof LeadForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Leads</h1>
            <p className="text-muted-foreground text-sm">Track your leads through the sales pipeline</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { resetSourceForm(); setSourceOpen(true); }}>
              <Settings2 className="w-4 h-4 mr-1" /> Lead Sources
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-1" /> Upload CSV
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="w-4 h-4 mr-1" /> Add Lead
            </Button>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors", filterStatus === "all" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/40")}
          >
            All ({leads.length})
          </button>
          {STATUSES.map((s) => {
            const count = leads.filter((l: any) => l.status === s.value).length;
            return (
              <button
                key={s.value}
                onClick={() => setFilterStatus(s.value)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors", filterStatus === s.value ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/40")}
              >
                {s.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Leads table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <p className="text-lg font-medium mb-1">No leads found</p>
                <p className="text-sm">Click "Add Lead" to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium">Name</th>
                      <th className="text-left px-4 py-3 font-medium">Source</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Revenue</th>
                      <th className="text-left px-4 py-3 font-medium">Carrier</th>
                      <th className="text-left px-4 py-3 font-medium">Entered</th>
                      <th className="text-left px-4 py-3 font-medium">Sold</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((lead: any) => (
                      <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">
                          {lead.firstName} {lead.lastName ?? ""}
                          {lead.phone && <div className="text-xs text-muted-foreground">{lead.phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {lead.leadSource?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center gap-1 group">
                                <StatusBadge status={lead.status} />
                                <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {STATUSES.map((s) => (
                                <DropdownMenuItem
                                  key={s.value}
                                  onClick={() => handleStatusChange(lead, s.value)}
                                  className={cn(lead.status === s.value && "font-semibold")}
                                >
                                  {s.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="px-4 py-3">
                          {lead.revenue != null ? `$${lead.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.carrier ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.enteredDate}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.soldDate ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(lead)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(lead.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Lead Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editLead ? "Edit Lead" : "Add Lead"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" value={form.firstName} onChange={f("firstName")} placeholder="Jane" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={form.lastName} onChange={f("lastName")} placeholder="Doe" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={f("phone")} placeholder="(555) 000-0000" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={form.email} onChange={f("email")} placeholder="jane@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Lead Source</Label>
                <Select value={form.leadSourceId || "none"} onValueChange={(v) => setForm((p) => ({ ...p, leadSourceId: v === "none" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(leadSources as any[]).map((src) => (
                      <SelectItem key={src.id} value={String(src.id)}>{src.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as LeadStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="enteredDate">Entered Date *</Label>
                <Input id="enteredDate" type="date" value={form.enteredDate} onChange={f("enteredDate")} />
              </div>
              {(form.status === "sold" || editLead?.soldDate) && (
                <div className="space-y-1">
                  <Label htmlFor="soldDate">Sold Date</Label>
                  <Input id="soldDate" type="date" value={form.soldDate} onChange={f("soldDate")} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="revenue">Annual Premium ($)</Label>
                <Input id="revenue" type="number" value={form.revenue} onChange={f("revenue")} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="carrier">Carrier</Label>
                <Input id="carrier" value={form.carrier} onChange={f("carrier")} placeholder="e.g. Humana" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="salesType">Sales Type</Label>
                <Input id="salesType" value={form.salesType} onChange={f("salesType")} placeholder="e.g. Medicare Advantage" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="commissionType">Commission Type</Label>
                <Input id="commissionType" value={form.commissionType} onChange={f("commissionType")} placeholder="e.g. Standard" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="costPerLead">Cost per Lead Override ($)</Label>
              <Input id="costPerLead" type="number" value={form.costPerLead} onChange={f("costPerLead")} placeholder="Leave blank to use source default" min="0" step="0.01" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={f("notes")} rows={3} placeholder="Any additional notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createLead.isPending || updateLead.isPending}>
              {editLead ? "Save Changes" : "Add Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Sources Manager */}
      <Dialog open={sourceOpen} onOpenChange={(open) => { setSourceOpen(open); if (!open) { resetSourceForm(); setPaymentsSource(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {paymentsSource
                ? <span className="flex items-center gap-2"><button onClick={() => setPaymentsSource(null)} className="p-0 bg-transparent border-0 cursor-pointer text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /></button>Payments · {paymentsSource.name}</span>
                : editingSource ? "Edit Lead Source" : "Manage Lead Sources"}
            </DialogTitle>
          </DialogHeader>

          {/* === PAYMENTS SUB-VIEW === */}
          {paymentsSource && (
            <div className="space-y-4">
              {/* Computed stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Total Invested", value: `$${Number(paymentsSource.totalInvested ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                  { label: "Leads", value: String(paymentsSource.leadCount ?? 0) },
                  { label: "Cost / Lead", value: `$${Number(paymentsSource.costPerLead ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="font-semibold text-sm">{stat.value}</p>
                  </div>
                ))}
              </div>
              {/* Add payment form */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Payment</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Amount ($) *</Label>
                    <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" min="0.01" step="0.01" />
                  </div>
                  <div className="space-y-1">
                    <Label>Paid Date *</Label>
                    <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Note (optional)</Label>
                  <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="e.g. Monthly subscription" />
                </div>
                <Button onClick={handleAddPayment} disabled={createPayment.isPending || !paymentAmount || !paymentDate} className="w-full">
                  <Plus className="w-4 h-4 mr-1" /> Add Payment
                </Button>
              </div>
              {/* Payment history */}
              <div className="space-y-1 max-h-52 overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Payment History</p>
                {(sourcePayments as any[]).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No payments recorded yet</p>
                )}
                {(sourcePayments as any[]).map((pmt) => (
                  <div key={pmt.id} className="flex items-center justify-between px-3 py-2 rounded-lg border bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">${Number(pmt.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground">{pmt.paidDate}{pmt.note ? ` · ${pmt.note}` : ""}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeletePayment(pmt.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === SOURCES VIEW === */}
          {!paymentsSource && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <div className="space-y-1">
                  <Label>Source Name</Label>
                  <Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="e.g. QuoteWizard" />
                </div>
                <div className="space-y-1">
                  <Label>Paid Source?</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch checked={sourceIsPaid} onCheckedChange={setSourceIsPaid} />
                    <span className="text-sm text-muted-foreground">{sourceIsPaid ? "Yes" : "No"}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveSource} disabled={createSource.isPending || updateSource.isPending} className="flex-1">
                    {editingSource ? <><Pencil className="w-4 h-4 mr-1" /> Save Changes</> : <><Plus className="w-4 h-4 mr-1" /> Add Source</>}
                  </Button>
                  {editingSource && (
                    <Button variant="outline" onClick={resetSourceForm} className="flex-1">Cancel</Button>
                  )}
                </div>
              </div>
              {!editingSource && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(leadSources as any[]).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No lead sources yet</p>
                  )}
                  {(leadSources as any[]).map((src) => (
                    <div key={src.id} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{src.name}</p>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Payments" onClick={() => openPaymentsView(src)}>
                            <DollarSign className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => openEditSource(src)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete" onClick={() => handleDeleteSource(src.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{src.isPaid ? "Paid" : "Organic"}</span>
                        {(src.totalInvested ?? 0) > 0 && <span>Invested: ${Number(src.totalInvested).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                        {(src.leadCount ?? 0) > 0 && <span>{src.leadCount} leads</span>}
                        {(src.costPerLead ?? 0) > 0 && <span>~${Number(src.costPerLead).toFixed(2)}/lead</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </Layout>
  );
}
