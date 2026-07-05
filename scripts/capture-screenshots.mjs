import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "screenshots");
const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";

const views = [
  { file: "home", nav: null },
  { file: "finder", nav: "Find my form" },
  { file: "mapping", nav: "What goes where" },
  { file: "calculator", nav: "Calculator" },
  { file: "solutions", nav: "Solutions" },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

for (const { file, nav } of views) {
  if (nav) {
    await page.locator(".nav-links button", { hasText: nav }).click();
    await page.waitForTimeout(900);
  } else {
    await page.locator("nav button.disp").first().click();
    await page.waitForTimeout(600);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(outDir, `${file}.png`),
    fullPage: true,
  });
  console.log(`saved ${file}.png`);
}

await browser.close();
