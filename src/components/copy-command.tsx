import { IconCheck, IconCopy, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button.tsx";

const resetDelayMs = 2000;

const announcements = {
  copied: "Copied to clipboard",
  failed: "Could not copy. Select the command to copy it manually.",
  idle: "",
} as const;

export function CopyCommand({ command }: { command: string }) {
  const [status, setStatus] = useState<keyof typeof announcements>("idle");

  useEffect(() => {
    const timeout =
      status === "idle"
        ? undefined
        : window.setTimeout(() => {
            setStatus("idle");
          }, resetDelayMs);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [status]);

  async function copy() {
    try {
      // Clipboard access is missing on insecure origins and can be denied.
      await navigator.clipboard.writeText(command);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted py-1.5 pr-1.5 pl-4">
      <code className="font-mono text-sm font-medium">
        <span aria-hidden="true" className="mr-2 text-muted-foreground">
          $
        </span>
        <span className="select-all">{command}</span>
      </code>
      <Button
        aria-label={`Copy ${command}`}
        onClick={() => {
          void copy();
        }}
        size="icon-sm"
        variant="ghost"
      >
        {status === "copied" ? (
          <IconCheck aria-hidden="true" className="text-brand" />
        ) : null}
        {status === "failed" ? (
          <IconX aria-hidden="true" className="text-destructive" />
        ) : null}
        {status === "idle" ? <IconCopy aria-hidden="true" /> : null}
      </Button>
      <output className="sr-only">{announcements[status]}</output>
    </div>
  );
}
