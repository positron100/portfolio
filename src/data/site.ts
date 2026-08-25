import type { EducationEntry, Certification, NavLink, SnapshotItem } from "@/types";

export const siteConfig = {
  name: "Mukul Negi",
  role: "Software Developer",
  rotatingRoles: [
    "Backend Engineer",
    "Java & Spring Boot Developer",
    "Building Scalable Systems",
    "Microservices & API Developer",
  ],
  tagline:
    "I build scalable backend systems, APIs, microservices, and integrations with a focus on reliable architecture and real-world engineering problems.",
  email: "mukuknegi2005@gmail.com",
  // No LinkedIn/GitHub URLs were found on the existing portfolio, so these are
  // left unset rather than guessed. Fill in real profile URLs here — any social
  // link component only renders when its value is present, so nothing links
  // to a made-up address in the meantime.
  socials: {
    linkedin: undefined as string | undefined,
    github: undefined as string | undefined,
  },
} as const;

export const navLinks: NavLink[] = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "certifications", label: "Certifications" },
  { id: "projects", label: "Projects" },
  { id: "architecture", label: "Architecture" },
  { id: "contact", label: "Contact" },
];

export const snapshotItems: SnapshotItem[] = [
  {
    label: "Backend Development",
    detail: "Java & Spring Boot services powering enterprise applications",
  },
  {
    label: "Microservices",
    detail: "Service-oriented architecture with clear domain boundaries",
  },
  {
    label: "API Integrations",
    detail: "Payment, KYC, and third-party API integrations",
  },
  {
    label: "Financial Systems",
    detail: "Transaction lifecycles, mandates, and webhook processing",
  },
  {
    label: "Database Engineering",
    detail: "Query, schema, and performance-oriented SQL work",
  },
];

export const education: EducationEntry[] = [
  {
    degree: "Bachelor of Technology in Computer Science Engineering",
    institution: "Dr. A.P.J. Abdul Kalam Technical University (AKTU)",
    period: "2021 – 2025",
  },
];

export const certifications: Certification[] = [
  { name: "Certified Web Developer", issuer: "InternsElite" },
  { name: "Certified — Python", issuer: "HackerRank" },
  { name: "Certified — CyberOps Associate", issuer: "Cisco" },
  { name: "Backend Web Development Bootcamp", issuer: "ShapeAI" },
];

export const leetcodeNote = "200+ LeetCode problems solved";
