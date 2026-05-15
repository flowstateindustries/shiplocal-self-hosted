"use client";

import { useState } from "react";
import { Sidebar, MobileHeader } from "@/components/dashboard";

interface DashboardLayoutClientProps {
  children: React.ReactNode;
}

export function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <MobileHeader onMenuClick={() => setSidebarOpen(true)} />

      {sidebarOpen && (
        <div className="sidebar:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 animate-slide-in">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="hidden sidebar:block fixed left-3 top-3 bottom-3 z-30">
        <Sidebar />
      </div>

      <main className="flex h-screen pt-[4.5rem] sidebar:pt-0 sidebar:pl-[17.5rem]">
        <div className="flex-1 p-3 sidebar:pl-0 overflow-hidden">
          <div className="relative z-10 bg-[var(--color-surface-secondary)] rounded-2xl h-full overflow-y-auto hide-scrollbar border border-[var(--color-border)] shadow-[0_0_20px_rgba(59,130,246,0.08),0_0_40px_rgba(139,92,246,0.05)] dark:shadow-[0_0_20px_rgba(59,130,246,0.15),0_0_40px_rgba(139,92,246,0.1)]">
            <div className="px-6 pb-6 pt-5 lg:px-8 lg:pb-8 lg:pt-6">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
