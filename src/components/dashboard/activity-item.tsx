"use client";

interface ActivityItemProps {
  type: "push" | "complete" | "create";
  appName: string;
  description: string;
  time: string;
}

export function ActivityItem({ type, appName, description, time }: ActivityItemProps) {
  const icons = {
    push: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    complete: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
    create: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  };

  const colors = {
    push: "text-green-500 bg-green-500/10",
    complete: "text-blue-500 bg-blue-500/10",
    create: "text-purple-500 bg-purple-500/10",
  };

  return (
    <div className="group flex items-center gap-4 py-4 px-2 -mx-2 rounded-xl transition-colors hover:bg-[var(--color-surface-hover)]/50">
      <div
        className={`p-2 rounded-lg ${colors[type]} transition-transform duration-200 group-hover:scale-105`}
      >
        {icons[type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-content)] truncate">{appName}</p>
        <p className="text-xs text-[var(--color-content-muted)] truncate">{description}</p>
      </div>
      <span className="text-xs text-[var(--color-content-muted)] whitespace-nowrap bg-[var(--color-surface-secondary)] rounded-md px-2 py-1">
        {time}
      </span>
    </div>
  );
}
