import path from "node:path";
import type { Browser, Page } from "playwright-core";
import { chromium as localChromium } from "playwright";
import type { ElementSnapshot, PageScreenshot } from "../../shared/src/index.js";
import { shouldCrawlLink, validatePublicHttpUrl } from "./url-validation.js";

export { shouldCrawlLink, validatePublicHttpUrl } from "./url-validation.js";

export interface ScannerOptions {
  maxPages: number;
  timeoutMs?: number;
  allowPrivateHosts?: boolean;
  ignoredPaths?: string[];
  captureScreenshots?: boolean;
}

export interface ScanExecutionResult {
  pages: string[];
  snapshots: ElementSnapshot[];
  screenshots: Omit<PageScreenshot, "id" | "scanId">[];
  warnings: string[];
}

export interface WebsiteScanner {
  scan(rootUrl: string, options: ScannerOptions): Promise<ScanExecutionResult>;
}

export class PlaywrightWebsiteScanner implements WebsiteScanner {
  async scan(rootUrl: string, options: ScannerOptions): Promise<ScanExecutionResult> {
    let normalizedUrl = rootUrl;
    if (!options.allowPrivateHosts) {
      const validation = await validatePublicHttpUrl(rootUrl);
      if (!validation.ok || !validation.normalizedUrl) {
        throw new Error(validation.error ?? "Invalid URL.");
      }
      normalizedUrl = validation.normalizedUrl;
    }

    const browser = await launchBrowser();
    try {
      return await crawl(browser, normalizedUrl, options);
    } finally {
      await browser.close();
    }
  }
}

async function launchBrowser(): Promise<Browser> {
  if (isServerlessRuntime()) {
    const [{ chromium }, chromiumPackage] = await Promise.all([
      import("playwright-core"),
      import("@sparticuz/chromium"),
    ]);
    const serverlessChromium = chromiumPackage.default;
    const executablePath = await serverlessChromium.executablePath();
    const executableDir = path.dirname(executablePath);
    process.env.LD_LIBRARY_PATH = [process.env.LD_LIBRARY_PATH, executableDir].filter(Boolean).join(":");

    return chromium.launch({
      args: serverlessChromium.args,
      executablePath,
      headless: true,
    });
  }

  return localChromium.launch({ headless: true });
}

function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);
}

async function crawl(
  browser: Browser,
  rootUrl: string,
  options: ScannerOptions,
): Promise<ScanExecutionResult> {
  const maxPages = Math.max(1, Math.min(options.maxPages, 50));
  const queue = [rootUrl];
  const visited = new Set<string>();
  const snapshots: ElementSnapshot[] = [];
  const screenshots: Omit<PageScreenshot, "id" | "scanId">[] = [];
  const warnings: string[] = [];
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1365, height: 900 });
  page.setDefaultTimeout(options.timeoutMs ?? 20_000);

  while (queue.length > 0 && visited.size < maxPages) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: options.timeoutMs ?? 20_000 });
      await page.waitForTimeout(300);
      snapshots.push(...(await extractSnapshots(page, url)));
      if (options.captureScreenshots !== false) {
        screenshots.push(await captureScreenshot(page, url));
      }
      const links = await page.$$eval("a[href]", (anchors) =>
        anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
      );
      for (const link of links) {
        const next = shouldCrawlLink(rootUrl, link);
        if (next && isIgnoredPath(next, options.ignoredPaths ?? [])) continue;
        if (next && !visited.has(next) && !queue.includes(next)) queue.push(next);
      }
    } catch (error) {
      warnings.push(`${url}: ${error instanceof Error ? error.message : "Unable to scan page"}`);
    }
  }

  await page.close();
  return { pages: [...visited], snapshots, screenshots, warnings };
}

function isIgnoredPath(url: string, ignoredPaths: string[]): boolean {
  if (!ignoredPaths.length) return false;
  const pathname = new URL(url).pathname;
  return ignoredPaths.some((path) => {
    const trimmed = path.trim();
    return trimmed && pathname.startsWith(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
  });
}

async function captureScreenshot(page: Page, pageUrl: string): Promise<Omit<PageScreenshot, "id" | "scanId">> {
  const viewport = page.viewportSize() ?? { width: 1365, height: 900 };
  const image = await page.screenshot({
    type: "jpeg",
    quality: 58,
    fullPage: false,
  });

  return {
    pageUrl,
    dataUrl: `data:image/jpeg;base64,${image.toString("base64")}`,
    width: viewport.width,
    height: viewport.height,
    capturedAt: new Date().toISOString(),
  };
}

async function extractSnapshots(page: Page, pageUrl: string): Promise<ElementSnapshot[]> {
  return page.$$eval(
    "body *",
    (elements, currentPageUrl) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        })
        .slice(0, 1500)
        .map((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const text = element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80);
          const className = [...element.classList].slice(0, 3).join(".");
          return {
            pageUrl: currentPageUrl as string,
            tagName: element.tagName.toLowerCase(),
            text,
            selector: element.id
              ? `#${element.id}`
              : `${element.tagName.toLowerCase()}${className ? `.${className}` : ""}`,
            color: style.color,
            backgroundColor: style.backgroundColor,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            marginTop: style.marginTop,
            marginRight: style.marginRight,
            marginBottom: style.marginBottom,
            marginLeft: style.marginLeft,
            paddingTop: style.paddingTop,
            paddingRight: style.paddingRight,
            paddingBottom: style.paddingBottom,
            paddingLeft: style.paddingLeft,
            gap: style.gap,
            borderRadius: style.borderRadius,
            borderWidth: style.borderWidth,
            borderColor: style.borderColor,
            boxShadow: style.boxShadow === "none" ? undefined : style.boxShadow,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        }),
    pageUrl,
  );
}
