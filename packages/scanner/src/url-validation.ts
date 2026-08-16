import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);
const CLOUD_METADATA_IP = "169.254.169.254";

export interface UrlValidationResult {
  ok: boolean;
  normalizedUrl?: string;
  error?: string;
}

export async function validatePublicHttpUrl(input: string): Promise<UrlValidationResult> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: "Enter a valid URL." };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false, error: "Only HTTP and HTTPS URLs can be scanned." };
  }

  if (url.username || url.password) {
    return { ok: false, error: "URLs with embedded credentials are not allowed." };
  }

  url.hash = "";
  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local")) {
    return { ok: false, error: "Local and private hosts cannot be scanned." };
  }

  if (isPrivateIp(hostname)) {
    return { ok: false, error: "Private network addresses cannot be scanned." };
  }

  try {
    const records = await lookup(hostname, { all: true });
    if (records.some((record) => isPrivateIp(record.address))) {
      return { ok: false, error: "This host resolves to a private network address." };
    }
  } catch {
    return { ok: false, error: "Unable to resolve this host." };
  }

  return { ok: true, normalizedUrl: url.toString() };
}

export function shouldCrawlLink(rootUrl: string, href: string): string | null {
  if (!href || href.startsWith("#") || /^(mailto|tel|file|javascript):/i.test(href)) {
    return null;
  }

  const root = new URL(rootUrl);
  const next = new URL(href, root);
  next.hash = "";

  if (next.origin !== root.origin) return null;
  if (/\.(zip|pdf|png|jpe?g|gif|webp|svg|mp4|mp3|mov)$/i.test(next.pathname)) return null;
  return next.toString();
}

export function isPrivateIp(value: string): boolean {
  if (value === CLOUD_METADATA_IP) return true;
  const version = net.isIP(value);
  if (version === 0) return false;
  if (version === 6) {
    return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80");
  }

  const parts = value.split(".").map(Number);
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

