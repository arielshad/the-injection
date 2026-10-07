/**
 * Tell IndexNow (Bing, Yandex, Seznam, Naver: one call reaches all) which
 * URLs changed in the latest sweep: the homepage plus every item page added
 * or updated by the most recent sweep report.
 *
 * Ownership is proved by the key file served at <SITE_URL>/<KEY>.txt, which
 * is public/<KEY>.txt in this repo. The key is public by design, so it lives
 * in source, not in a secret.
 *
 * Env:
 *   SITE_URL          required, e.g. https://theinjection.dev (no trailing slash needed)
 *   INDEXNOW_DRY_RUN  set to print the payload without sending it
 *
 * Best effort: always exits 0. A notification must never fail a workflow.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SweepLog } from "../src/data/feed.ts";
import { ROOT, SWEEPS_PATH, readJson } from "./lib/common.ts";

const KEY = "0fee53cce59a8207084ece1518580740";
const ENDPOINT = "https://api.indexnow.org/indexnow";

const site = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
if (!site) {
  console.log("[indexnow] SITE_URL is not set; skipping.");
  process.exit(0);
}
if (!existsSync(resolve(ROOT, "public", `${KEY}.txt`))) {
  console.log(`[indexnow] public/${KEY}.txt is missing; skipping (IndexNow would reject the key).`);
  process.exit(0);
}

let changed: string[] = [];
try {
  const log = readJson<SweepLog>(SWEEPS_PATH);
  const last = log.sweeps.at(-1);
  changed = [...(last?.added ?? []), ...(last?.updated ?? [])].map((a) => `${site}/items/${a.id}/`);
} catch {
  /* no sweep log yet */
}

const urlList = [...new Set([`${site}/`, ...changed])].slice(0, 10_000);
const body = {
  host: new URL(site).host,
  key: KEY,
  keyLocation: `${site}/${KEY}.txt`,
  urlList,
};

if (process.env.INDEXNOW_DRY_RUN) {
  console.log("[indexnow] dry run, would submit:");
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
}

try {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  console.log(`[indexnow] submitted ${urlList.length} url(s): ${res.status} ${res.statusText}`);
} catch (err) {
  console.log(`[indexnow] submit failed (non-fatal): ${String(err)}`);
}
process.exit(0);
