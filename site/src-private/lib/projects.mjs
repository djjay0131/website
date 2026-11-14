// The members' projects model now lives in src/lib/projects-model.mjs, so the
// public Projects page can group a signed-in viewer's projects exactly as this
// private index does (D34). This is a thin re-export, as private-content.mjs is
// for frame-content.mjs. The model is pure code over the viewer's own
// `/private/items` response; it carries no private names.
export * from "../../src/lib/projects-model.mjs";
