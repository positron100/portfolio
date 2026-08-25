import type { IntegrationDomain, PlatformService, ServiceCluster } from "@/types";

/**
 * A portfolio-facing abstraction of the microservices platform this work
 * happens on. Deliberately not a production topology: service
 * responsibilities are one-line summaries, the call graph is a
 * representative subset rather than every edge, and event names are generic
 * descriptors ("lead events") instead of real topic names. Enough to show
 * how the system is shaped and how services talk to each other, without
 * carrying anything internal.
 */

export const serviceClusters: ServiceCluster[] = [
  {
    id: "core",
    label: "Core Business",
    note: "The services the platform is built around.",
    services: [
      {
        id: "lms",
        label: "Lead Management",
        cluster: "core",
        responsibility: "Captures and routes leads through their lifecycle.",
        sync: ["cms", "core"],
        publishes: ["lead events"],
      },
      {
        id: "cms",
        label: "Client Management",
        cluster: "core",
        responsibility: "Owns client records and relationship ownership.",
        sync: ["core", "kyc"],
        publishes: ["client events"],
        consumes: ["lead events"],
      },
      {
        id: "core",
        label: "Core Service",
        cluster: "core",
        responsibility: "Shared domain logic the other services build on.",
        sync: ["transaction"],
        consumes: ["client events"],
      },
      {
        id: "transaction",
        label: "Transaction Service",
        cluster: "core",
        responsibility: "Processes transactions and their downstream state.",
        sync: ["third-party", "portfolio"],
        publishes: ["transaction events"],
      },
    ],
  },
  {
    id: "financial",
    label: "Financial Services",
    note: "Planning and holdings.",
    services: [
      {
        id: "planning",
        label: "Financial Planning",
        cluster: "financial",
        responsibility: "Builds and maintains client financial plans.",
        sync: ["portfolio"],
        consumes: ["client events"],
      },
      {
        id: "portfolio",
        label: "Portfolio Service",
        cluster: "financial",
        responsibility: "Tracks holdings and portfolio-level positions.",
        sync: ["third-party"],
        consumes: ["transaction events"],
      },
    ],
  },
  {
    id: "supporting",
    label: "Supporting Services",
    note: "Cross-cutting capabilities the whole platform draws on.",
    services: [
      {
        id: "kyc",
        label: "KYC Service",
        cluster: "supporting",
        responsibility: "Runs identity and compliance verification flows.",
        sync: ["third-party"],
        publishes: ["kyc events"],
      },
      {
        id: "communication",
        label: "Communication",
        cluster: "supporting",
        responsibility: "Sends client-facing notifications across channels.",
        consumes: ["lead events", "transaction events", "kyc events"],
      },
      {
        id: "marketing",
        label: "Digital Marketing",
        cluster: "supporting",
        responsibility: "Drives campaign and acquisition workflows.",
        sync: ["lms"],
        consumes: ["lead events"],
      },
      {
        id: "mis",
        label: "MIS Service",
        cluster: "supporting",
        responsibility: "Aggregates operational data for internal reporting.",
        consumes: ["transaction events", "client events"],
      },
      {
        id: "report",
        label: "Report Service",
        cluster: "supporting",
        responsibility: "Generates client and operational documents.",
        sync: ["portfolio"],
        consumes: ["transaction events"],
      },
    ],
  },
  {
    id: "integration",
    label: "Integration & Processing",
    note: "Where the platform meets everything outside it.",
    services: [
      {
        id: "third-party",
        label: "Third Party Service",
        cluster: "integration",
        responsibility: "The single boundary every external provider sits behind.",
        publishes: ["integration events"],
        consumes: ["transaction events", "kyc events"],
      },
      {
        id: "batch",
        label: "Batch Processing",
        cluster: "integration",
        // Named "Scheduled & Background Processing" in the detail card: the
        // node label stays short, but the first thing read about it says
        // plainly that nothing here is triggered by a user request.
        title: "Scheduled & Background Processing",
        responsibility:
          "Automated jobs, synchronization workflows, and cron-based tasks that run on a defined interval rather than on a request.",
        jobs: [
          "Insurance processing jobs",
          "Portfolio synchronization",
          "Transaction synchronization",
          "Scheduled cron workflows",
        ],
        offRequestPath: true,
        sync: ["third-party", "portfolio"],
        consumes: ["integration events"],
      },
    ],
  },
];

export const allServices: PlatformService[] = serviceClusters.flatMap((cluster) => cluster.services);

export function findService(id: string): PlatformService | undefined {
  return allServices.find((service) => service.id === id);
}

/**
 * External providers, grouped by what they do rather than listed flat.
 * A vendor only carries a `note` where the scope is unambiguous - the ones
 * without a note are named and left at that rather than described from
 * guesswork.
 */
export const integrationDomains: IntegrationDomain[] = [
  {
    id: "payments",
    label: "Payments",
    vendors: [
      { name: "BillDesk", note: "Mutual fund transactions and mandates" },
      { name: "Easebuzz", note: "Unlisted transactions" },
    ],
  },
  {
    id: "financial-data",
    label: "Financial Data",
    vendors: [
      { name: "MF Central" },
      { name: "Finvu", note: "Bank and account syncing" },
    ],
  },
  {
    id: "kyc",
    label: "KYC",
    vendors: [{ name: "Digio", note: "Identity verification" }],
  },
  {
    id: "insurance",
    label: "Insurance",
    vendors: [
      { name: "OneAssure", note: "Health insurance" },
      { name: "HDFC / HFFC" },
      { name: "Bajaj" },
      { name: "Other term insurance partners" },
    ],
  },
  {
    id: "crm",
    label: "Lead Management",
    vendors: [{ name: "LeadSquared" }],
  },
];

/** Copy for the fixed spine nodes, kept beside the service data it sits with. */
export const spineNodes = {
  client: {
    label: "Client",
    responsibility: "Web and application clients that start every request.",
  },
  gateway: {
    label: "API Gateway",
    responsibility: "One entry point. Authenticates, then routes into the ecosystem.",
  },
  registry: {
    label: "Service Registry",
    responsibility: "Service discovery. Supporting infrastructure, not a request hop.",
  },
  bus: {
    label: "Kafka",
    responsibility: "Event backbone. Services publish here and consume without calling each other.",
  },
} as const;
