import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import type { ElementSnapshot } from "@designdebt/shared";
import { shouldCrawlLink, validatePublicHttpUrl } from "./url-validation.js";

export { shouldCrawlLink, validatePublicHttpUrl } from "./url-validation.js";

export interface ScannerOptions {
  maxPages: number;
  timeoutMs?: number;
  allowPrivateHosts?: boolean;
}

export interface ScanExecutionResult {
  pages: string[];
  snapshots: ElementSnapshot[];
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

    const browser = await chromium.launch({ headless: true });
    try {
      return await crawl(browser, normalizedUrl, options);
    } finally {
      await browser.close();
    }
  }
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
  const warnings: string[] = [];
  const page = await browser.newPage();
  page.setDefaultTimeout(options.timeoutMs ?? 20_000);

  while (queue.length > 0 && visited.size < maxPages) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: options.timeoutMs ?? 20_000 });
      await page.waitForTimeout(300);
      snapshots.push(...(await extractSnapshots(page, url)));
      const links = await page.$$eval("a[href]", (anchors) =>
        anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
      );
      for (const link of links) {
        const next = shouldCrawlLink(rootUrl, link);
        if (next && !visited.has(next) && !queue.includes(next)) queue.push(next);
      }
    } catch (error) {
      warnings.push(`${url}: ${error instanceof Error ? error.message : "Unable to scan page"}`);
    }
  }

  await page.close();
  return { pages: [...visited], snapshots, warnings };
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
