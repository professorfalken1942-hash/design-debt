import type { TokenProposal } from "@designdebt/shared";

export function exportTokensCss(tokens: TokenProposal[]): string {
  const enabled = tokens.filter((token) => token.status === "enabled");
  const lines = enabled.map((token) => {
    const value = token.value.replace(/^\{(.+)\}$/, (_match, path: string) => `var(--${path.replaceAll(".", "-")})`);
    return `  --${token.name.replaceAll(".", "-")}: ${value};`;
  });
  return `:root {\n${lines.join("\n")}\n}\n`;
}

export function exportTokensJson(tokens: TokenProposal[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const token of tokens.filter((item) => item.status === "enabled")) {
    const path = token.name.split(".");
    let cursor = root;
    for (const segment of path.slice(0, -1)) {
      cursor[segment] ??= {};
      cursor = cursor[segment] as Record<string, unknown>;
    }
    cursor[path.at(-1) ?? token.name] = { value: token.value };
  }
  return root;
}
