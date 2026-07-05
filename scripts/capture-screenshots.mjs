import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "screenshots");
const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
const VIEWPORT = { width: 1280, height: 900 };

const views = [
  { file: "home", nav: null },
  { file: "finder", nav: "Find my form" },
  { file: "mapping", nav: "What goes where" },
  { file: "calculator", nav: "Calculator" },
  { file: "solutions", nav: "Solutions" },
  { file: "practice", action: "practice" },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT });

await page.emulateMedia({ reducedMotion: "reduce" });

async function prepareViewport() {
  await page.evaluate(() => {
    document.querySelectorAll(".rise").forEach((el) => el.classList.add("in"));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
}

async function goHome() {
  await page.locator("nav button.disp").first().click();
  await page.waitForTimeout(700);
}

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

for (const { file, nav, action } of views) {
  if (action === "practice") {
    await goHome();
    await page.locator(".btn-sandbox").first().click();
    await page.waitForTimeout(1400);
  } else if (nav) {
    await goHome();
    await page.locator(".nav-links button", { hasText: nav }).click();
    await page.waitForTimeout(900);
  } else {
    await goHome();
  }

  await prepareViewport();
  await page.screenshot({
    path: path.join(outDir, `${file}.png`),
    fullPage: false,
  });
  console.log(`saved ${file}.png (${VIEWPORT.width}x${VIEWPORT.height} viewport)`);
}

await browser.close();
