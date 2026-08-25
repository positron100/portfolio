import type { ExperienceEntry } from "@/types";

export const experience: ExperienceEntry[] = [
  {
    role: "Software Development Intern",
    company: "DevTown",
    period: "3 Months",
    summary:
      "Contributed to three web development projects across frontend and backend — React, Node.js, Express, and MongoDB — building interactive interfaces, data-driven features, and version-controlled workflows.",
    // Every description below was written from the actual repository
    // contents rather than from a résumé summary: file trees, `app.js`,
    // `TextForm.js` and `clock.js` were all read before this was filled in.
    projects: [
      {
        id: "ayurvedic-remedy-suggestor",
        name: "Ayurvedic Remedy Suggestor",
        tagline: "Data-driven remedy lookup",
        glyph: "℞",
        description:
          "A server-rendered web app that suggests an Ayurvedic remedy from a user's condition, age, gender, and severity, matching the input against a prescription dataset held in MongoDB.",
        technologies: ["Node.js", "Express", "MongoDB", "Mongoose", "Pug", "JavaScript", "CSS"],
        contributions: [
          "Built a multi-field intake form capturing condition, age, gender, and severity.",
          "Modelled the remedy and contact collections with Mongoose and queried MongoDB Atlas for a match.",
          "Seeded the remedy data from a public drug-prescription dataset.",
          "Rendered every view server-side with Pug templates over Express routes.",
          "Handled the no-match case explicitly rather than failing silently.",
        ],
        repoUrl: "https://github.com/positron100/ayurvedic-remedy-suggestor",
      },
      {
        id: "textutils",
        name: "TextUtils",
        tagline: "Live text transformation",
        glyph: "Aa",
        description:
          "A React text utility that transforms pasted text and reports on it live — case conversion, whitespace cleanup, clipboard copy, and a running word and character count.",
        technologies: ["React", "React Hooks", "React Router", "JavaScript", "HTML", "CSS", "Git"],
        contributions: [
          "Implemented uppercase, lowercase, clear, copy-to-clipboard, and extra-space removal.",
          "Derived word and character counts straight from state, so they update as you type.",
          "Managed text, theme, and alert state with React hooks in a controlled textarea.",
          "Added a light/dark mode toggle with transient confirmation alerts.",
          "Routed between the editor and an About view with React Router.",
        ],
        repoUrl: "https://github.com/positron100/TextUtils_enhanced",
      },
      {
        id: "clock",
        name: "Clock",
        tagline: "Sliding-digit timepiece",
        glyph: "00",
        description:
          "An animated digital clock built in vanilla JavaScript. Six vertical digit strips slide to the current time each second, and the digit that lands in place is highlighted — a soft, neumorphic take on a flip clock.",
        technologies: ["HTML", "CSS", "JavaScript"],
        contributions: [
          "Drove six digit strips from one interval, translating each to the digit for the current hour, minute, and second.",
          "Split each unit into tens and ones so a strip only ever travels a short distance.",
          "Highlighted the active digit on arrival, then cleared it just before the next tick to produce the ticking beat.",
          "Styled the strips with soft inset/outset shadows for the neumorphic look.",
          "Sized everything in viewport units so the clock scales with the screen.",
        ],
        repoUrl: "https://github.com/positron100/clock",
        preview: "clock",
      },
    ],
  },
  {
    role: "Software Developer (Junior SDE)",
    company: "Fincart Financial Planners",
    period: "Aug 2024 – Present",
    groups: [
      {
        title: "Payment & Transaction Systems",
        points: [
          "Integrated payment workflows using BillDesk.",
          "Worked with payment status handling and transaction lifecycles.",
          "Implemented asynchronous webhook-based processing.",
          "Worked on mandate-related workflows.",
        ],
      },
      {
        title: "KYC & Third-Party Integrations",
        points: [
          "Integrated Digio APIs.",
          "Automated KYC and KRA-related workflows.",
          "Integrated OneAssure for health insurance purchase flows.",
          "Integrated RewardPort for referral workflows.",
        ],
      },
      {
        title: "Backend & Database Engineering",
        points: [
          "Developed and optimized REST APIs.",
          "Worked with Java and Spring Boot services.",
          "Improved database workflows and SQL operations.",
          "Worked with T-SQL stored procedures and performance optimization.",
          "Built scheduled synchronization and webhook-driven systems.",
        ],
      },
    ],
  },
];
