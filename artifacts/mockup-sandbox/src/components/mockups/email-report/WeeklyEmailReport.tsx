const brandColor = "#1a3c5e";
const agencyName = "CRM Group Insurance";

function fmt(val: number | null): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

const medicareSales = [
  { clientName: "Laura Brubaker", salesSource: "Humana", salesType: "MAPD", soldDate: "2026-04-22", commissionType: "FYC", hra: 150, estimatedCommission: 540, comments: "", agentName: "Keaton Smith", paid: true },
  { clientName: "Ken Rhoades", salesSource: "Anthem", salesType: "PDP", soldDate: "2026-04-21", commissionType: "FYC", hra: null, estimatedCommission: 120, comments: "Switching from AARP", agentName: "Keaton Smith", paid: false },
  { clientName: "Mr. Torres", salesSource: "UHC", salesType: "MAPD", soldDate: "2026-04-20", commissionType: "FYC", hra: 200, estimatedCommission: 580, comments: "", agentName: "Chad Reynolds", paid: true },
  { clientName: "Earle Keenan Jr", salesSource: "Humana", salesType: "Supplement", soldDate: "2026-04-19", commissionType: "FYC", hra: null, estimatedCommission: 800, comments: "Plan G", agentName: "Chad Reynolds", paid: false },
  { clientName: "Willie English Jr", salesSource: "Saint Alphonsus HP", salesType: "MAPD", soldDate: "2026-04-18", commissionType: "FYC", hra: 100, estimatedCommission: 480, comments: "", agentName: "Chad Reynolds", paid: true },
];

const otherLobSales: Record<string, { lob: string; color: string; sales: { clientName: string; carrier: string | null; revenue: number | null; soldDate: string; ancillaryType?: string | null; notes: string | null; agentName?: string | null }[] }> = {
  aca: {
    lob: "ACA / Individual Health",
    color: "#2563eb",
    sales: [
      { clientName: "Gus Fitzpatrick", carrier: "BlueCross", revenue: 420, soldDate: "2026-04-21", notes: "Silver plan", agentName: "Keaton Smith" },
    ],
  },
  ancillary: {
    lob: "Ancillary",
    color: "#7c3aed",
    sales: [
      { clientName: "Lynne Austin", carrier: "Aflac", revenue: 210, soldDate: "2026-04-20", ancillaryType: "Dental", notes: "", agentName: "Chad Reynolds" },
      { clientName: "Laura Brubaker", carrier: "Aflac", revenue: 95, soldDate: "2026-04-22", ancillaryType: "Vision", notes: "", agentName: "Keaton Smith" },
    ],
  },
};

function AgentSection({ agentName, sales }: { agentName: string; sales: typeof medicareSales }) {
  const paid = sales.filter((s) => s.paid);
  const unpaid = sales.filter((s) => !s.paid);
  const total = sales.reduce((a, s) => a + (s.estimatedCommission ?? 0), 0);
  const paidComm = paid.reduce((a, s) => a + (s.estimatedCommission ?? 0), 0);
  const owed = unpaid.reduce((a, s) => a + (s.estimatedCommission ?? 0), 0);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ background: `${brandColor}18`, borderLeft: `4px solid ${brandColor}`, padding: "10px 14px", borderRadius: "0 6px 6px 0", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#1a3c5e" }}>{agentName}</span>
        <span style={{ marginLeft: 12, fontSize: 13, color: "#6b7280" }}>{sales.length} sale{sales.length !== 1 ? "s" : ""}</span>
        <span style={{ float: "right", fontSize: 13 }}>
          <span style={{ color: "#166534", fontWeight: 600 }}>Paid: {fmt(paidComm)}</span>
          &nbsp;&nbsp;
          <span style={{ color: "#92400e", fontWeight: 600 }}>Owed: {fmt(owed)}</span>
          &nbsp;&nbsp;
          <span style={{ color: "#374151" }}>Total: {fmt(total)}</span>
        </span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f3f4f6" }}>
            {["Client", "Source", "Type", "Sold Date", "Commission Type", "HRA", "Est. Commission", "Status"].map((h) => (
              <th key={h} style={{ padding: "7px 10px", textAlign: h === "Est. Commission" || h === "HRA" ? "right" : h === "Status" ? "center" : "left", fontWeight: 600, color: "#374151" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sales.map((s, i) => (
            <tr key={i} style={{ background: s.paid ? "#f0fdf4" : "#fffbeb" }}>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee" }}>{s.clientName}</td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee" }}>{s.salesSource ?? ""}</td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee" }}>{s.salesType}</td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee" }}>{s.soldDate}</td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee" }}>{s.commissionType}</td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", textAlign: "right" }}>{s.hra != null ? fmt(s.hra) : "None"}</td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", textAlign: "right" }}>{fmt(s.estimatedCommission)}</td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", textAlign: "center" }}>
                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: s.paid ? "#dcfce7" : "#fef3c7", color: s.paid ? "#166534" : "#92400e" }}>
                  {s.paid ? "Paid" : "Unpaid"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LobSection({ lob, color, sales }: { lob: string; color: string; sales: (typeof otherLobSales)["aca"]["sales"] }) {
  const isAncillary = lob === "Ancillary";
  const total = sales.reduce((a, s) => a + (s.revenue ?? 0), 0);
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ background: `${color}18`, borderLeft: `4px solid ${color}`, padding: "10px 14px", borderRadius: "0 6px 6px 0", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#1a3c5e" }}>{lob}</span>
        <span style={{ marginLeft: 12, fontSize: 13, color: "#6b7280" }}>{sales.length} sale{sales.length !== 1 ? "s" : ""}</span>
        <span style={{ float: "right", fontSize: 13, fontWeight: 600, color: "#059669" }}>Total: {fmt(total)}</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f3f4f6" }}>
            <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Client</th>
            {isAncillary && <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Type</th>}
            <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Carrier</th>
            <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Date</th>
            <th style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600, color: "#374151" }}>Revenue</th>
            <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s, i) => (
            <tr key={i}>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee" }}>{s.clientName}</td>
              {isAncillary && <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee" }}>{s.ancillaryType ?? "—"}</td>}
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee" }}>{s.carrier ?? "—"}</td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee" }}>{s.soldDate}</td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", textAlign: "right" }}>{fmt(s.revenue)}</td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", color: "#6b7280" }}>{s.notes ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WeeklyEmailReport() {
  const weekStart = "Apr 18, 2026";
  const weekEnd = "Apr 24, 2026";

  const totalComm = medicareSales.reduce((a, s) => a + (s.estimatedCommission ?? 0), 0);
  const totalOwed = medicareSales.filter((s) => !s.paid).reduce((a, s) => a + (s.estimatedCommission ?? 0), 0);

  const agentGroups = new Map<string, typeof medicareSales>();
  for (const s of medicareSales) {
    const key = s.agentName ?? "Unassigned";
    if (!agentGroups.has(key)) agentGroups.set(key, []);
    agentGroups.get(key)!.push(s);
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", color: "#333", margin: 0, padding: "32px 16px", background: "#f4f4f4", minHeight: "100vh" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", border: "1px solid #ddd", borderRadius: 8, overflow: "hidden", background: "#fff" }}>

        {/* Header */}
        <div style={{ background: brandColor, padding: "24px 28px" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{agencyName}</div>
          <h2 style={{ color: "#fff", margin: 0, fontSize: 20 }}>Weekly Sales Report</h2>
          <p style={{ color: "rgba(255,255,255,0.75)", margin: "4px 0 0 0", fontSize: 14 }}>
            Week of <strong>{weekStart}</strong> through <strong>{weekEnd}</strong>
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px" }}>

          {/* Summary row */}
          <p style={{ marginBottom: 16 }}>
            <strong>Total Medicare Sales:</strong> {medicareSales.length} &nbsp;&nbsp;
            <strong>Est. Total Commission:</strong> {fmt(totalComm)} &nbsp;&nbsp;
            <strong>Total Owed:</strong> <span style={{ color: "#92400e" }}>{fmt(totalOwed)}</span>
          </p>

          {/* Unpaid alert */}
          {totalOwed > 0 ? (
            <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "12px 16px", marginBottom: 20 }}>
              <strong style={{ color: "#92400e" }}>⚠ Unpaid Commissions: {fmt(totalOwed)}</strong>
              <span style={{ color: "#92400e", fontSize: 13 }}> — {medicareSales.filter(s => !s.paid).length} records still pending payment</span>
            </div>
          ) : (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "12px 16px", marginBottom: 20 }}>
              <strong style={{ color: "#166534" }}>✓ All commissions paid</strong>
            </div>
          )}

          {/* Medicare section */}
          <div style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a3c5e", margin: "0 0 12px 0" }}>Medicare</h3>
            {[...agentGroups.entries()].map(([agent, sales]) => (
              <AgentSection key={agent} agentName={agent} sales={sales} />
            ))}
          </div>

          {/* Other LOBs */}
          <div style={{ marginTop: 28, borderTop: "2px solid #e5e7eb", paddingTop: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a3c5e", margin: "0 0 18px 0" }}>Other Lines of Business</h3>
            {Object.values(otherLobSales).map((entry) => (
              <LobSection key={entry.lob} lob={entry.lob} color={entry.color} sales={entry.sales} />
            ))}
          </div>

          <p style={{ color: "#999", fontSize: 12, marginTop: 24 }}>
            This report was automatically generated and sent by {agencyName}.
          </p>
        </div>
      </div>
    </div>
  );
}
