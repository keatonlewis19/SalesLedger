import { createContext, useContext, useEffect, useRef } from "react";
import { useGetSettings } from "@workspace/api-client-react";
import { useAgencyUser } from "@/hooks/useAgencyUser";
import { hexToHslString, isBrightColor } from "@/lib/hex-to-hsl";

interface BrandingContextValue {
  brandName: string;
  brandColor: string;
  panelColor: string;
  logoUrl: string | null;
  isLoaded: boolean;
}

const BrandingContext = createContext<BrandingContextValue>({
  brandName: "CRM Group Insurance",
  brandColor: "#0d9488",
  panelColor: "#0f172a",
  logoUrl: null,
  isLoaded: false,
});

export function applyBrandColor(hex: string) {
  const hsl = hexToHslString(hex);
  const bright = isBrightColor(hex);
  const root = document.documentElement;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--primary-foreground", bright ? "0 0% 10%" : "0 0% 100%");
  root.style.setProperty("--ring", hsl);
  root.style.setProperty("--sidebar-primary", hex);
}

export function applyPanelColor(hex: string) {
  document.documentElement.style.setProperty("--panel-bg", hex);
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAgencyUser();
  const { data: settings } = useGetSettings({ query: { enabled: !!isSignedIn } });
  const appliedColorRef = useRef<string | null>(null);
  const appliedPanelRef = useRef<string | null>(null);

  const brandColor = settings?.brandColor ?? "#0d9488";
  const panelColor = settings?.panelColor ?? "#0f172a";
  const brandName = settings?.brandName ?? "CRM Group Insurance";
  const logoPath = settings?.logoPath ?? null;
  const logoUrl = logoPath ? `/api/storage${logoPath}` : null;
  const isLoaded = !!settings;

  useEffect(() => {
    if (appliedColorRef.current === brandColor) return;
    appliedColorRef.current = brandColor;
    applyBrandColor(brandColor);
  }, [brandColor]);

  useEffect(() => {
    if (appliedPanelRef.current === panelColor) return;
    appliedPanelRef.current = panelColor;
    applyPanelColor(panelColor);
  }, [panelColor]);

  return (
    <BrandingContext.Provider value={{ brandName, brandColor, panelColor, logoUrl, isLoaded }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
