import type { ElementSnapshot, PageScreenshot } from "../../shared/src/index.js";

export const demoSnapshots: ElementSnapshot[] = [
  { pageUrl: "/", tagName: "body", selector: "body", color: "#111827", backgroundColor: "#ffffff", fontFamily: "Inter, sans-serif", fontSize: "16px", fontWeight: "400", lineHeight: "24px", paddingTop: "0px", paddingRight: "0px", paddingBottom: "0px", paddingLeft: "0px" },
  { pageUrl: "/", tagName: "button", selector: ".hero-primary", text: "Start scan", color: "#ffffff", backgroundColor: "#0066cc", fontFamily: "Inter", fontSize: "14px", fontWeight: "700", lineHeight: "20px", paddingTop: "12px", paddingRight: "18px", paddingBottom: "12px", paddingLeft: "18px", borderRadius: "8px", borderWidth: "1px", borderColor: "#0066cc", width: 128, height: 44 },
  { pageUrl: "/", tagName: "a", selector: ".nav-cta", text: "Docs", color: "#ffffff", backgroundColor: "#0569c9", fontFamily: "Inter", fontSize: "14px", fontWeight: "700", lineHeight: "20px", paddingTop: "11px", paddingRight: "16px", paddingBottom: "11px", paddingLeft: "16px", borderRadius: "7px", borderWidth: "1px", borderColor: "#0569c9", width: 92, height: 42 },
  { pageUrl: "/account", tagName: "button", selector: ".account-primary-button", text: "Save", color: "#fff", backgroundColor: "rgb(0, 102, 204)", fontFamily: "Inter", fontSize: "14px", fontWeight: "700", lineHeight: "20px", paddingTop: "12px", paddingRight: "18px", paddingBottom: "12px", paddingLeft: "18px", borderRadius: "8px", borderWidth: "1px", borderColor: "#0065c8", width: 96, height: 44 },
  { pageUrl: "/profile", tagName: "button", selector: ".profile-save", text: "Save profile", color: "#ffffff", backgroundColor: "#0065c8", fontFamily: "Inter", fontSize: "14px", fontWeight: "600", lineHeight: "20px", paddingTop: "10px", paddingRight: "17px", paddingBottom: "10px", paddingLeft: "17px", borderRadius: "10px", borderWidth: "1px", borderColor: "#0065c8", width: 124, height: 40 },
  { pageUrl: "/settings", tagName: "button", selector: ".preferences-submit", text: "Update", color: "#ffffff", backgroundColor: "#005fcc", fontFamily: "Inter", fontSize: "13px", fontWeight: "700", lineHeight: "18px", paddingTop: "12px", paddingRight: "18px", paddingBottom: "12px", paddingLeft: "18px", borderRadius: "8px", borderWidth: "1px", borderColor: "#005fcc", width: 112, height: 42 },
  { pageUrl: "/settings", tagName: "input", selector: "#email", color: "#111827", backgroundColor: "#ffffff", fontFamily: "Inter", fontSize: "14px", fontWeight: "400", lineHeight: "20px", paddingTop: "10px", paddingRight: "12px", paddingBottom: "10px", paddingLeft: "12px", borderRadius: "6px", borderWidth: "1px", borderColor: "#d1d5db", width: 320, height: 42 },
  { pageUrl: "/settings", tagName: "input", selector: "#name", color: "#111827", backgroundColor: "#ffffff", fontFamily: "Inter", fontSize: "14px", fontWeight: "400", lineHeight: "20px", paddingTop: "12px", paddingRight: "12px", paddingBottom: "12px", paddingLeft: "12px", borderRadius: "8px", borderWidth: "1px", borderColor: "#d4d4d8", width: 320, height: 46 },
  { pageUrl: "/billing", tagName: "h1", selector: "main h1", text: "Billing", color: "#111827", backgroundColor: "transparent", fontFamily: "Inter", fontSize: "32px", fontWeight: "700", lineHeight: "40px", marginBottom: "24px" },
  { pageUrl: "/billing", tagName: "p", selector: ".helper", text: "Manage plan", color: "#374151", backgroundColor: "transparent", fontFamily: "Inter", fontSize: "15px", fontWeight: "400", lineHeight: "24px", marginTop: "18px", marginBottom: "18px" },
  { pageUrl: "/reports", tagName: "p", selector: ".caption", text: "Updated today", color: "#4b5563", backgroundColor: "transparent", fontFamily: "Inter", fontSize: "13px", fontWeight: "400", lineHeight: "18px", marginTop: "12px", marginBottom: "20px" },
  { pageUrl: "/reports", tagName: "div", selector: ".card", color: "#111827", backgroundColor: "#f8fafc", fontFamily: "Inter", fontSize: "14px", fontWeight: "400", lineHeight: "20px", paddingTop: "18px", paddingRight: "24px", paddingBottom: "18px", paddingLeft: "24px", borderRadius: "12px", borderWidth: "1px", borderColor: "#e5e7eb", boxShadow: "0 12px 32px rgba(15,23,42,.08)" },
];

export const demoScreenshots: Omit<PageScreenshot, "id" | "scanId">[] = [
  demoScreenshot("/", "Landing page", "#0066cc"),
  demoScreenshot("/account", "Account settings", "#0066cc"),
  demoScreenshot("/profile", "Profile", "#0065c8"),
  demoScreenshot("/settings", "Preferences", "#005fcc"),
  demoScreenshot("/billing", "Billing", "#111827"),
  demoScreenshot("/reports", "Reports", "#f8fafc"),
];

function demoScreenshot(pageUrl: string, title: string, accent: string): Omit<PageScreenshot, "id" | "scanId"> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#f8fafc"/><rect x="0" y="0" width="960" height="64" fill="#111827"/><circle cx="36" cy="32" r="10" fill="${accent}"/><rect x="64" y="24" width="148" height="16" rx="8" fill="#d1d5db"/><rect x="64" y="108" width="360" height="38" rx="8" fill="#111827"/><rect x="64" y="166" width="520" height="18" rx="9" fill="#6b7280"/><rect x="64" y="208" width="132" height="44" rx="8" fill="${accent}"/><rect x="64" y="304" width="236" height="130" rx="12" fill="#ffffff" stroke="#e5e7eb"/><rect x="332" y="304" width="236" height="130" rx="12" fill="#ffffff" stroke="#e5e7eb"/><rect x="600" y="304" width="236" height="130" rx="12" fill="#ffffff" stroke="#e5e7eb"/><text x="64" y="494" fill="#374151" font-family="Arial" font-size="24">${title}</text></svg>`;
  return {
    pageUrl,
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width: 960,
    height: 540,
    capturedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  };
}
