# Deploy pipeline — self-reporting

`git push` → GitHub → Vercel is a **webhook**, and webhooks fail silently. On
2026-08-25 the Vercel↔GitHub link for this project had silently dropped, so two
pushes shipped nothing; code only went live because a human noticed and ran
`vercel --prod` by hand.

**Root cause:** the Vercel project `machinemind-landing` had lost its Git link
(it was absent from Vercel's linked-projects list while every sibling project
was present). Restored with `vercel git connect`.

**Backstop (so a silent miss can never ship-nothing again):**
a `pre-push` git hook backgrounds `~/.claude/scripts/verify-deploy.mjs`, which
after each push to `main` confirms Vercel created a production deployment for the
exact SHA pushed.

- Deployment for the pushed SHA appears → **silent** (healthy).
- No deployment before the deadline → **Telegram alert** + auto `vercel --prod`
  self-heal (allowlisted projects only), then a recovered/failed follow-up.
- Deployment appeared but build errored → alert, no blind re-deploy.

Re-arm after a fresh clone (hooks live outside version control):

```bash
bash ~/.claude/scripts/install-deploy-hook.sh ~/projects/builds/machinemind-landing
```

## Showcase link health (added 2026-10-18)

The homepage badges every ELITE row "Live in Production" and every portfolio
card "View Live". Nothing verified those claims, so Ballantir, Street Legal AI
and Movvia advertised themselves as live for weeks while serving maintenance
pages.

```bash
npm run check:links          # renders every showcased URL in headless Chrome
node scripts/link-health.mjs --json
node scripts/link-health.mjs --url=https://example.com
```

Exit 1 = an ELITE platform is down (treat as a deploy blocker), exit 2 = only
portfolio links are down. A plain status check is not enough — a maintenance
page answers 200 with a cheerful title — so the script reads rendered text.
Run it before any deploy that touches the portfolio, and periodically: client
platforms go dark without telling us.
