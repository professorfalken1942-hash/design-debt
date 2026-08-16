export function normalizePixelValue(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "0" || trimmed === "0px" || trimmed === "0rem" || trimmed === "0em") {
    return "0";
  }
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!match) return trimmed.replace(/\s+/g, " ");
  const numeric = Number(match[1]);
  return `${Number.isInteger(numeric) ? numeric : Number(numeric.toFixed(2))}px`;
}

export function normalizeFontFamily(value?: string): string | undefined {
  return value
    ?.split(",")
    .map((part) => part.trim().replace(/^["']|["']$/g, "").toLowerCase())
    .join(", ");
}

export function normalizeFontWeight(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "normal") return "400";
  if (normalized === "bold") return "700";
  return normalized;
}

export function normalizeColor(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "transparent" || trimmed === "rgba(0, 0, 0, 0)") return "transparent";
  if (trimmed.startsWith("#")) return normalizeHex(trimmed);

  const rgba = trimmed.match(/^rgba?\(([^)]+)\)$/);
  if (!rgba) return trimmed;

  const parts = rgba[1]
    .split(/[,/ ]+/)
    .filter(Boolean)
    .map((part) => Number(part.replace("%", "")));

  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) {
    return trimmed;
  }

  const [r, g, b] = parts.slice(0, 3).map((part) => clamp(Math.round(part), 0, 255));
  const alpha = parts[3];

  if (alpha !== undefined && alpha <= 0) return "transparent";
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function colorSimilarity(a: string, b: string): number {
  const labA = rgbToLab(hexToRgb(normalizeColor(a) ?? a));
  const labB = rgbToLab(hexToRgb(normalizeColor(b) ?? b));
  const distance = Math.sqrt(
    (labA.l - labB.l) ** 2 + (labA.a - labB.a) ** 2 + (labA.b - labB.b) ** 2,
  );
  return Math.max(0, Math.round((1 - Math.min(distance, 100) / 100) * 100));
}

function normalizeHex(value: string): string {
  const hex = value.replace("#", "");
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  return `#${hex.slice(0, 6).padEnd(6, "0")}`;
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex).replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToLab(rgb: { r: number; g: number; b: number }) {
  const [x, y, z] = rgbToXyz(rgb);
  const fx = xyzPivot(x / 95.047);
  const fy = xyzPivot(y / 100);
  const fz = xyzPivot(z / 108.883);
  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function rgbToXyz({ r, g, b }: { r: number; g: number; b: number }) {
  const values = [r, g, b].map((channel) => {
    const scaled = channel / 255;
    return scaled > 0.04045
      ? ((scaled + 0.055) / 1.055) ** 2.4
      : scaled / 12.92;
  });
  return [
    (values[0] * 0.4124 + values[1] * 0.3576 + values[2] * 0.1805) * 100,
    (values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722) * 100,
    (values[0] * 0.0193 + values[1] * 0.1192 + values[2] * 0.9505) * 100,
  ];
}

function xyzPivot(value: number): number {
  return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
}

