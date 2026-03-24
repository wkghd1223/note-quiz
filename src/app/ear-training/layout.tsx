import Header from "@/components/layouts/header";

export default function EarTrainingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#f4f2f8]">
      <div className="relative z-50 border-b border-[#ded6f7] bg-white/70">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:py-5">
          <Header />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-8 pt-6">{children}</div>
    </div>
  );
}
