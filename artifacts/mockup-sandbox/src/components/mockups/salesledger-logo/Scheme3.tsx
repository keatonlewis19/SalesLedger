const SCHEME = {
  name: "Color Scheme 3 — Steel Blue",
  charcoal: "#333333",
  primary: "#006A97",
  accent: "#009C57",
  highlight: "#B6D5E5",
};

function LogoIcon({ primary, accent, highlight, size = 72 }: { primary: string; accent: string; highlight: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="72" height="72" rx="16" fill={primary} />
      <rect x="16" y="22" width="40" height="3.5" rx="1.75" fill="white" opacity="0.25" />
      <rect x="16" y="31" width="40" height="3.5" rx="1.75" fill="white" opacity="0.18" />
      <rect x="16" y="40" width="28" height="3.5" rx="1.75" fill="white" opacity="0.18" />
      <polyline
        points="14,52 26,40 36,44 48,26 58,18"
        stroke={highlight}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="58" cy="18" r="4" fill={accent} />
    </svg>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-14 h-14 rounded-xl shadow-sm border border-white/10"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs font-mono text-gray-500">{color}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

export function Scheme3() {
  const { primary, accent, highlight, charcoal } = SCHEME;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-10 p-8">
      <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest">{SCHEME.name}</p>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-5">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Light Mode</p>
        <LogoIcon primary={primary} accent={accent} highlight={highlight} size={80} />
        <div className="flex items-baseline gap-0.5">
          <span className="text-4xl font-black tracking-tight" style={{ color: charcoal }}>Sales</span>
          <span className="text-4xl font-black tracking-tight" style={{ color: primary }}>Ledger</span>
        </div>
        <p className="text-sm text-gray-400 tracking-wide">Insurance Sales Platform</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl shadow-md p-8 flex flex-col items-center gap-5" style={{ backgroundColor: charcoal }}>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Dark Mode</p>
        <LogoIcon primary={primary} accent={accent} highlight={highlight} size={80} />
        <div className="flex items-baseline gap-0.5">
          <span className="text-4xl font-black tracking-tight text-white">Sales</span>
          <span className="text-4xl font-black tracking-tight" style={{ color: accent }}>Ledger</span>
        </div>
        <p className="text-sm tracking-wide" style={{ color: highlight }}>Insurance Sales Platform</p>
      </div>

      <div className="flex gap-6">
        <Swatch color={charcoal} label="Charcoal" />
        <Swatch color={primary} label="Steel Blue" />
        <Swatch color={accent} label="Vivid Green" />
        <Swatch color={highlight} label="Pale Blue" />
      </div>
    </div>
  );
}
