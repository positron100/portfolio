import type { Principle } from "@/types";

export const principles: Principle[] = [
  {
    id: "clean-architecture",
    title: "Clean Architecture",
    description: "Separating business logic from frameworks and delivery mechanisms so systems stay easy to change.",
  },
  {
    id: "scalable-systems",
    title: "Scalable Systems",
    description: "Designing services that handle growth in load and complexity without a rewrite.",
  },
  {
    id: "maintainable-code",
    title: "Maintainable Code",
    description: "Writing code that the next engineer — including future me — can read, trust, and extend.",
  },
  {
    id: "efficient-data-access",
    title: "Efficient Database Access",
    description: "Batching, indexing, and querying with intent instead of leaning on brute force.",
  },
  {
    id: "reliable-integrations",
    title: "Reliable API Integrations",
    description: "Treating third-party failures as expected, not exceptional, and handling them accordingly.",
  },
  {
    id: "reduced-coupling",
    title: "Reduced Service Coupling",
    description: "Keeping services independent so one team's change doesn't become everyone's incident.",
  },
  {
    id: "event-driven",
    title: "Event-Driven Communication",
    description: "Using asynchronous events where synchronous calls would create unnecessary dependencies.",
  },
  {
    id: "testable-code",
    title: "Testable Code",
    description: "Structuring logic so it can be verified with tests, not just manual checks.",
  },
  {
    id: "performance-oriented",
    title: "Performance-Oriented Design",
    description: "Making deliberate choices about data access and processing before they become bottlenecks.",
  },
];
