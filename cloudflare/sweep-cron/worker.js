// Hourly scheduler for the feed sweep. GitHub's own cron drops most runs
// (SWEEP_MEMORY 2026-10-12-A), so this Worker calls workflow_dispatch on
// update-feed.yml at minute 17 of every hour (wrangler.toml). The workflow's
// schedule stays as a fallback; its gate skips while this Worker keeps the
// feed fresh.
//
// Secret:   GITHUB_TOKEN  fine-grained PAT, this repo only, Actions: read and write
// Vars:     GITHUB_REPO, WORKFLOW, REF (wrangler.toml)

export default {
  async scheduled(_controller, env) {
    const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW}/dispatches`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "the-injection-sweep-cron",
      },
      body: JSON.stringify({ ref: env.REF }),
    });
    // GitHub answers 204 on success. Throwing marks the cron run as failed in
    // the Cloudflare dashboard (Workers > sweep-cron > Logs).
    if (res.status !== 204) {
      throw new Error(`workflow_dispatch failed: ${res.status} ${await res.text()}`);
    }
  },
};
