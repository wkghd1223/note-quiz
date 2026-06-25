interface CompactStatusItem {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
}

interface CompactStatusBarProps {
  items: CompactStatusItem[];
  className?: string;
}

const toneClasses = {
  default: "text-slate-950",
  accent: "text-[#5b21b6]",
  success: "text-[#166534]",
  warning: "text-[#92400e]",
  danger: "text-red-600",
};

export default function CompactStatusBar({
  items,
  className = "",
}: CompactStatusBarProps) {
  return (
    <div
      className={`grid grid-cols-2 gap-2 rounded-2xl border border-[#ede9fe] bg-[#faf9fe] p-2 sm:[grid-template-columns:repeat(var(--status-columns),minmax(0,1fr))] ${className}`}
      style={
        {
          "--status-columns": Math.min(Math.max(items.length, 1), 4),
        } as React.CSSProperties
      }
    >
      {items.map((item, index) => (
        <div key={index} className="min-w-0 rounded-xl bg-white px-3 py-2">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {item.label}
          </p>
          <p
            className={`mt-0.5 truncate font-mono text-base font-black leading-none sm:text-lg ${
              toneClasses[item.tone ?? "default"]
            }`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
