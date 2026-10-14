# sweep-cron

A Cloudflare Worker that starts the feed sweep (`.github/workflows/update-feed.yml`)
at minute 17 of every hour by calling `workflow_dispatch`. GitHub's own cron drops
most scheduled runs, so it is kept only as a fallback.

Free plan: one cron trigger, 24 calls a day.

## 1. GitHub token

github.com → Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token.

- Repository access: Only select repositories → `arielshad/the-injection`
- Permissions → Repository → Actions: **Read and write** (nothing else)
- Expiration: the longest you are comfortable with. When it expires the
  sweep falls back to GitHub's cron, so set a reminder to rotate it.

## 2. Deploy

From this folder, on any machine with Node:

```sh
npx wrangler login
npx wrangler deploy
npx wrangler secret put GITHUB_TOKEN   # paste the token
```

Or in the dashboard (dash.cloudflare.com → Workers & Pages → Create → Worker):
paste `worker.js`, then under Settings add the variables `GITHUB_REPO`,
`WORKFLOW` and `REF` (values in `wrangler.toml`), the secret `GITHUB_TOKEN`,
and a cron trigger `17 * * * *`.

## 3. Check it

- Cloudflare: the Worker's Logs (or Settings → Triggers → the cron's past
  events) show each run. A failed run throws with GitHub's status and message.
- GitHub: Actions → Update feed (hourly) shows a `workflow_dispatch` run
  each hour, started by the token's owner.

A 401 means the token expired or was revoked. A 403 or 404 means it lacks
Actions write access to this repo.
