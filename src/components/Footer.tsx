import { siteConfig } from "@/data/site";
import { scrollToSection } from "@/utils/scroll";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <div className="container-px mx-auto flex max-w-6xl flex-col items-center gap-4 py-10 text-sm text-fg-muted sm:flex-row sm:justify-between">
        <p>
          © {year} {siteConfig.name}. Built with React, TypeScript &amp; Tailwind CSS.
        </p>
        <button
          type="button"
          onClick={() => scrollToSection("home")}
          className="font-mono text-xs tracking-wide text-fg-muted transition-colors hover:text-fg"
        >
          Back to top ↑
        </button>
      </div>
    </footer>
  );
}
