import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ProjectPreviewModal } from "@/components/ProjectPreviewModal";
import type { LiveProject } from "@/data/liveProjects";

/**
 * Source-code links leave through the same expanding full-screen surface as
 * "Full View": the link's own rect unfolds to the whole screen (in GitHub's page
 * colour) and then this tab navigates to the repository. Modified / non-primary
 * clicks are left alone, so open-in-new-tab and copy-link still behave natively,
 * and the `href` stays on the anchor for assistive tech and right-click.
 *
 * Attach `ref` and `onClick` to the anchor and render `modal` anywhere (it is
 * portalled to <body>).
 */
export function useRepoRedirect(url: string) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  const project = useMemo<LiveProject>(
    () => ({ name: "GitHub", url, bare: true, ground: { light: "#ffffff", dark: "#0d1117" } }),
    [url],
  );
  const getOrigin = useCallback(() => ref.current?.getBoundingClientRect() ?? null, []);
  const close = useCallback(() => setOpen(false), []);

  // Back button can restore this page (bfcache) with the surface still open.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setOpen(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const onClick = useCallback(
    (e: MouseEvent) => {
      if (!url || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      setOpen(true);
    },
    [url],
  );

  const modal = url ? (
    <ProjectPreviewModal project={project} open={open} getOrigin={getOrigin} onClose={close} mode="redirect" />
  ) : null;

  return { ref, onClick, modal };
}
