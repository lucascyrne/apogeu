/** Origens permitidas a embutir o instrumento (iframe). Sem https://* — inválido em CSP. */

export const FRAME_ANCESTOR_SOURCES = [
  "'self'",
  "https://horizonte.dev.br",
  "https://www.horizonte.dev.br",
  "https://*.vercel.app",
  "https://*.netlify.app",
  "https://*.pages.dev",
  "https://*.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

/** @param {string} [extra] espaços: URLs extras (ex. portfólio em domínio próprio) */
export function buildFrameAncestorsCsp(extra = "") {
  if (process.env.EMBED_FRAME_ANCESTORS_ALL === "1") {
    return "frame-ancestors *";
  }
  const more = extra.trim().split(/\s+/).filter(Boolean);
  const sources = [...FRAME_ANCESTOR_SOURCES, ...more];
  return `frame-ancestors ${sources.join(" ")}`;
}

export const FRAME_ANCESTORS_CSP = buildFrameAncestorsCsp(
  process.env.FRAME_ANCESTORS_EXTRA ?? ""
);
