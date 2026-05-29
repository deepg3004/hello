export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-zinc-950 text-zinc-50">
        <div className="container flex h-14 items-center justify-between">
          <span className="text-base font-semibold">InvoxAI · Admin</span>
          <span className="text-xs text-zinc-400">admin.invoxai.io</span>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
