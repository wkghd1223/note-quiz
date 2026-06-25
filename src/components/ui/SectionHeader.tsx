interface SectionHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export default function SectionHeader({
  eyebrow,
  title,
  description,
  className = "",
  compact = false,
}: SectionHeaderProps) {
  return (
    <div className={className}>
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6d28d9] sm:text-sm">
          {eyebrow}
        </p>
      )}
      <h1
        className={`font-black tracking-[-0.04em] text-slate-950 ${
          compact ? "mt-1 text-2xl sm:text-3xl" : "mt-2 text-3xl sm:text-5xl"
        }`}
      >
        {title}
      </h1>
      {description && (
        <p
          className={`max-w-2xl leading-7 text-slate-600 ${
            compact ? "mt-2 text-sm" : "mt-3 text-base"
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
