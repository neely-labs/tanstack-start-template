const storageKey = "theme";

/**
 * Runs before the first paint so a stored or system dark preference never
 * flashes the light theme. Prerendered HTML cannot know the visitor's choice.
 */
export const themeScript = `(() => {
  try {
    const stored = localStorage.getItem("${storageKey}");
    const dark = stored === null
      ? matchMedia("(prefers-color-scheme: dark)").matches
      : stored === "dark";
    document.documentElement.classList.toggle("dark", dark);
  } catch {}
})()`;

export function isDarkTheme() {
  return document.documentElement.classList.contains("dark");
}

export function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributeFilter: ["class"],
    attributes: true,
  });
  return () => {
    observer.disconnect();
  };
}

export function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem(storageKey, dark ? "dark" : "light");
  } catch {
    // Storage can be unavailable in private modes; the toggle still applies.
  }
}
