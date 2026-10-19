#!/usr/bin/env node
/**
 * link-health.mjs — verifies every outbound showcase link on the homepage.
 *
 * WHY THIS EXISTS: the homepage renders a pulsing "Live in Production" badge on
 * every ELITE row and a "View Live" link on every portfolio card. Those claims
 * were never checked against reality, so when Ballantir, Street Legal AI and
 * Movvia went to maintenance pages the site kept advertising them as live for
 * weeks. A dead flagship link is worse than no link: it reads as abandonment to
 * exactly the prospect the section exists to convince.
 *
 * It renders each URL in headless Chrome (not just a status check — a
 * maintenance page answers 200 with a cheerful title) and asserts the visitor
 * lands on real content.
 *
 * Usage:
 *   node scripts/link-health.mjs            # check links in src/app/page.tsx
 *   node scripts/link-health.mjs --json     # machine-readable report
 *   node scripts/link-health.mjs --url=https://example.com  # ad-hoc check
 *
 * Exit codes: 0 = all healthy · 1 = an ELITE platform is down (blocks deploy)
 *             2 = only portfolio/demo links are down (warning)
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(ROOT, 'src/app/page.tsx');

/** Pages that answer 200 while telling the visitor to come back later. */
const DEAD_MARKERS = [
  /under\s+maintenance/i,
  /en\s+mantenimiento/i,
  /sitio\s+en\s+mantenimiento/i,
  /temporarily\s+unavailable/i,
  /temporalmente\s+no\s+disponible/i,
  /deployment\s+not\s+found/i,
  /this\s+page\s+could\s+not\s+be\s+found/i,
  /404[\s:—-]*(not\s+found|p[áa]gina)/i,
  /account\s+suspended/i,
  /cuenta\s+suspendida/i,
  /coming\s+soon/i,
  /pr[óo]ximamente/i,
];

/** Below this much rendered text a page is a shell, a login wall or an error. */
const MIN_TEXT = 220;
/** A body this long is a real page even if it mentions "coming soon" somewhere. */
const MAINTENANCE_TEXT = 1_200;
/** A heavy DOM (image walls, canvas sites) is proof of life without much text. */
const RICH_DOM = 400;
const NAV_TIMEOUT = 30_000;

/**
 * Puppeteer's bundled Chrome is not installed in this repo (and CI images vary),
 * so fall back to a system Chrome before asking puppeteer to find its own.
 */
function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

/** Pull the showcased URLs out of the homepage, tagged by which section owns them. */
async function collectLinks() {
  const src = await readFile(PAGE, 'utf8');

  const eliteBlock = src.match(/const ELITE_PLATFORMS[\s\S]*?\n\];/)?.[0] ?? '';
  const projectsBlock = src.match(/const PROJECTS[\s\S]*?\n\];/)?.[0] ?? '';

  /**
   * Split into one chunk per object literal before reading anything out of it.
   * Entries in BOTH lists may carry no url — private portfolio work, and
   * platforms we deliberately do not link (Life Center X holds clinical data).
   * A regex run across the whole block would pair such a name with the NEXT
   * entry's url and report a URL nobody is showing as healthy, which is the
   * exact silent failure this script exists to prevent. Neither list nests
   * braces inside an entry, so a non-greedy brace match is a safe boundary.
   */
  const extract = (block, tier) =>
    (block.match(/\{[^{}]*\}/g) ?? []).flatMap((chunk) => {
      const name = chunk.match(/name:\s*'((?:[^'\\]|\\.)*)'/)?.[1];
      const url = chunk.match(/url:\s*'([^']+)'/)?.[1];
      if (!name || !url) return [];
      return [{ name: name.replace(/\\'/g, "'"), url, tier }];
    });

  return [...extract(eliteBlock, 'elite'), ...extract(projectsBlock, 'portfolio')];
}

async function checkOne(browser, { name, url, tier }) {
  const page = await browser.newPage();
  const result = { name, url, tier, status: 0, ok: false, reason: '', title: '' };

  try {
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 MachineMind-LinkHealth/1.0'
    );

    // networkidle2, not domcontentloaded: several of these sites hydrate their
    // whole body late, and reading too early reports a live page as blank.
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: NAV_TIMEOUT,
    }).catch(async (err) => {
      if (!/timeout/i.test(String(err))) throw err;
      return page.waitForSelector('body', { timeout: 5_000 }).then(() => null);
    });
    // 0 = navigation settled without a fresh response record; the content
    // checks below still decide whether the visitor sees a real page.
    result.status = response?.status() ?? 0;

    const readText = async () =>
      (await page.evaluate(() => document.body?.innerText ?? '')).replace(/\s+/g, ' ').trim();

    const countNodes = () => page.evaluate(() => document.querySelectorAll('*').length);

    let flat = await readText();
    let nodes = await countNodes();
    // Grace passes for deferred/lazy content before calling a page empty.
    for (let attempt = 0; attempt < 2 && flat.length < MIN_TEXT; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 4_000));
      flat = await readText();
      nodes = await countNodes();
    }

    result.title = (await page.title()).trim().slice(0, 80);

    // A full page may legitimately contain "coming soon" on one badge, so a
    // marker only condemns the page when it IS the page: in the title, or in a
    // body with nothing else to say.
    const marker = DEAD_MARKERS.find(
      (re) => re.test(result.title) || (re.test(flat) && flat.length < MAINTENANCE_TEXT)
    );

    if (result.status >= 400) {
      result.reason = `HTTP ${result.status}`;
    } else if (marker) {
      result.reason = `maintenance/error page (${String(marker).slice(0, 34)})`;
    } else if (flat.length < MIN_TEXT && nodes < RICH_DOM) {
      result.reason = `only ${flat.length} chars / ${nodes} nodes rendered — blank or login wall`;
    } else {
      result.ok = true;
    }
  } catch (error) {
    result.reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
  } finally {
    await page.close().catch(() => {});
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const adHoc = args.filter((a) => a.startsWith('--url=')).map((a) => a.slice(6));

  const links = adHoc.length
    ? adHoc.map((url) => ({ name: url, url, tier: 'ad-hoc' }))
    : await collectLinks();

  if (!links.length) {
    console.error('[link-health] no links found — did page.tsx change shape?');
    process.exit(1);
  }

  const { default: puppeteer } = await import('puppeteer');
  const executablePath = resolveChrome();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    ...(executablePath ? { executablePath } : {}),
  });

  const results = [];
  const CONCURRENCY = 4;
  const queue = [...links];

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        results.push(await checkOne(browser, next));
      }
    })
  );

  await browser.close();

  const order = { elite: 0, portfolio: 1, 'ad-hoc': 2 };
  results.sort((a, b) => order[a.tier] - order[b.tier] || a.name.localeCompare(b.name));

  const broken = results.filter((r) => !r.ok);
  const brokenElite = broken.filter((r) => r.tier === 'elite');

  if (asJson) {
    console.log(JSON.stringify({ checked: results.length, broken: broken.length, results }, null, 2));
  } else {
    for (const r of results) {
      const mark = r.ok ? 'OK  ' : 'DEAD';
      const tag = r.tier === 'elite' ? '[ELITE]' : r.tier === 'portfolio' ? '[folio]' : '[adhoc]';
      console.log(
        `${mark} ${tag} ${r.name.padEnd(26)} ${String(r.status).padEnd(4)} ${r.url}` +
          (r.ok ? '' : `\n       └─ ${r.reason}`)
      );
    }
    console.log(
      `\n${results.length - broken.length}/${results.length} healthy · ` +
        `${brokenElite.length} ELITE down · ${broken.length - brokenElite.length} portfolio down`
    );
  }

  if (brokenElite.length) process.exit(1);
  if (broken.length) process.exit(2);
}

main().catch((error) => {
  console.error('[link-health]', error);
  process.exit(1);
});
