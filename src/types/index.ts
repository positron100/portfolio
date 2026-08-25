export interface NavLink {
  id: string;
  label: string;
}

export interface Skill {
  name: string;
  description: string;
}

export interface SkillCategory {
  id: string;
  title: string;
  skills: Skill[];
}

export type ProjectFilter =
  | "all"
  | "microservices"
  | "payments"
  | "integrations"
  | "backend"
  | "full-stack";

export interface ProjectFlowStep {
  label: string;
  description: string;
}

export interface Project {
  id: string;
  name: string;
  categories: ProjectFilter[];
  categoryLabel: string;
  kind: "case-study" | "personal";
  summary: string;
  details: string[];
  highlights: string[];
  technologies: string[];
  flow?: ProjectFlowStep[];
  repoUrl?: string;
  liveUrl?: string;
}

export interface ExperienceHighlightGroup {
  title: string;
  points: string[];
}

/**
 * A project delivered inside an experience entry (the DevTown internship's
 * three builds). Kept separate from `Project` — that type carries the
 * Projects-section machinery (filter categories, flow diagrams, modal
 * details) which none of this needs.
 */
export interface InternshipProject {
  id: string;
  name: string;
  /** Two or three words, shown under the name on the selector card. */
  tagline: string;
  description: string;
  technologies: string[];
  contributions: string[];
  repoUrl: string;
  /** A short monospace mark giving the card its own quiet character —
   * typographic rather than illustrative, so the three stay cohesive. */
  glyph: string;
  /** Opt-in visual preview. Only `clock` exists; anything without this
   * renders as a normal detail panel. */
  preview?: "clock";
}

export interface ExperienceEntry {
  role: string;
  company: string;
  period: string;
  /** One-line framing, shown above whatever detail the entry carries. */
  summary?: string;
  /** Thematic highlight groups (the Fincart role). */
  groups?: ExperienceHighlightGroup[];
  /** Projects delivered during the role (the DevTown internship). An entry
   * uses groups or projects — the timeline renders whichever is present. */
  projects?: InternshipProject[];
}

/** Where a node sits in the system map's vertical spine. */
export type SystemLayer = "client" | "gateway" | "registry" | "service" | "bus" | "integration";

export type ClusterId = "core" | "financial" | "supporting" | "integration";

/**
 * One service in the microservices ecosystem.
 *
 * `sync` and `publishes`/`consumes` are deliberately *representative* rather
 * than exhaustive: a real ecosystem's full call graph drawn at once is an
 * unreadable spider-web, and a portfolio should not carry a production
 * topology anyway. Event names are generic descriptors, not real topic names.
 */
export interface PlatformService {
  id: string;
  label: string;
  cluster: ClusterId;
  /** Overrides `label` as the detail-card heading, where a service needs a
   * fuller name than fits in a node. */
  title?: string;
  /** One line, shown in the focus card. */
  responsibility: string;
  /** Services this one calls synchronously over REST. */
  sync?: string[];
  /** Kinds of event this service puts on the bus. */
  publishes?: string[];
  /** Kinds of event this service reacts to. */
  consumes?: string[];
  /**
   * Named workloads, for a service whose job is better shown as a list than
   * described in a sentence. Only the scheduled worker uses this.
   */
  jobs?: string[];
  /**
   * Set on services that never sit in the request path. Rendered dashed, the
   * same language the registry uses, so they read as running beside the
   * ecosystem rather than inside a request.
   */
  offRequestPath?: boolean;
}

export interface ServiceCluster {
  id: ClusterId;
  label: string;
  /** Shown under the cluster label; plain language, not a tagline. */
  note: string;
  services: PlatformService[];
}

export interface IntegrationVendor {
  name: string;
  /** Omitted where the real scope is ambiguous - never guessed at. */
  note?: string;
}

export interface IntegrationDomain {
  id: string;
  label: string;
  vendors: IntegrationVendor[];
}

export interface Principle {
  id: string;
  title: string;
  description: string;
}

export interface SnapshotItem {
  label: string;
  detail: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  period: string;
}

export interface Certification {
  name: string;
  issuer: string;
}

/**
 * A real credential document with a preview image. Distinct from
 * `Certification`, which is the plain name/issuer pair the About column
 * lists.
 */
export interface CertificateItem {
  id: string;
  title: string;
  issuer: string;
  /** Only where the document prints one. The DevTown set prints a programme
   * duration instead, which lives in `detail`. */
  issued?: string;
  credentialId?: string;
  verifyUrl?: string;
  /** One supporting line: programme, duration, or academy. */
  detail?: string;
  kind: "certificate" | "letter";
  /** Preview image. Generated from the PDF where the source is a PDF. */
  image: string;
  /** The original document, kept reachable from the viewer. */
  documentUrl?: string;
  /** Real pixel size of `image`, so a card can hold the document's own
   * proportions instead of cropping it into a uniform box. */
  width: number;
  height: number;
}

export type FormStatus = "idle" | "submitting" | "success" | "error";

export interface ContactFormValues {
  name: string;
  email: string;
  message: string;
  /** Honeypot, filled only by bots. Never rendered visibly. */
  company?: string;
}
