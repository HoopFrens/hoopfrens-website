export type DivisionSlug = "juco" | "naia" | "d2" | "d3" | "nccaa" | "uscaa";

export type Division = {
  slug: DivisionSlug;
  shortName: string;
  name: string;
  tagline: string;
  description: string;
  longDescription: string;
  schools: string;
  aid: string;
  pathway: string;
  accent: string;
};

export type Story = {
  title: string;
  category: string;
  division: string;
  image: string;
  excerpt: string;
};

export type Person = {
  name: string;
  role: string;
  program: string;
  division: string;
  image: string;
  quote: string;
};