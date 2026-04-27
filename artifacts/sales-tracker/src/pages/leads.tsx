import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  useListLeadSources,
  useCreateLeadSource,
  useDeleteLeadSource,
  getListLeadsQueryKey,
  getListLeadSourcesQueryKey,
  getGetMetricsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
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
import { Plus, Trash2, Pencil, ChevronDown, Settings2 } from "lucide-react";
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
  const deleteSource = useDeleteLeadSource();

  const [addOpen, setAddOpen] = useState(false);
  const [editLead, setEditLead] = useState<any | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm());

  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceName, setSourceName] = useState("");
  const [sourceCostPerLead, setSourceCostPerLead] = useState("");
  const [sourceIsPaid, setSourceIsPaid] = useState(false);

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

  const handleAddSource = () => {
    if (!sourceName.trim()) return;
    createSource.mutate(
      {
        data: {
          name: sourceName.trim(),
          costPerLead: sourceCostPerLead ? parseFloat(sourceCostPerLead) : 0,
          isPaid: sourceIsPaid,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Lead source added" });
          qc.invalidateQueries({ queryKey: getListLeadSourcesQueryKey() });
          setSourceName("");
          setSourceCostPerLead("");
          setSourceIsPaid(false);
        },
        onError: () => toast({ title: "Failed to add source", variant: "destructive" }),
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
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setSourceOpen(true)}>
                <Settings2 className="w-4 h-4 mr-1" /> Lead Sources
              </Button>
            )}
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
                <Select value={form.leadSourceId} onValueChange={(v) => setForm((p) => ({ ...p, leadSourceId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
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

      {/* Lead Sources Manager (Admin) */}
      {isAdmin && (
        <Dialog open={sourceOpen} onOpenChange={setSourceOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Lead Sources</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <div className="space-y-1">
                  <Label>Source Name</Label>
                  <Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="e.g. QuoteWizard" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Cost per Lead ($)</Label>
                    <Input type="number" value={sourceCostPerLead} onChange={(e) => setSourceCostPerLead(e.target.value)} placeholder="0.00" min="0" step="0.01" />
                  </div>
                  <div className="space-y-1">
                    <Label>Paid Source?</Label>
                    <div className="flex items-center gap-2 pt-2">
                      <Switch checked={sourceIsPaid} onCheckedChange={setSourceIsPaid} />
                      <span className="text-sm text-muted-foreground">{sourceIsPaid ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
                <Button onClick={handleAddSource} disabled={createSource.isPending} className="w-full">
                  <Plus className="w-4 h-4 mr-1" /> Add Source
                </Button>
              </div>
              <div className="space-y-2">
                {(leadSources as any[]).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No lead sources yet</p>
                )}
                {(leadSources as any[]).map((src) => (
                  <div key={src.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{src.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {src.isPaid ? `Paid · $${src.costPerLead ?? 0}/lead` : "Organic"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteSource(src.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
