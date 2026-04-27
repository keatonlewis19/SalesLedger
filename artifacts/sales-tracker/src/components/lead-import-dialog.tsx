import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useImportLeads, getListLeadsQueryKey, getGetMetricsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LEAD_FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "leadSource", label: "Lead Source" },
  { key: "status", label: "Status" },
  { key: "enteredDate", label: "Date Received" },
  { key: "soldDate", label: "Date Sold" },
  { key: "salesType", label: "Sales Type" },
  { key: "commissionType", label: "Plan Type" },
  { key: "carrier", label: "Carrier" },
  { key: "revenue", label: "Est. Commission ($)" },
  { key: "costPerLead", label: "Lead Cost ($)" },
  { key: "notes", label: "Notes" },
] as const;

type FieldKey = typeof LEAD_FIELDS[number]["key"];

const STATUS_MAP: Record<string, string> = {
  "sold": "sold", "sale": "sold",
  "in communication": "in_comm", "in comm": "in_comm", "in_comm": "in_comm",
  "appointment set": "appt_set", "appt set": "appt_set", "appt_set": "appt_set",
  "follow up": "follow_up", "future follow-up": "follow_up", "future follow up": "follow_up",
  "follow_up": "follow_up",
  "lost": "lost",
  "new": "new",
};

function normalizeStatus(raw: string): string {
  return STATUS_MAP[raw.toLowerCase().trim()] ?? "new";
}

function parseDate(raw: string): string {
  if (!raw?.trim()) return "";
  raw = raw.trim();
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // M/D/YYYY or MM/DD/YYYY
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return raw;
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim()); current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseRow(lines[0]).map((h) => h.replace(/^["']|["']$/g, "").trim());
  const rows = lines.slice(1).map((line) => {
    const vals = parseRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
  return { headers, rows };
}

// Auto-guess mapping from CSV column name to lead field
function autoMap(headers: string[]): Record<string, string> {
  const ALIASES: Record<string, string> = {
    "first name": "firstName", "firstname": "firstName", "first": "firstName",
    "last name": "lastName", "lastname": "lastName", "last": "lastName",
    "phone": "phone", "cell": "phone", "mobile": "phone",
    "email": "email", "email address": "email",
    "lead source": "leadSource", "source": "leadSource", "leadsource": "leadSource",
    "status": "status",
    "date received": "enteredDate", "entered date": "enteredDate", "received date": "enteredDate",
    "date entered": "enteredDate", "entereddate": "enteredDate",
    "date sold": "soldDate", "sold date": "soldDate", "solddate": "soldDate",
    "sales type": "salesType", "salestype": "salesType", "type": "salesType",
    "plan type": "commissionType", "plantype": "commissionType", "commission type": "commissionType",
    "carrier": "carrier", "carrier sold": "carrier",
    "estimated commission": "revenue", "commission": "revenue", "revenue": "revenue",
    "est. commission": "revenue", "est commission": "revenue",
    "lead cost": "costPerLead", "cost per lead": "costPerLead", "cpl": "costPerLead",
    "notes": "notes", "note": "notes",
  };
  const map: Record<string, string> = {};
  for (const h of headers) {
    const guess = ALIASES[h.toLowerCase().trim()];
    if (guess) map[h] = guess;
  }
  return map;
}

const TEMPLATE_CSV = `firstName,lastName,phone,email,leadSource,status,enteredDate,soldDate,salesType,commissionType,carrier,revenue,costPerLead,notes
Jane,Doe,,jane@example.com,QuoteWizard,in_comm,2026-04-01,,,MAPD,Humana,,,
John,Smith,555-1234,,*Referral,sold,2026-03-15,2026-03-20,New Sale,C-SNP,Humana,318.08,0,
`;

type Step = "upload" | "map" | "preview" | "done";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function LeadImportDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const importLeads = useImportLeads();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (!parsed.headers.length) {
        toast({ title: "Could not parse CSV — ensure it has a header row", variant: "destructive" });
        return;
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows.filter((r) => Object.values(r).some((v) => v)));
      setMapping(autoMap(parsed.headers));
      setStep("map");
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    const today = new Date().toISOString().slice(0, 10);
    const leads = rows.map((row) => {
      const get = (field: string) => {
        const col = Object.entries(mapping).find(([, f]) => f === field)?.[0];
        return col ? row[col] ?? "" : "";
      };
      const enteredRaw = parseDate(get("enteredDate"));
      const soldRaw = parseDate(get("soldDate"));
      return {
        firstName: get("firstName").trim(),
        lastName: get("lastName").trim() || undefined,
        phone: get("phone").trim() || undefined,
        email: get("email").trim() || undefined,
        leadSource: get("leadSource").trim() || undefined,
        status: normalizeStatus(get("status")) as any,
        enteredDate: /^\d{4}-\d{2}-\d{2}$/.test(enteredRaw) ? enteredRaw : today,
        soldDate: /^\d{4}-\d{2}-\d{2}$/.test(soldRaw) ? soldRaw : undefined,
        salesType: get("salesType").trim() || undefined,
        commissionType: get("commissionType").trim() || undefined,
        carrier: get("carrier").trim() || undefined,
        revenue: get("revenue") ? parseFloat(get("revenue").replace(/[^0-9.]/g, "")) || undefined : undefined,
        costPerLead: get("costPerLead") ? parseFloat(get("costPerLead").replace(/[^0-9.]/g, "")) || undefined : undefined,
        notes: get("notes").trim() || undefined,
      };
    }).filter((l) => l.firstName);

    if (leads.length === 0) {
      toast({ title: "No valid leads found — check your column mapping", variant: "destructive" });
      return;
    }

    importLeads.mutate(
      { data: { leads } },
      {
        onSuccess: (data) => {
          setResult(data as { imported: number; errors: string[] });
          setStep("done");
          qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
        },
        onError: () => toast({ title: "Import failed", variant: "destructive" }),
      },
    );
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leads_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const mappedFirstName = Object.entries(mapping).find(([, f]) => f === "firstName");
  const canProceed = step === "map" && !!mappedFirstName;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
        </DialogHeader>

        {/* STEP: Upload */}
        {step === "upload" && (
          <div className="space-y-6 py-2">
            <div className="rounded-lg border-2 border-dashed border-border p-8 text-center space-y-3">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">Choose a CSV file to upload</p>
                <p className="text-sm text-muted-foreground mt-1">Supports .csv files exported from Excel, Google Sheets, or any spreadsheet app</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
              <Button onClick={() => fileRef.current?.click()} variant="outline">
                <Upload className="w-4 h-4 mr-2" /> Browse File
              </Button>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
              <Download className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Need a template?</p>
                <p className="text-xs text-muted-foreground mb-2">Download our CSV template with all supported columns pre-labeled.</p>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Download Template
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Supported columns (any order):</p>
              <p className="text-muted-foreground/80">firstName (required), lastName, phone, email, leadSource, status, enteredDate (YYYY-MM-DD or M/D/YYYY), soldDate, salesType, commissionType (plan type), carrier, revenue (commission), costPerLead, notes</p>
              <p className="font-medium mt-2">Valid status values:</p>
              <p className="text-muted-foreground/80">new · in_comm (or "In Communication") · appt_set (or "Appointment Set") · follow_up (or "Future Follow-Up") · sold · lost</p>
            </div>
          </div>
        )}

        {/* STEP: Map columns */}
        {step === "map" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{rows.length} rows found · Map your CSV columns to lead fields</p>
              <Button variant="ghost" size="sm" onClick={reset}>Change file</Button>
            </div>
            <div className="grid gap-2 max-h-72 overflow-y-auto pr-1">
              {headers.map((h) => (
                <div key={h} className="grid grid-cols-2 gap-2 items-center">
                  <div className="text-sm font-medium truncate bg-muted/40 rounded px-2 py-1.5">{h}</div>
                  <div className="flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <Select
                      value={mapping[h] ?? "__skip"}
                      onValueChange={(v) => setMapping((prev) => {
                        const next = { ...prev };
                        if (v === "__skip") delete next[h];
                        else next[h] = v;
                        return next;
                      })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip">— Skip —</SelectItem>
                        {LEAD_FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}{(f as any).required ? " *" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            {!canProceed && (
              <p className="text-xs text-destructive">Please map at least the "First Name" column to proceed.</p>
            )}
            <Button onClick={() => setStep("preview")} disabled={!canProceed} className="w-full">
              Preview {rows.length} Leads <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* STEP: Preview */}
        {step === "preview" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Preview — first 5 of {rows.length} leads</p>
              <Button variant="ghost" size="sm" onClick={() => setStep("map")}>Back to mapping</Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {LEAD_FIELDS.filter((f) => Object.values(mapping).includes(f.key)).map((f) => (
                      <th key={f.key} className="text-left px-3 py-2 font-medium whitespace-nowrap">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/10">
                      {LEAD_FIELDS.filter((f) => Object.values(mapping).includes(f.key)).map((f) => {
                        const col = Object.entries(mapping).find(([, v]) => v === f.key)?.[0];
                        const val = col ? row[col] ?? "" : "";
                        return (
                          <td key={f.key} className={cn("px-3 py-2 whitespace-nowrap max-w-[140px] truncate", !val && "text-muted-foreground")}>{val || "—"}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 5 && (
              <p className="text-xs text-center text-muted-foreground">…and {rows.length - 5} more rows</p>
            )}
          </div>
        )}

        {/* STEP: Done */}
        {step === "done" && result && (
          <div className="space-y-4 py-4">
            {result.imported > 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <p className="font-semibold text-green-700 dark:text-green-400">{result.imported} lead{result.imported !== 1 ? "s" : ""} imported successfully</p>
                </div>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium text-sm">{result.errors.length} row{result.errors.length !== 1 ? "s" : ""} had errors</span>
                </div>
                <ul className="text-xs space-y-1 text-destructive/80 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport} disabled={importLeads.isPending}>
                {importLeads.isPending ? "Importing…" : `Import ${rows.length} Leads`}
              </Button>
            </>
          )}
          {step === "done" && (
            <>
              <Button variant="outline" onClick={reset}>Import Another File</Button>
              <Button onClick={() => { onOpenChange(false); reset(); }}>Done</Button>
            </>
          )}
          {(step === "upload" || step === "map") && (
            <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
