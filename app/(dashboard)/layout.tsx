export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between">
          <span className="text-base font-semibold">InvoxAI · Dashboard</span>
          <span className="text-xs text-muted-foreground">app.invoxai.io</span>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
