/**
 * Load and resolve CV data from the content pool + variant selector.
 * Mirrors the logic of cv/tools/resolver.py.
 */

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

// --- Types matching cv/tools/schema.py ---

export interface NameVariant {
  family: string;
  given: string;
}

export interface Contact {
  email: string;
  linkedin?: string;
  github?: string;
  x?: string;
}

export interface Meta {
  name: string;
  contact: Contact;
  photo: string;
  include_photo: boolean;
  name_variants: NameVariant[];
}

export interface Bullet {
  id: string;
  text: string;
}

export interface EmploymentRole {
  id: string;
  dates: string;
  company: string;
  location: string;
  title: string;
  bullets: Bullet[];
}

export interface EducationEntry {
  id: string;
  dates?: string;
  degree: string;
  institution: string;
  location: string;
}

export interface Project {
  id: string;
  name: string;
  summary: string;
  github?: string;
}

export interface SkillGroup {
  id: string;
  group: string;
  items: string[];
}

export interface Award {
  id: string;
  dates?: string;
  text: string;
}

export interface Certification {
  id: string;
  text: string;
}

export interface Misc {
  awards: Award[];
  certifications: Certification[];
}

export interface Summary {
  id: string;
  text: string;
}

export interface Referee {
  id: string;
  text: string;
}

export interface VariantSection {
  type: string;
  include?: string[];
  content_id?: string;
}

export interface VariantConfig {
  variant: string;
  sections: VariantSection[];
}

export interface ContentPool {
  meta: Meta;
  summaries: Record<string, Summary>;
  employment: Record<string, EmploymentRole>;
  education: Record<string, EducationEntry>;
  projects: Record<string, Project>;
  skills: Record<string, SkillGroup>;
  misc: Misc;
  referees: Record<string, Referee>;
}

export interface ResolvedCV {
  meta: Meta;
  summary?: Summary;
  employment: EmploymentRole[];
  education: EducationEntry[];
  projects: Project[];
  skills: SkillGroup[];
  misc: Misc;
  referee?: Referee;
  sectionOrder: string[];
}

// --- Loading ---

function readYaml<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  return yaml.load(raw) as T;
}

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  const result: Record<string, T> = {};
  for (const item of items) {
    result[item.id] = item;
  }
  return result;
}

export function loadContentPool(contentDir: string): ContentPool {
  const meta = readYaml<Meta>(path.join(contentDir, "meta.yaml"));
  const summaries = readYaml<Summary[]>(path.join(contentDir, "summaries.yaml")) ?? [];
  const employment = readYaml<EmploymentRole[]>(path.join(contentDir, "employment.yaml")) ?? [];
  const education = readYaml<EducationEntry[]>(path.join(contentDir, "education.yaml")) ?? [];
  const projects = readYaml<Project[]>(path.join(contentDir, "projects.yaml")) ?? [];
  const skills = readYaml<SkillGroup[]>(path.join(contentDir, "skills.yaml")) ?? [];
  const misc = readYaml<Misc>(path.join(contentDir, "misc.yaml")) ?? { awards: [], certifications: [] };
  const referees = readYaml<Referee[]>(path.join(contentDir, "referees.yaml")) ?? [];

  return {
    meta,
    summaries: indexById(summaries),
    employment: indexById(employment),
    education: indexById(education),
    projects: indexById(projects),
    skills: indexById(skills),
    misc,
    referees: indexById(referees),
  };
}

export function loadVariant(variantPath: string): VariantConfig {
  return readYaml<VariantConfig>(variantPath);
}

function lookup<T>(pool: Record<string, T>, ids: string[], sectionType: string): T[] {
  return ids.map((id) => {
    const item = pool[id];
    if (!item) throw new Error(`section '${sectionType}': unknown content id '${id}'`);
    return item;
  });
}

function lookupOne<T>(pool: Record<string, T>, id: string, sectionType: string): T {
  const item = pool[id];
  if (!item) throw new Error(`section '${sectionType}': unknown content id '${id}'`);
  return item;
}

export function resolveVariant(pool: ContentPool, variant: VariantConfig): ResolvedCV {
  const result: ResolvedCV = {
    meta: pool.meta,
    employment: [],
    education: [],
    projects: [],
    skills: [],
    misc: pool.misc,
    sectionOrder: variant.sections.map((s) => s.type),
  };

  for (const section of variant.sections) {
    switch (section.type) {
      case "summary":
        if (!section.content_id) throw new Error("summary section requires content_id");
        result.summary = lookupOne(pool.summaries, section.content_id, "summary");
        break;
      case "employment":
        if (!section.include) throw new Error("employment section requires include list");
        result.employment = lookup(pool.employment, section.include, "employment");
        break;
      case "education":
        if (!section.include) throw new Error("education section requires include list");
        result.education = lookup(pool.education, section.include, "education");
        break;
      case "projects":
        if (!section.include) throw new Error("projects section requires include list");
        result.projects = lookup(pool.projects, section.include, "projects");
        break;
      case "skills":
        if (!section.include) throw new Error("skills section requires include list");
        result.skills = lookup(pool.skills, section.include, "skills");
        break;
      case "misc":
        result.misc = pool.misc;
        break;
      case "referee":
        if (!section.content_id) throw new Error("referee section requires content_id");
        result.referee = lookupOne(pool.referees, section.content_id, "referee");
        break;
      case "publications":
        break;
      default:
        throw new Error(`unknown section type: '${section.type}'`);
    }
  }

  return result;
}

// --- Convenience: list all variants ---

export function listVariants(variantsDir: string): string[] {
  return fs
    .readdirSync(variantsDir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""));
}

// --- Load + resolve in one call ---

export function loadCV(dataDir: string, variantName: string): ResolvedCV {
  const pool = loadContentPool(path.join(dataDir, "content"));
  const variant = loadVariant(path.join(dataDir, "variants", `${variantName}.yaml`));
  return resolveVariant(pool, variant);
}
