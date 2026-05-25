import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildFrameAncestorsCsp } from "../config/embed-frame-ancestors.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csp = buildFrameAncestorsCsp(process.env.FRAME_ANCESTORS_EXTRA ?? "");

const paths = ["vercel.json", "apps/instrument/vercel.json"];

for (const rel of paths) {
  const path = join(root, rel);
  const data = JSON.parse(readFileSync(path, "utf8"));
  const block = data.headers?.[0]?.headers?.find(
    (h) => h.key === "Content-Security-Policy"
  );
  if (!block) {
    console.warn(`CSP header not found in ${rel}`);
    continue;
  }
  block.value = csp;
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Updated ${rel}`);
}

console.log(csp);
