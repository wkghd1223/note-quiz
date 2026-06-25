import Header, { type HeaderVariant } from "@/components/layouts/header";

interface AppPageShellProps {
  children: React.ReactNode;
  headerVariant?: HeaderVariant;
  className?: string;
  contentClassName?: string;
}

export default function AppPageShell({
  children,
  headerVariant = "app",
  className = "",
  contentClassName = "",
}: AppPageShellProps) {
  return (
    <div className={`min-h-screen bg-[#f7f3ff] ${className}`}>
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:py-5">
        <Header variant={headerVariant} />
      </div>
      <main
        className={`mx-auto max-w-7xl px-3 pb-6 sm:px-4 ${contentClassName}`}
      >
        {children}
      </main>
    </div>
  );
}
