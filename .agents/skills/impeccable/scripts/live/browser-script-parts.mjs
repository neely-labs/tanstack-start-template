import fs from "node:fs";
import path from "node:path";

export const LIVE_BROWSER_SCRIPT_PARTS = Object.freeze([
  Object.freeze({ file: "live-browser-session.js", name: "session-state" }),
  Object.freeze({ file: "live-browser-dom.js", name: "dom-helpers" }),
  Object.freeze({ file: "live-browser.js", name: "browser-ui" }),
]);

export function resolveLiveBrowserScriptParts(
  scriptsDir,
  parts = LIVE_BROWSER_SCRIPT_PARTS
) {
  if (!scriptsDir) {
    throw new Error("scriptsDir is required");
  }
  return parts.map((part, index) => ({
    ...part,
    index,
    path: path.join(scriptsDir, part.file),
  }));
}

export function assertLiveBrowserScriptParts(parts, exists = fs.existsSync) {
  for (const part of parts) {
    if (!exists(part.path)) {
      throw new Error(
        `Live browser script part missing: ${part.name} (${part.path})`
      );
    }
  }
  return parts;
}

export function readLiveBrowserScriptParts(
  parts,
  readFile = (filePath) => fs.readFileSync(filePath, "utf-8")
) {
  return parts.map((part) => ({
    ...part,
    source: readFile(part.path),
  }));
}

export function assembleLiveBrowserScript({
  token,
  port,
  vocabulary,
  commandPrefix = "/",
  appRoot = null,
  parts,
}) {
  const prelude =
    `window.__IMPECCABLE_TOKEN__ = '${token}';\n` +
    `window.__IMPECCABLE_PORT__ = ${port};\n` +
    // Project identity for browser-side session storage. localStorage is
    // keyed by ORIGIN, and two projects routinely share a localhost port
    // across time; saved sessions carry this value so a resume can tell a
    // foreign project's leftovers from its own.
    `window.__IMPECCABLE_APP_ROOT__ = ${JSON.stringify(appRoot)};\n` +
    `window.__IMPECCABLE_COMMAND_PREFIX__ = ${JSON.stringify(commandPrefix)};\n` +
    // Canonical command vocabulary (values + labels + icons). live-browser.js
    // builds its action picker from this instead of an inline copy.
    `window.__IMPECCABLE_VOCAB__ = ${JSON.stringify(vocabulary)};\n`;

  const body = parts
    .map((part) => {
      const file = part.file || path.basename(part.path || "");
      return `// --- impeccable live script part: ${part.name} (${file}) ---\n${part.source}`;
    })
    .join("\n");

  return prelude + body;
}
