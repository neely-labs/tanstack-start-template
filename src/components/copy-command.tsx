import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button.tsx";

const resetDelayMs = 2000;

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timeout = copied
      ? window.setTimeout(() => {
          setCopied(false);
        }, resetDelayMs)
      : undefined;
    return () => {
      window.clearTimeout(timeout);
    };
  }, [copied]);

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted py-1.5 pr-1.5 pl-4">
      <code className="font-mono text-sm font-medium">
        <span aria-hidden="true" className="mr-2 text-muted-foreground">
          $
        </span>
        {command}
      </code>
      <Button
        aria-label={copied ? "Copied" : `Copy ${command}`}
        onClick={() => {
          void copy();
        }}
        size="icon-sm"
        variant="ghost"
      >
        {copied ? (
          <IconCheck aria-hidden="true" className="text-brand" />
        ) : (
          <IconCopy aria-hidden="true" />
        )}
      </Button>
      <output className="sr-only">{copied ? "Copied to clipboard" : ""}</output>
    </div>
  );
}
