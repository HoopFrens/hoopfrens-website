export type ResourceIcon =
  | "calendar"
  | "levels"
  | "email"
  | "video"
  | "parents"
  | "scholarship"
  | "eligibility"
  | "myths"
  | "questions"
  | "transfer";

export type RecruitingResource = {
  slug: string;
  title: string;
  description: string;
  icon: ResourceIcon;
  takeaways: string[];
};

export const resources: RecruitingResource[] = [
  {
    slug: "recruiting-timeline",
    title: "Recruiting Timeline",
    description: "A step-by-step guide for what players should be doing during freshman, sophomore, junior, and senior year.",
    icon: "calendar",
    takeaways: ["Build strong academic habits early", "Develop game film and measurable progress", "Contact realistic programs consistently", "Track applications, visits, and deadlines"],
  },
  {
    slug: "understanding-the-levels",
    title: "Understanding the Levels",
    description: "Learn the differences between JUCO, DII, DIII, NAIA, NCCAA, USCAA, and D1.",
    icon: "levels",
    takeaways: ["Compare athletic and academic expectations", "Understand scholarship differences", "Evaluate roster and playing opportunities", "Find the level that fits your goals"],
  },
  {
    slug: "email-templates-for-coaches",
    title: "Email Templates for Coaches",
    description: "Simple templates players can use to introduce themselves to college coaches.",
    icon: "email",
    takeaways: ["Write a useful subject line", "Share the information coaches need", "Personalize every message", "Follow up professionally"],
  },
  {
    slug: "highlight-film-checklist",
    title: "Highlight Film Checklist",
    description: "What to include, how long it should be, and how to make coaches want to keep watching.",
    icon: "video",
    takeaways: ["Lead with your strongest possessions", "Identify yourself clearly", "Show decisions, effort, and versatility", "Keep the edit focused and easy to watch"],
  },
  {
    slug: "parent-recruiting-guide",
    title: "Parent Recruiting Guide",
    description: "What parents should know about scholarships, visits, communication, and realistic opportunities.",
    icon: "parents",
    takeaways: ["Support without controlling the process", "Ask clear financial questions", "Help organize deadlines and visits", "Keep expectations honest and flexible"],
  },
  {
    slug: "scholarship-financial-aid-guide",
    title: "Scholarship & Financial Aid Guide",
    description: "Understand athletic scholarships, academic money, need-based aid, and total cost of attendance.",
    icon: "scholarship",
    takeaways: ["Compare complete financial aid packages", "Understand equivalency scholarships", "Look beyond the advertised tuition", "Ask about renewable aid requirements"],
  },
  {
    slug: "eligibility-basics",
    title: "Eligibility Basics",
    description: "A beginner-friendly overview of academic, athletic, and admissions requirements.",
    icon: "eligibility",
    takeaways: ["Track required high school coursework", "Know each association's standards", "Register with the right eligibility center", "Protect amateur status and academic progress"],
  },
  {
    slug: "recruiting-myths",
    title: "Recruiting Myths",
    description: "Common misconceptions about college basketball recruiting and what families should know instead.",
    icon: "myths",
    takeaways: ["Exposure does not replace fit", "Scholarships are not all full rides", "Coaches recruit beyond major events", "Division labels do not define opportunity"],
  },
  {
    slug: "questions-to-ask-coaches",
    title: "Questions to Ask Coaches",
    description: "A list of smart questions players and parents should ask during calls, visits, and recruiting conversations.",
    icon: "questions",
    takeaways: ["Clarify your projected role", "Ask how players develop", "Understand team and campus culture", "Discuss costs, aid, and academic support"],
  },
  {
    slug: "transfer-portal-basics",
    title: "Transfer Portal Basics",
    description: "A simple explanation of how transfers work and why planning matters.",
    icon: "transfer",
    takeaways: ["Understand the portal process", "Review eligibility before acting", "Plan academics and transferable credits", "Communicate carefully with current and future programs"],
  },
];

export const getResource = (slug: string) => resources.find((resource) => resource.slug === slug);
