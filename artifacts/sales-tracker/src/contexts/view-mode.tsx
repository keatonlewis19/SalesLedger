import { createContext, useContext, useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "crm_view_mode";

type ViewMode = "admin" | "agent";

interface ViewModeContextValue {
  viewMode: ViewMode;
  toggleViewMode: () => void;
  isViewingAsAgent: boolean;
}

const ViewModeContext = createContext<ViewModeContextValue>({
  viewMode: "admin",
  toggleViewMode: () => {},
  isViewingAsAgent: false,
});

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "agent" ? "agent" : "admin";
    } catch {
      return "admin";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, viewMode);
    } catch {}
  }, [viewMode]);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === "admin" ? "agent" : "admin"));
  }, []);

  return (
    <ViewModeContext.Provider
      value={{ viewMode, toggleViewMode, isViewingAsAgent: viewMode === "agent" }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
