import Header from "@/components/layouts/header";

interface PageShellProps {
  children: React.ReactNode;
}

export default function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[#f7f3ff]">
      <div className="mx-auto max-w-7xl px-4 py-4 lg:py-5">
        <Header />
      </div>
      {children}
    </div>
  );
}
