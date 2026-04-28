import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

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
  const [viewMode, setViewMode] = useState<ViewMode>("admin");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "agent") setViewMode("agent");
    });
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next: ViewMode = prev === "admin" ? "agent" : "admin";
      AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
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
