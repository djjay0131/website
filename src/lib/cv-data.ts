/**
 * Load and resolve CV data from the content pool + variant selector.
 * Mirrors the logic of cv/tools/resolver.py, including the extended DSL:
 * bullet filtering, role collapse, and skills item subsetting.
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
  dates?: string;
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

// --- Extended DSL types ---

export interface EmploymentSelector {
  id: string;
  bullets?: string[];
  collapse?: boolean;
}

export interface SkillSelector {
  id: string;
  items?: string[];
}

export interface VariantSection {
  type: string;
  include?: (string | Record<string, unknown>)[];
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

export interface ResolvedEmploymentEntry {
  role: EmploymentRole;
  collapse: boolean;
}

export interface ResolvedCV {
  meta: Meta;
  summary?: Summary;
  employment: ResolvedEmploymentEntry[];
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

function lookupOne<T>(pool: Record<string, T>, id: string, sectionType: string): T {
  const item = pool[id];
  if (!item) throw new Error(`section '${sectionType}': unknown content id '${id}'`);
  return item;
}

function lookup<T>(pool: Record<string, T>, ids: string[], sectionType: string): T[] {
  return ids.map((id) => lookupOne(pool, id, sectionType));
}

function resolveEmployment(
  pool: ContentPool,
  include: (string | Record<string, unknown>)[],
): ResolvedEmploymentEntry[] {
  return include.map((item) => {
    if (typeof item === "string") {
      return { role: lookupOne(pool.employment, item, "employment"), collapse: false };
    }
    const sel = item as EmploymentSelector;
    let role = lookupOne(pool.employment, sel.id, "employment");
    if (sel.bullets !== undefined) {
      const bulletMap = new Map(role.bullets.map((b) => [b.id, b]));
      const filtered = sel.bullets.map((bid) => {
        const b = bulletMap.get(bid);
        if (!b) throw new Error(`employment role '${sel.id}': unknown bullet '${bid}'`);
        return b;
      });
      role = { ...role, bullets: filtered };
    }
    return { role, collapse: sel.collapse ?? false };
  });
}

function resolveSkills(
  pool: ContentPool,
  include: (string | Record<string, unknown>)[],
): SkillGroup[] {
  return include.map((item) => {
    if (typeof item === "string") {
      return lookupOne(pool.skills, item, "skills");
    }
    const sel = item as SkillSelector;
    const group = lookupOne(pool.skills, sel.id, "skills");
    if (sel.items !== undefined) {
      return { ...group, items: sel.items };
    }
    return group;
  });
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
        result.employment = resolveEmployment(pool, section.include);
        break;
      case "education":
        if (!section.include) throw new Error("education section requires include list");
        result.education = lookup(pool.education, section.include as string[], "education");
        break;
      case "projects":
        if (!section.include) throw new Error("projects section requires include list");
        result.projects = lookup(pool.projects, section.include as string[], "projects");
        break;
      case "skills":
        if (!section.include) throw new Error("skills section requires include list");
        result.skills = resolveSkills(pool, section.include);
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

// --- Convenience ---

export function listVariants(variantsDir: string): string[] {
  return fs
    .readdirSync(variantsDir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""));
}

export function loadCV(dataDir: string, variantName: string): ResolvedCV {
  const pool = loadContentPool(path.join(dataDir, "content"));
  const variant = loadVariant(path.join(dataDir, "variants", `${variantName}.yaml`));
  return resolveVariant(pool, variant);
}
