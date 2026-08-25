import type { SkillCategory } from "@/types";

export const skillCategories: SkillCategory[] = [
  {
    id: "languages",
    title: "Backend & Languages",
    skills: [
      { name: "Java", description: "Primary language for enterprise backend services and APIs." },
      { name: "C#", description: "Used for building services on the .NET Core platform." },
      { name: "JavaScript", description: "Scripting across backend tooling and frontend interfaces." },
      { name: "TypeScript", description: "Typed JavaScript for safer, more maintainable applications." },
      { name: "Python", description: "Scripting, automation, and problem solving." },
      { name: "C", description: "Foundational systems-level programming." },
      { name: "C++", description: "Foundational systems-level and data structures work." },
    ],
  },
  {
    id: "frameworks",
    title: "Backend Frameworks",
    skills: [
      { name: "Spring Boot", description: "Building scalable REST APIs and enterprise backend services." },
      { name: "Spring MVC", description: "Structuring web layers and request handling in Java applications." },
      { name: "Spring Data JPA", description: "Data access and ORM-based persistence for Java services." },
      { name: "Hibernate", description: "Object-relational mapping for Java backend systems." },
      { name: ".NET Core", description: "Cross-platform framework for enterprise application development." },
      { name: "Node.js", description: "Server-side JavaScript runtime for APIs and real-time services." },
      { name: "Express", description: "Lightweight routing and middleware layer for Node.js services." },
    ],
  },
  {
    id: "frontend",
    title: "Frontend",
    skills: [
      { name: "React.js", description: "Building interactive, component-driven user interfaces." },
      { name: "HTML", description: "Semantic markup for accessible, structured interfaces." },
      { name: "CSS", description: "Styling and responsive layout implementation." },
      { name: "Tailwind CSS", description: "Utility-first styling for consistent, maintainable UI." },
    ],
  },
  {
    id: "databases",
    title: "Databases & Data",
    skills: [
      { name: "Microsoft SQL Server", description: "Working with queries, stored procedures, triggers, and performance-oriented database operations." },
      { name: "MySQL", description: "Relational schema design and query optimization." },
      { name: "PostgreSQL", description: "Relational data modeling for backend applications." },
      { name: "MongoDB", description: "Document data modeling for full-stack applications." },
      { name: "SQL", description: "Query design, indexing, and data manipulation across relational systems." },
      { name: "Stored Procedures", description: "Encapsulating business logic close to the data layer." },
      { name: "Triggers", description: "Automating data-driven actions within the database layer." },
      { name: "Database Design", description: "Modeling schemas for correctness, scale, and maintainability." },
    ],
  },
  {
    id: "architecture",
    title: "Architecture & Integration",
    skills: [
      { name: "Microservices", description: "Designing independent, focused services with clear boundaries." },
      { name: "REST APIs", description: "Designing and consuming resource-oriented HTTP APIs." },
      { name: "Apache Kafka", description: "Supporting asynchronous and event-driven communication between distributed services." },
      { name: "Webhooks", description: "Handling inbound event notifications from external systems." },
      { name: "Asynchronous Event Processing", description: "Decoupling workflows through non-blocking, event-driven patterns." },
      { name: "Payment Gateway Integration", description: "Connecting applications to external payment providers and handling transaction lifecycles." },
      { name: "Third-Party API Integration", description: "Integrating external services such as KYC, insurance, and rewards platforms." },
    ],
  },
  {
    id: "tools",
    title: "Tools & Engineering",
    skills: [
      { name: "Git", description: "Version control and collaborative development workflows." },
      { name: "GitHub", description: "Source hosting, code review, and collaboration." },
      { name: "Maven", description: "Build automation and dependency management for Java projects." },
      { name: "IntelliJ IDEA", description: "Primary IDE for Java backend development." },
      { name: "Postman", description: "API testing, documentation, and request debugging." },
      { name: "SonarQube", description: "Static analysis for code quality and maintainability." },
      { name: "Prompt Engineering", description: "Applying LLM tooling effectively within engineering workflows." },
    ],
  },
];
