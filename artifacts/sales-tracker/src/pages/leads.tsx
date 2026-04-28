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
  useGetSettings,
  useListAgencyUsers,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Plus, Trash2, Pencil, ChevronDown, Settings2, ArrowLeft, DollarSign, Upload, ChevronsUpDown, ChevronUp } from "lucide-react";
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

const LOB_TABS = [
  { value: "medicare", label: "Medicare" },
  { value: "aca", label: "ACA / Individual Health" },
  { value: "ancillary", label: "Ancillary" },
  { value: "life", label: "Life Insurance" },
  { value: "annuity", label: "Annuities" },
] as const;

type LobValue = typeof LOB_TABS[number]["value"];

const ANCILLARY_TYPES = [
  "Dental",
  "Vision",
  "DVH",
  "Hospital Indemnity",
  "Accident",
  "Critical Illness",
] as const;

type LobSaleForm = {
  firstName: string;
  lastName: string;
  carrier: string;
  revenue: string;
  soldDate: string;
  ancillaryType: string;
  notes: string;
};

const emptyLobSaleForm = (): LobSaleForm => ({
  firstName: "",
  lastName: "",
  carrier: "",
  revenue: "",
  soldDate: today,
  ancillaryType: "",
  notes: "",
});

function CarrierSelect({
  value,
  onChange,
  carriers,
  placeholder = "Select carrier…",
}: {
  value: string;
  onChange: (v: string) => void;
  carriers: string[];
  placeholder?: string;
}) {
  const allOptions = [...carriers];
  if (value && !allOptions.includes(value)) allOptions.unshift(value);

  if (allOptions.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Humana"
      />
    );
  }

  return (
    <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">— None —</SelectItem>
        {allOptions.map((c) => (
          <SelectItem key={c} value={c}>{c}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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
  lineOfBusiness: LobValue | "";
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  leadOwnership: "Agency BOB" | "Self-Generated" | "";
  leadSourceId: string;
  state: string;
  county: string;
  zip: string;
  status: LeadStatus;
  notes: string;
  enteredDate: string;
  soldDate: string;
  // ACA-specific
  marketplace: "Yes" | "No" | "";
  householdCount: string;
  // Ancillary-specific
  ancillaryType: string;
  // Life-specific
  salesType: string;
  faceValue: string;
  // Annuity-specific
  qualified: "Yes" | "No" | "";
  principal: string;
};

const emptyForm = (lob: LobValue | "" = ""): LeadForm => ({
  lineOfBusiness: lob,
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  leadOwnership: "",
  leadSourceId: "",
  state: "",
  county: "",
  zip: "",
  status: "new",
  notes: "",
  enteredDate: today,
  soldDate: "",
  marketplace: "",
  householdCount: "",
  ancillaryType: "",
  salesType: "",
  faceValue: "",
  qualified: "",
  principal: "",
});

function formToPayload(f: LeadForm) {
  return {
    lineOfBusiness: (f.lineOfBusiness || "medicare") as LobValue,
    firstName: f.firstName,
    lastName: f.lastName || undefined,
    phone: f.phone || undefined,
    email: f.email || undefined,
    leadOwnership: (f.leadOwnership || null) as "Agency BOB" | "Self-Generated" | null,
    leadSourceId: f.leadSourceId ? parseInt(f.leadSourceId) : null,
    state: f.state || null,
    county: f.county || null,
    zip: f.zip || null,
    status: f.status,
    notes: f.notes || null,
    enteredDate: f.enteredDate,
    soldDate: f.soldDate || null,
    // ACA
    marketplace: (f.marketplace || null) as "Yes" | "No" | null,
    householdCount: f.householdCount ? parseInt(f.householdCount) : null,
    // Ancillary
    ancillaryType: f.ancillaryType || null,
    // Life
    salesType: f.salesType || null,
    faceValue: f.faceValue ? parseFloat(f.faceValue) : null,
    // Annuity
    qualified: (f.qualified || null) as "Yes" | "No" | null,
    principal: f.principal ? parseFloat(f.principal) : null,
  };
}

export default function LeadsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAgencyUser();

  const { data: leads = [], isLoading } = useListLeads();
  const { data: leadSources = [] } = useListLeadSources();
  const { data: settings } = useGetSettings();
  const { data: agencyUsers = [] } = useListAgencyUsers();
  const carrierOptions = Object.keys((settings as any)?.carrierColors ?? {}).sort();
  const [selectedAgent, setSelectedAgent] = useState<string>("__all");
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const createSource = useCreateLeadSource();
  const updateSource = useUpdateLeadSource();
  const deleteSource = useDeleteLeadSource();
  const createPayment = useCreateLeadSourcePayment();
  const deletePayment = useDeleteLeadSourcePayment();

  const [activeLob, setActiveLob] = useState<LobValue>("medicare");

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "lead" | "source"; id: number; message: string } | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editLead, setEditLead] = useState<any | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm());
  const [inlineAddingSource, setInlineAddingSource] = useState(false);
  const [inlineSourceName, setInlineSourceName] = useState("");

  const [lobSaleOpen, setLobSaleOpen] = useState(false);
  const [lobSaleEditId, setLobSaleEditId] = useState<number | null>(null);
  const [lobSaleForm, setLobSaleForm] = useState<LobSaleForm>(emptyLobSaleForm());

  const [sourceOpen, setSourceOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<any | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceIsPaid, setSourceIsPaid] = useState(false);
  const [sourceCostPerLead, setSourceCostPerLead] = useState("");

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

  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());

  const toggleFilterStatus = (val: string) => {
    setFilterStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };
  const [sortCol, setSortCol] = useState<string>("entered");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
  };

  const openAdd = () => {
    setForm(emptyForm(activeLob));
    setEditLead(null);
    setInlineAddingSource(false);
    setInlineSourceName("");
    setAddOpen(true);
  };

  const openEdit = (lead: any) => {
    setEditLead(lead);
    setInlineAddingSource(false);
    setInlineSourceName("");
    setForm({
      lineOfBusiness: (lead.lineOfBusiness ?? "medicare") as LobValue | "",
      firstName: lead.firstName ?? "",
      lastName: lead.lastName ?? "",
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      leadOwnership: (lead.leadOwnership ?? "") as "Agency BOB" | "Self-Generated" | "",
      leadSourceId: lead.leadSourceId != null ? String(lead.leadSourceId) : "",
      state: lead.state ?? "",
      county: lead.county ?? "",
      zip: lead.zip ?? "",
      status: lead.status as LeadStatus,
      notes: lead.notes ?? "",
      enteredDate: lead.enteredDate ?? today,
      soldDate: lead.soldDate ?? "",
      marketplace: (lead.marketplace ?? "") as "Yes" | "No" | "",
      householdCount: lead.householdCount != null ? String(lead.householdCount) : "",
      ancillaryType: lead.ancillaryType ?? "",
      salesType: lead.salesType ?? "",
      faceValue: lead.faceValue != null ? String(lead.faceValue) : "",
      qualified: (lead.qualified ?? "") as "Yes" | "No" | "",
      principal: lead.principal != null ? String(lead.principal) : "",
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

  const openLobSaleAdd = () => {
    setLobSaleEditId(null);
    setLobSaleForm(emptyLobSaleForm());
    setLobSaleOpen(true);
  };

  const openLobSaleEdit = (lead: any) => {
    setLobSaleEditId(lead.id);
    setLobSaleForm({
      firstName: lead.firstName ?? "",
      lastName: lead.lastName ?? "",
      carrier: lead.carrier ?? "",
      revenue: lead.revenue != null ? String(lead.revenue) : "",
      soldDate: lead.soldDate ?? today,
      ancillaryType: lead.ancillaryType ?? "",
      notes: lead.notes ?? "",
    });
    setLobSaleOpen(true);
  };

  const handleSaveLobSale = () => {
    if (!lobSaleForm.firstName.trim()) {
      toast({ title: "First name is required", variant: "destructive" });
      return;
    }
    const payload = {
      firstName: lobSaleForm.firstName,
      lastName: lobSaleForm.lastName || undefined,
      carrier: lobSaleForm.carrier || null,
      revenue: lobSaleForm.revenue ? parseFloat(lobSaleForm.revenue) : null,
      soldDate: lobSaleForm.soldDate || today,
      enteredDate: lobSaleForm.soldDate || today,
      status: "sold" as const,
      lineOfBusiness: activeLob,
      ancillaryType: lobSaleForm.ancillaryType || null,
      notes: lobSaleForm.notes || null,
    };
    if (lobSaleEditId != null) {
      updateLead.mutate(
        { id: lobSaleEditId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Sale updated" });
            invalidate();
            setLobSaleOpen(false);
          },
          onError: () => toast({ title: "Failed to update sale", variant: "destructive" }),
        },
      );
    } else {
      createLead.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Sale recorded" });
            invalidate();
            setLobSaleOpen(false);
          },
          onError: () => toast({ title: "Failed to record sale", variant: "destructive" }),
        },
      );
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirm({ type: "lead", id, message: "Delete this lead? This will also remove any linked sale entry." });
  };

  const execDeleteLead = (id: number) => {
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
    setSourceCostPerLead("");
  };

  const openEditSource = (src: any) => {
    setEditingSource(src);
    setSourceName(src.name ?? "");
    setSourceIsPaid(src.isPaid ?? false);
    setSourceCostPerLead(src.costPerLead != null && src.costPerLead > 0 ? String(src.costPerLead) : "");
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
    const cplVal = sourceCostPerLead.trim() ? parseFloat(sourceCostPerLead) : undefined;
    const payload = {
      name: sourceName.trim(),
      isPaid: sourceIsPaid,
      ...(sourceIsPaid && cplVal != null && !isNaN(cplVal) ? { costPerLead: cplVal } : {}),
    };
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
    setDeleteConfirm({ type: "source", id, message: "Delete this lead source? Any associated leads will also be removed." });
  };

  const execDeleteSource = (id: number) => {
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

  const STATUS_ORDER: Record<string, number> = { new: 0, in_comm: 1, appt_set: 2, follow_up: 3, sold: 4, lost: 5 };

  const agentNameMap = Object.fromEntries(
    (agencyUsers as any[]).map((u) => [u.clerkUserId, u.fullName || u.email])
  );
  const showAgentCol = isAdmin && selectedAgent === "__all";

  const lobLeads = (leads as any[])
    .filter((l) => (l.lineOfBusiness ?? "medicare") === activeLob)
    .filter((l) => !isAdmin || selectedAgent === "__all" || l.userId === selectedAgent);
  const baseFiltered = filterStatuses.size === 0 ? lobLeads : lobLeads.filter((l: any) => filterStatuses.has(l.status));

  const filtered = [...baseFiltered].sort((a: any, b: any) => {
    const dir = sortDir === "asc" ? 1 : -1;
    let av: any, bv: any;
    switch (sortCol) {
      case "name":   av = `${a.firstName} ${a.lastName ?? ""}`; bv = `${b.firstName} ${b.lastName ?? ""}`; break;
      case "source": av = a.leadSource?.name ?? ""; bv = b.leadSource?.name ?? ""; break;
      case "status": av = STATUS_ORDER[a.status] ?? 99; bv = STATUS_ORDER[b.status] ?? 99; return (av - bv) * dir;
      case "revenue":
        if (a.revenue == null && b.revenue == null) return 0;
        if (a.revenue == null) return 1;
        if (b.revenue == null) return -1;
        return (a.revenue - b.revenue) * dir;
      case "carrier": av = a.carrier ?? ""; bv = b.carrier ?? ""; break;
      case "entered": av = a.enteredDate ?? ""; bv = b.enteredDate ?? ""; break;
      case "sold":
        if (!a.soldDate && !b.soldDate) return 0;
        if (!a.soldDate) return 1;
        if (!b.soldDate) return -1;
        av = a.soldDate; bv = b.soldDate; break;
      case "agent": av = agentNameMap[a.userId] ?? ""; bv = agentNameMap[b.userId] ?? ""; break;
      default: return 0;
    }
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
  });

  const f = (key: keyof LeadForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Leads & Sales</h1>
            <p className="text-muted-foreground text-sm">
              {activeLob === "medicare"
                ? "Track leads through the Medicare sales pipeline"
                : `Record ${LOB_TABS.find((t) => t.value === activeLob)?.label} sales as they happen`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Agent:</span>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All Agents</SelectItem>
                    {(agencyUsers as any[]).map((u) => (
                      <SelectItem key={u.clerkUserId} value={u.clerkUserId}>
                        {u.fullName || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {activeLob === "medicare" && (
              <>
                <Button variant="outline" size="sm" onClick={() => { resetSourceForm(); setSourceOpen(true); }}>
                  <Settings2 className="w-4 h-4 mr-1" /> Lead Sources
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="w-4 h-4 mr-1" /> Upload CSV
                </Button>
                <Button size="sm" onClick={openAdd}>
                  <Plus className="w-4 h-4 mr-1" /> Add Lead
                </Button>
              </>
            )}
            {activeLob !== "medicare" && (
              <Button size="sm" onClick={openLobSaleAdd}>
                <Plus className="w-4 h-4 mr-1" /> Record Sale
              </Button>
            )}
          </div>
        </div>

        {/* LOB Tabs */}
        <div className="flex justify-center gap-1 border-b border-border overflow-x-auto">
          {LOB_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setActiveLob(tab.value); setFilterStatuses(new Set()); }}
              className={cn(
                "px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                activeLob === tab.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {tab.label}
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {(leads as any[]).filter((l) => (l.lineOfBusiness ?? "medicare") === tab.value).length}
              </span>
            </button>
          ))}
        </div>

        {/* Medicare: Status filter pills */}
        {activeLob === "medicare" && (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setFilterStatuses(new Set())}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                filterStatuses.size === 0
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/40")}
            >
              All ({lobLeads.length})
            </button>
            {STATUSES.map((s) => {
              const count = lobLeads.filter((l: any) => l.status === s.value).length;
              const active = filterStatuses.has(s.value);
              return (
                <button
                  key={s.value}
                  onClick={() => toggleFilterStatus(s.value)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/40")}
                >
                  {s.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Medicare: Full pipeline leads table */}
        {activeLob === "medicare" && (
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
                        {([ ["name","Name"], ["source","Source"], ["status","Status"], ["revenue","Revenue"], ["carrier","Carrier"], ["entered","Entered"], ["sold","Sold"], ...(showAgentCol ? [["agent","Agent"]] : []) ] as [string,string][]).map(([col, label]) => (
                          <th key={col} className="text-left px-4 py-3 font-medium">
                            <button
                              onClick={() => handleSort(col)}
                              className="flex items-center gap-1 hover:text-foreground text-foreground/80 transition-colors group"
                            >
                              {label}
                              {sortCol === col ? (
                                sortDir === "asc"
                                  ? <ChevronUp className="w-3.5 h-3.5 text-foreground" />
                                  : <ChevronDown className="w-3.5 h-3.5 text-foreground" />
                              ) : (
                                <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                              )}
                            </button>
                          </th>
                        ))}
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
                          {showAgentCol && (
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {agentNameMap[lead.userId] ?? "—"}
                            </td>
                          )}
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
        )}

        {/* Non-Medicare: Simple sales log */}
        {activeLob !== "medicare" && (
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : lobLeads.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <p className="text-lg font-medium mb-1">No sales recorded yet</p>
                  <p className="text-sm">Click "Record Sale" to add your first entry.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium">Client</th>
                        {showAgentCol && <th className="text-left px-4 py-3 font-medium">Agent</th>}
                        {activeLob === "ancillary" && <th className="text-left px-4 py-3 font-medium">Type</th>}
                        <th className="text-left px-4 py-3 font-medium">Carrier</th>
                        <th className="text-left px-4 py-3 font-medium">Revenue</th>
                        <th className="text-left px-4 py-3 font-medium">Sale Date</th>
                        <th className="text-left px-4 py-3 font-medium">Notes</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {lobLeads.sort((a: any, b: any) => (b.soldDate ?? b.enteredDate) > (a.soldDate ?? a.enteredDate) ? 1 : -1).map((lead: any) => (
                        <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">
                            {lead.firstName} {lead.lastName ?? ""}
                          </td>
                          {showAgentCol && (
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {agentNameMap[lead.userId] ?? "—"}
                            </td>
                          )}
                          {activeLob === "ancillary" && (
                            <td className="px-4 py-3">
                              {lead.ancillaryType ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                                  {lead.ancillaryType}
                                </span>
                              ) : "—"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-muted-foreground">{lead.carrier ?? "—"}</td>
                          <td className="px-4 py-3 font-medium text-green-700">
                            {lead.revenue != null ? `$${lead.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{lead.soldDate ?? lead.enteredDate}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{lead.notes ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openLobSaleEdit(lead)}>
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
        )}
      </div>

      {/* Add/Edit Lead Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editLead ? "Edit Lead" : "Add Lead"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Product Type selector */}
            <div className="space-y-1">
              <Label>Product Type *</Label>
              <Select
                value={form.lineOfBusiness || "none"}
                onValueChange={(v) => setForm((p) => ({ ...p, lineOfBusiness: v === "none" ? "" : v as LobValue }))}
              >
                <SelectTrigger><SelectValue placeholder="Select product type…" /></SelectTrigger>
                <SelectContent>
                  {LOB_TABS.map((tab) => (
                    <SelectItem key={tab.value} value={tab.value}>{tab.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.lineOfBusiness && (
              <>
                {/* Name */}
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

                {/* Lead Ownership */}
                <div className="space-y-1">
                  <Label>Lead Ownership</Label>
                  <Select
                    value={form.leadOwnership || "none"}
                    onValueChange={(v) => {
                      setForm((p) => ({
                        ...p,
                        leadOwnership: v === "none" ? "" : v as "Agency BOB" | "Self-Generated",
                        leadSourceId: v !== "Self-Generated" ? "" : p.leadSourceId,
                      }));
                      setInlineAddingSource(false);
                      setInlineSourceName("");
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select ownership…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      <SelectItem value="Agency BOB">Agency BOB</SelectItem>
                      <SelectItem value="Self-Generated">Self-Generated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Lead Source (Self-Generated only) */}
                {form.leadOwnership === "Self-Generated" && (
                  <div className="space-y-1">
                    <Label>Lead Source</Label>
                    {inlineAddingSource ? (
                      <div className="flex gap-2">
                        <Input
                          autoFocus
                          value={inlineSourceName}
                          onChange={(e) => setInlineSourceName(e.target.value)}
                          placeholder="New source name…"
                          onKeyDown={async (e) => {
                            if (e.key === "Enter" && inlineSourceName.trim()) {
                              const src = await createSource.mutateAsync({ data: { name: inlineSourceName.trim(), isPaid: false } });
                              qc.invalidateQueries({ queryKey: getListLeadSourcesQueryKey() });
                              setForm((p) => ({ ...p, leadSourceId: String((src as any).id) }));
                              setInlineAddingSource(false);
                              setInlineSourceName("");
                            } else if (e.key === "Escape") {
                              setInlineAddingSource(false);
                              setInlineSourceName("");
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={!inlineSourceName.trim() || createSource.isPending}
                          onClick={async () => {
                            if (!inlineSourceName.trim()) return;
                            const src = await createSource.mutateAsync({ data: { name: inlineSourceName.trim(), isPaid: false } });
                            qc.invalidateQueries({ queryKey: getListLeadSourcesQueryKey() });
                            setForm((p) => ({ ...p, leadSourceId: String((src as any).id) }));
                            setInlineAddingSource(false);
                            setInlineSourceName("");
                          }}
                        >
                          Add
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setInlineAddingSource(false); setInlineSourceName(""); }}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={form.leadSourceId || "none"}
                        onValueChange={(v) => {
                          if (v === "__add_new") { setInlineAddingSource(true); return; }
                          setForm((p) => ({ ...p, leadSourceId: v === "none" ? "" : v }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select source…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {(leadSources as any[]).map((src) => (
                            <SelectItem key={src.id} value={String(src.id)}>{src.name}</SelectItem>
                          ))}
                          <SelectItem value="__add_new">+ Add new source…</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {/* ACA: Marketplace + Household Count */}
                {form.lineOfBusiness === "aca" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Marketplace</Label>
                      <Select
                        value={form.marketplace || "none"}
                        onValueChange={(v) => setForm((p) => ({ ...p, marketplace: v === "none" ? "" : v as "Yes" | "No" }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="householdCount">Household Count</Label>
                      <Input id="householdCount" type="number" value={form.householdCount} onChange={f("householdCount")} placeholder="e.g. 3" min="1" />
                    </div>
                  </div>
                )}

                {/* Ancillary: Product Type */}
                {form.lineOfBusiness === "ancillary" && (
                  <div className="space-y-1">
                    <Label>Product Type</Label>
                    <Select
                      value={form.ancillaryType || "none"}
                      onValueChange={(v) => setForm((p) => ({ ...p, ancillaryType: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select product type…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        <SelectItem value="Dental">Dental</SelectItem>
                        <SelectItem value="Vision">Vision</SelectItem>
                        <SelectItem value="DVH">DVH</SelectItem>
                        <SelectItem value="Hospital Indemnity">Hospital Indemnity</SelectItem>
                        <SelectItem value="Accident">Accident</SelectItem>
                        <SelectItem value="Critical Illness">Critical Illness</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Life: Product Type + Face Value */}
                {form.lineOfBusiness === "life" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Product Type</Label>
                      <Select
                        value={form.salesType || "none"}
                        onValueChange={(v) => setForm((p) => ({ ...p, salesType: v === "none" ? "" : v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          <SelectItem value="Term">Term</SelectItem>
                          <SelectItem value="Whole Life">Whole Life</SelectItem>
                          <SelectItem value="Final Expense">Final Expense</SelectItem>
                          <SelectItem value="UL">UL</SelectItem>
                          <SelectItem value="GUL">GUL</SelectItem>
                          <SelectItem value="IUL">IUL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="faceValue">Face Value ($)</Label>
                      <Input id="faceValue" type="number" value={form.faceValue} onChange={f("faceValue")} placeholder="0.00" min="0" step="0.01" />
                    </div>
                  </div>
                )}

                {/* Annuity: Qualified + Principal */}
                {form.lineOfBusiness === "annuity" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Qualified</Label>
                      <Select
                        value={form.qualified || "none"}
                        onValueChange={(v) => setForm((p) => ({ ...p, qualified: v === "none" ? "" : v as "Yes" | "No" }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="principal">Principal ($)</Label>
                      <Input id="principal" type="number" value={form.principal} onChange={f("principal")} placeholder="0.00" min="0" step="0.01" />
                    </div>
                  </div>
                )}

                {/* Contact */}
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

                {/* Location */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" value={form.state} onChange={f("state")} placeholder="FL" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="county">County</Label>
                    <Input id="county" value={form.county} onChange={f("county")} placeholder="Miami-Dade" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="zip">Zip</Label>
                    <Input id="zip" value={form.zip} onChange={f("zip")} placeholder="33101" />
                  </div>
                </div>

                {/* Status */}
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

                {/* Notes */}
                <div className="space-y-1">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" value={form.notes} onChange={f("notes")} rows={3} placeholder="Any additional notes…" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createLead.isPending || updateLead.isPending}>
              {editLead ? "Save Changes" : "Add Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LOB Sale Add/Edit Dialog */}
      <Dialog open={lobSaleOpen} onOpenChange={setLobSaleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {lobSaleEditId != null ? "Edit Sale" : "Record Sale"} — {LOB_TABS.find((t) => t.value === activeLob)?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Name *</Label>
                <Input
                  value={lobSaleForm.firstName}
                  onChange={(e) => setLobSaleForm((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input
                  value={lobSaleForm.lastName}
                  onChange={(e) => setLobSaleForm((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Doe"
                />
              </div>
            </div>
            {activeLob === "ancillary" && (
              <div className="space-y-1">
                <Label>Insurance Type *</Label>
                <Select
                  value={lobSaleForm.ancillaryType || "__none"}
                  onValueChange={(v) => setLobSaleForm((p) => ({ ...p, ancillaryType: v === "__none" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Select type —</SelectItem>
                    {ANCILLARY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Carrier</Label>
                <CarrierSelect
                  value={lobSaleForm.carrier}
                  onChange={(v) => setLobSaleForm((p) => ({ ...p, carrier: v }))}
                  carriers={carrierOptions}
                />
              </div>
              <div className="space-y-1">
                <Label>Revenue ($)</Label>
                <Input
                  type="number"
                  value={lobSaleForm.revenue}
                  onChange={(e) => setLobSaleForm((p) => ({ ...p, revenue: e.target.value }))}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Sale Date</Label>
              <Input
                type="date"
                value={lobSaleForm.soldDate}
                onChange={(e) => setLobSaleForm((p) => ({ ...p, soldDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={lobSaleForm.notes}
                onChange={(e) => setLobSaleForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Any additional notes…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLobSaleOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLobSale} disabled={createLead.isPending || updateLead.isPending}>
              {lobSaleEditId != null ? "Save Changes" : "Record Sale"}
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
                    <Switch checked={sourceIsPaid} onCheckedChange={(v) => { setSourceIsPaid(v); if (!v) setSourceCostPerLead(""); }} />
                    <span className="text-sm text-muted-foreground">{sourceIsPaid ? "Yes" : "No"}</span>
                  </div>
                </div>
                {sourceIsPaid && (
                  <div className="space-y-1">
                    <Label>Default Cost / Lead ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={sourceCostPerLead}
                      onChange={(e) => setSourceCostPerLead(e.target.value)}
                      placeholder="e.g. 50.00"
                    />
                    <p className="text-xs text-muted-foreground">Used for analytics when no per-lead cost is set</p>
                  </div>
                )}
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

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>{deleteConfirm?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteConfirm) return;
                if (deleteConfirm.type === "lead") execDeleteLead(deleteConfirm.id);
                else execDeleteSource(deleteConfirm.id);
                setDeleteConfirm(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
