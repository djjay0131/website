/**
 * Parse own-bib.bib into structured records for the papers page.
 * Groups by entry type, sorts year-descending.
 */

import fs from "node:fs";
import { Cite } from "@citation-js/core";
import "@citation-js/plugin-bibtex";

export interface PaperEntry {
  id: string;
  type: string;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  booktitle?: string;
  doi?: string;
  url?: string;
  github?: string;
  abstract?: string;
}

export interface PapersByGroup {
  articles: PaperEntry[];
  proceedings: PaperEntry[];
  books: PaperEntry[];
  other: PaperEntry[];
}

function mapEntry(cslEntry: Record<string, unknown>): PaperEntry {
  const authors: string[] = [];
  const authorList = cslEntry.author as Array<{ family?: string; given?: string }> | undefined;
  if (authorList) {
    for (const a of authorList) {
      if (a.family && a.given) {
        authors.push(`${a.given} ${a.family}`);
      } else if (a.family) {
        authors.push(a.family);
      }
    }
  }

  const issued = cslEntry.issued as { "date-parts"?: number[][] } | undefined;
  const year = issued?.["date-parts"]?.[0]?.[0] ?? 0;

  return {
    id: cslEntry["citation-key"] as string ?? cslEntry.id as string ?? "",
    type: cslEntry.type as string ?? "article",
    title: cslEntry.title as string ?? "",
    authors,
    year,
    journal: cslEntry["container-title"] as string | undefined,
    booktitle: cslEntry["container-title"] as string | undefined,
    doi: cslEntry.DOI as string | undefined,
    url: cslEntry.URL as string | undefined,
    github: cslEntry.github as string | undefined,
    abstract: cslEntry.abstract as string | undefined,
  };
}

function groupType(cslType: string): keyof PapersByGroup {
  switch (cslType) {
    case "article-journal":
    case "article":
      return "articles";
    case "paper-conference":
      return "proceedings";
    case "book":
    case "chapter":
      return "books";
    default:
      return "other";
  }
}

export function parseBib(bibPath: string): PapersByGroup {
  const raw = fs.readFileSync(bibPath, "utf-8");
  const cite = new Cite(raw);
  const entries: Record<string, unknown>[] = cite.data as Record<string, unknown>[];

  const result: PapersByGroup = {
    articles: [],
    proceedings: [],
    books: [],
    other: [],
  };

  for (const entry of entries) {
    const paper = mapEntry(entry);
    const group = groupType(paper.type);
    result[group].push(paper);
  }

  // Sort each group year-descending.
  for (const group of Object.values(result)) {
    group.sort((a: PaperEntry, b: PaperEntry) => b.year - a.year);
  }

  return result;
}

export function parseBibFlat(bibPath: string): PaperEntry[] {
  const groups = parseBib(bibPath);
  return [...groups.articles, ...groups.proceedings, ...groups.books, ...groups.other];
}
