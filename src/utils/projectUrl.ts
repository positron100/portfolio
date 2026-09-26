/** Portfolio's current mode, read from the same attribute the theme system owns. */
export function portfolioMode(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/**
 * Deployed-app URL carrying the portfolio's mode via the `cp-mode` contract
 * (each app reads it before first paint). URL API, so the app's own query
 * parameters and hash are preserved.
 */
export function withMode(url: string, mode: "light" | "dark" = portfolioMode()): string {
  const u = new URL(url);
  u.searchParams.set("cp-mode", mode);
  return u.toString();
}

const warmed = new Set<string>();

/** Open a connection to the app's origin ahead of the iframe/navigation. Once per origin. */
export function warmOrigin(url: string) {
  const origin = new URL(url).origin;
  if (warmed.has(origin)) return;
  warmed.add(origin);
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = origin;
  document.head.appendChild(link);
}
