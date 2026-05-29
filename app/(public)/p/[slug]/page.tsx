import { notFound } from "next/navigation";

export default function PublicPage({
  params,
}: {
  params: { slug: string };
}) {
  if (!params.slug) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        invoxai.io / p
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {params.slug}
      </h1>
      <p className="mt-4 text-muted-foreground">
        Page placeholder — this is where a seller&apos;s published landing or
        checkout page will render.
      </p>
    </main>
  );
}
