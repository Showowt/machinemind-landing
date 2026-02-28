import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function capture() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 2 });

  // English version
  await page.goto(`file://${join(__dirname, 'build-your-dream-en.html')}`, { waitUntil: 'networkidle0' });
  await delay(1500); // Wait for fonts
  await page.screenshot({ path: join(__dirname, 'build-your-dream-en.png'), fullPage: false });
  console.log('Created: build-your-dream-en.png');

  // Spanish version
  await page.goto(`file://${join(__dirname, 'build-your-dream-es.html')}`, { waitUntil: 'networkidle0' });
  await delay(1500);
  await page.screenshot({ path: join(__dirname, 'build-your-dream-es.png'), fullPage: false });
  console.log('Created: build-your-dream-es.png');

  await browser.close();
}

capture();
