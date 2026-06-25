interface PanelProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "compact" | "default" | "loose";
}

const paddingClasses = {
  none: "",
  compact: "p-3 sm:p-4",
  default: "p-4 sm:p-6",
  loose: "p-5 sm:p-8",
};

export default function Panel({
  children,
  className = "",
  padding = "default",
}: PanelProps) {
  return (
    <section
      className={`rounded-[1.5rem] border border-[#ded6f7] bg-white shadow-[0_14px_40px_rgba(76,29,149,0.08)] ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </section>
  );
}
