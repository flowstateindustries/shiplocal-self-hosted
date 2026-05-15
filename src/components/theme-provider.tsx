"use client";

import { createContext, useContext, useCallback, useSyncExternalStore } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme store for useSyncExternalStore
let listeners: Array<() => void> = [];
let currentTheme: Theme = "dark";

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function getSnapshot(): Theme {
  return currentTheme;
}

function getServerSnapshot(): Theme {
  return "dark"; // Default for SSR
}

function setThemeValue(newTheme: Theme) {
  currentTheme = newTheme;
  localStorage.setItem("shiplocal-theme", newTheme);
  if (newTheme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  listeners.forEach(listener => listener());
}

// Initialize theme on client
if (typeof window !== "undefined") {
  const stored = localStorage.getItem("shiplocal-theme") as Theme | null;
  if (stored === "light") {
    currentTheme = "light";
    document.documentElement.classList.remove("dark");
  } else {
    currentTheme = "dark";
    document.documentElement.classList.add("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeValue(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeValue(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Export a global function for compatibility with Flask's ShipLocalTheme.toggle()
if (typeof window !== "undefined") {
  (window as unknown as { ShipLocalTheme: { toggle: () => void } }).ShipLocalTheme = {
    toggle: () => {
      const current = localStorage.getItem("shiplocal-theme");
      const newTheme = current === "dark" ? "light" : "dark";
      localStorage.setItem("shiplocal-theme", newTheme);
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      // Dispatch event for React components to sync
      window.dispatchEvent(new CustomEvent("theme-change", { detail: newTheme }));
    },
  };
}
