export interface LiveProject {
  name: string;
  /** Shown in the preview chrome when the app has a published subtitle. */
  tagline?: string;
  url: string;
  /**
   * The app's own page ground per mode (from its pre-paint CSS / theme tokens).
   * Full View fills the screen with this before navigating, so the hand-off
   * doesn't blink between colours. Omitted -> the portfolio's background.
   */
  ground?: { light: string; dark: string };
  /** Not one of the apps: navigate to `url` as-is, without the `cp-mode` contract param. */
  bare?: boolean;
  /** Set to false for a deployment whose headers forbid framing. */
  embeddable?: boolean;
}

/**
 * Deployed apps, keyed by the id the same project already has in
 * `projects.ts` (Projects section) or `experience.ts` (DevTown builds), so
 * both sections share one source and neither duplicates a URL.
 */
export const liveProjects: Record<string, LiveProject> = {
  "ayurvedic-remedy-suggestor": { name: "Sattva", tagline: "Ayurvedic Remedy Guidance", ground: { light: "#f7f5f0", dark: "#141613" }, url: "https://ayurvedic-remedy-suggestor.vercel.app/" },
  textutils: { name: "TextUtils", ground: { light: "#f4f1ec", dark: "#171310" }, url: "https://text-utils-enhanced.vercel.app/" },
  cloudeditor: { name: "Compile Palace", ground: { light: "#ffffff", dark: "#020817" }, url: "https://compile-palace.vercel.app/" },
  clock: { name: "Clock", url: "https://positron100.github.io/clock/" },
  cloudbook: { name: "CloudBook", ground: { light: "#f4f1ea", dark: "#121317" }, url: "https://cloud-book-frontend-xi.vercel.app/" },
};
