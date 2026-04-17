declare module "@citation-js/core" {
  export class Cite {
    constructor(data: string);
    data: Record<string, unknown>[];
  }
}

declare module "@citation-js/plugin-bibtex" {}
