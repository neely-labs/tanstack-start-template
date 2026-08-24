import { siteConfig } from "@/lib/site-config.ts";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>{siteConfig.name}</p>
        <p>TanStack Start, Nitro, Tailwind CSS, and shadcn/ui.</p>
      </div>
    </footer>
  );
}
