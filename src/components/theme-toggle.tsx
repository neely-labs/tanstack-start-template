import { IconMoon, IconSun } from "@tabler/icons-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button.tsx";
import { isDarkTheme, subscribeToTheme, toggleTheme } from "@/lib/theme.ts";

/** The server cannot know the theme, so the pressed state waits for hydration. */
function getServerTheme() {
  return null;
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribeToTheme,
    isDarkTheme,
    getServerTheme
  );

  return (
    <Button
      aria-label="Dark theme"
      aria-pressed={dark ?? undefined}
      onClick={toggleTheme}
      size="icon"
      variant="ghost"
    >
      {/* Both icons render so the correct one shows before hydration. */}
      <IconMoon aria-hidden="true" className="dark:hidden" />
      <IconSun aria-hidden="true" className="hidden dark:block" />
    </Button>
  );
}
