import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCallLogs,
  useCreateCallLog,
  useDeleteCallLog,
  getListCallLogsQueryKey,
} from "@workspace/api-client-react";
import { useAgencyUser } from "@/hooks/useAgencyUser";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListAgencyUsers } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Phone, PhoneOff, Voicemail, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const CONTACT_TYPES = [
  { value: "contacted", label: "Contacted", icon: Phone, color: "text-green-600 bg-green-50 border-green-200" },
  { value: "voicemail", label: "Voicemail", icon: Voicemail, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "text_message", label: "Text Message", icon: MessageSquare, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "no_answer", label: "No Answer", icon: PhoneOff, color: "text-slate-500 bg-slate-50 border-slate-200" },
] as const;

type ContactTypeValue = typeof CONTACT_TYPES[number]["value"];

function getContactType(value: string) {
  return CONTACT_TYPES.find((t) => t.value === value) ?? CONTACT_TYPES[3];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function CallsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAgencyUser();
  const { data: agencyUsers = [] } = useListAgencyUsers();

  const [selectedAgent, setSelectedAgent] = useState<string>("__all");

  const params: Record<string, string> = {};
  if (isAdmin && selectedAgent !== "__all") params["agentUserId"] = selectedAgent;

  const { data: logs = [], isLoading } = useListCallLogs(params);
  const createLog = useCreateCallLog();
  const deleteLog = useDeleteCallLog();

  const [clientName, setClientName] = useState("");
  const [contactType, setContactType] = useState<ContactTypeValue>("contacted");
  const [callDate, setCallDate] = useState(today());
  const [notes, setNotes] = useState("");

  const handleAdd = () => {
    if (!clientName.trim()) return;
    createLog.mutate(
      { data: { clientName: clientName.trim(), contactType, callDate, notes: notes.trim() || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Call logged" });
          qc.invalidateQueries({ queryKey: getListCallLogsQueryKey() });
          setClientName("");
          setNotes("");
          setCallDate(today());
          setContactType("contacted");
        },
        onError: () => toast({ title: "Failed to log call", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (id: number) => {
    deleteLog.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Call log deleted" });
          qc.invalidateQueries({ queryKey: getListCallLogsQueryKey() });
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      },
    );
  };

  const typedLogs = logs as any[];

  // Summary stats for the current data set
  const totalCalls = typedLogs.length;
  const contacted = typedLogs.filter((l) => l.contactType === "contacted").length;
  const voicemails = typedLogs.filter((l) => l.contactType === "voicemail").length;
  const textMessages = typedLogs.filter((l) => l.contactType === "text_message").length;
  const noAnswer = typedLogs.filter((l) => l.contactType === "no_answer").length;
  const contactRate = totalCalls > 0 ? Math.round((contacted / totalCalls) * 100) : 0;

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Call Log</h1>
            <p className="text-sm text-muted-foreground">Track daily call activity — included in the weekly report</p>
          </div>
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Total Calls", value: totalCalls, color: "text-foreground" },
            { label: "Contacted", value: contacted, color: "text-green-600" },
            { label: "Voicemail", value: voicemails, color: "text-amber-600" },
            { label: "Text Message", value: textMessages, color: "text-blue-600" },
            { label: "No Answer", value: noAnswer, color: "text-slate-500" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 leading-tight">{label}</p>
                <p className={cn("text-xl sm:text-2xl font-bold leading-tight", color)}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contact rate bar */}
        {totalCalls > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Contact rate</span>
              <span className="font-medium text-foreground">{contactRate}% ({contacted} of {totalCalls} reached)</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${contactRate}%` }}
              />
            </div>
          </div>
        )}

        {/* Log a Call Form */}
        <Card>
          <CardContent className="pt-5 pb-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Log a Call</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Client Name *</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="First and last name"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                />
              </div>
              <div className="space-y-1">
                <Label>Contact Type *</Label>
                <Select value={contactType} onValueChange={(v) => setContactType(v as ContactTypeValue)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Call Date *</Label>
                <Input
                  type="date"
                  value={callDate}
                  onChange={(e) => setCallDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Brief note about the call"
                />
              </div>
            </div>
            <Button
              className="mt-4 w-full sm:w-auto"
              onClick={handleAdd}
              disabled={!clientName.trim() || createLog.isPending}
            >
              <Phone className="w-4 h-4 mr-1.5" />
              Log Call
            </Button>
          </CardContent>
        </Card>

        {/* Call Log Table */}
        {isLoading ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">Loading…</CardContent></Card>
        ) : typedLogs.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No calls logged yet. Use the form above to add one.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-left font-medium">Client</th>
                      <th className="px-4 py-3 text-left font-medium">Contact Type</th>
                      {isAdmin && <th className="px-4 py-3 text-left font-medium">Agent</th>}
                      <th className="px-4 py-3 text-left font-medium">Notes</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {typedLogs.map((log) => {
                      const ct = getContactType(log.contactType);
                      const Icon = ct.icon;
                      return (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{log.callDate}</td>
                          <td className="px-4 py-3 font-medium">{log.clientName}</td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border", ct.color)}>
                              <Icon className="w-3 h-3" />
                              {ct.label}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-muted-foreground">{log.agentName ?? "—"}</td>
                          )}
                          <td className="px-4 py-3 text-muted-foreground max-w-[220px] truncate">{log.notes || "—"}</td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(log.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
