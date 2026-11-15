import { IconArrowLeft } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button.tsx";
import { recoveryTitles } from "@/lib/seo.ts";

export function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-start justify-center px-5 py-20 sm:px-8 sm:py-28">
      {/* React moves this tag into the document head. */}
      <meta content="noindex" name="robots" />
      <p className="font-mono text-sm font-medium text-brand">404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
        {recoveryTitles.notFound}
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
        This page does not exist. Check the address, or head back to the home
        page.
      </p>
      <Link
        className={buttonVariants({ className: "mt-8", size: "lg" })}
        to="/"
      >
        <IconArrowLeft aria-hidden="true" data-icon="inline-start" />
        Return home
      </Link>
    </div>
  );
}
