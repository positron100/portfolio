# Mukul Negi — Portfolio

Personal portfolio of **Mukul Negi**, backend software developer (Java / Spring Boot, microservices,
API integrations, financial systems). A single-page React app with a deliberately tactile interface:
fluid motion, magnetic and liquid controls, a 3D avatar companion, shared-element transitions and a
circular theme reveal. Light and dark themes are first-class everywhere.

Sections: Hero → About → Skills → Experience → Certifications → Projects → Architecture → Contact.

## Stack

| | |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 (CSS-first tokens in `src/index.css`) |
| Motion | `framer-motion` |
| 3D | `three` + `@react-three/fiber` (avatar, lazy-loaded) |
| Lint | `oxlint` |
| Contact API | Vercel edge function, email via Resend (plain `fetch`, no SDK) |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run preview    # serve the build
npm run lint
```

Copy `.env.example` to `.env` to try the contact form locally (see [Contact form](#contact-form)).
There is no router: navigation is scroll-driven with `#section` hashes.

## Project layout

```
src/sections/      one file per page section
src/components/    shared and section-specific components
src/hooks/         theme, intro clock, scroll, magnetic, modal behaviour, repo redirect
src/utils/         motion tokens, geometry, scroll, theme transition, project URLs
src/data/          all copy and content (content lives here, not in JSX)
api/               contact endpoint (server-side only)
public/certificates/  web copies of certificates + generated previews
scripts/           one-off maintenance scripts
```

`src/index.css` is the single source of colour truth; change the palette there, never in components.
`src/utils/motion.ts` holds the shared motion vocabulary — reuse it rather than inventing spring configs.

## Highlights

- **Opening sequence** — dots resolve into the avatar's own wireframe, then a circular reveal into the site.
- **Developer avatar** — a lazy-loaded r3f companion that follows the cursor (or a finger on touch).
- **Theme toggle** — click or drag to scrub a circular View-Transitions reveal; respects reduced motion.
- **Liquid navigation** — a shared spring-driven active indicator (navbar, tabs, filters), with drag-to-navigate.
- **Architecture map** — a communication-first system map with synchronous/asynchronous link languages.
- **Certificates** — a physical card-deck lightbox with drag and keyboard navigation.
- **Letter-style contact form** — the message is written on ruled paper, folded, sealed and posted.

### View Project

Projects and DevTown builds that have a deployed app get a **View Project** control
(`src/components/ProjectViewControl.tsx`, data in `src/data/liveProjects.ts`):

- The button widens in place into **Preview | Full View** with a detached close button.
- **Preview** morphs that pill into a glass window containing the live app in an iframe. The iframe is
  exactly the window's size, so the embedded app's own responsive layout applies (mobile layout on a phone).
  The iframe is mounted only while the preview is open, and the app's origin is `preconnect`ed when the
  control opens.
- **Full View** (and the GitHub / source-code links) unfold to the full screen in the destination's own page
  colour and then navigate in the same tab, so the hand-off doesn't flash.
- All motion honours `prefers-reduced-motion`; controls are keyboard accessible and Escape closes.

#### Cross-project contract

The portfolio talks to the embedded apps through the URL and `postMessage` only (they are separate origins):

- `?cp-mode=light|dark` is appended to every project URL (existing query parameters are preserved). Each app
  applies it in its pre-paint script so the project starts in the portfolio's mode. Apps that do not read it
  are unaffected.
- When an app is framed *and* opened with `?cp-mode`, it may hide its own scrollbar and post
  `{ type: "cp-scroll", down, right }` so the preview can draw a scroll arrow. The portfolio accepts the
  message only from that iframe's window and origin. Apps that don't post anything simply show no arrow.

## Contact form

The form posts to `/api/contact` (`api/contact.ts`, logic in `api/_contact.ts`). The same module is mounted by
the Vite dev server, so it works under `npm run dev`. It validates and sanitises on the server, rate-limits
(best-effort, in memory), has a honeypot, and sends through Resend with the visitor's address as `Reply-To`.

Environment variables (server-side, never bundled):

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key |
| `CONTACT_EMAIL` | where messages are delivered |
| `EMAIL_FROM` | verified sender (`Portfolio <onboarding@resend.dev>` works for testing) |

Endpoint tests: `node --experimental-strip-types api/_contact.test.mjs`.

## Deployment

Target is Vercel: a Vite SPA with an `api/` directory needs no configuration and no rewrite rule.
Set the three environment variables above for Production, Preview and Development before the first deploy;
changes to them apply on the next deploy. `Certificates/` (original documents) is not needed to run the site;
`public/certificates/` is what is served.

## Conventions

- Content lives in `src/data/`; never hard-code copy in JSX.
- Prefer `transform` / `opacity`; avoid per-frame React state, layout reads in animation loops, and
  full-viewport `backdrop-filter` during movement.
- Both themes and both reduced-motion states are checked for every change.
