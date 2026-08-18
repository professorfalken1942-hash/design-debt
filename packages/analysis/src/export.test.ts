import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TokenProposal } from "@designdebt/shared";
import { exportTokensCss, exportTokensJson } from "./token-export.ts";

const tokens: TokenProposal[] = [
  {
    id: "included",
    name: "color.brand.500",
    value: "#0066cc",
    type: "primitive",
    category: "color",
    uses: 8,
    status: "enabled",
    confidence: "high",
  },
  {
    id: "review",
    name: "color.needs.review",
    value: "#123456",
    type: "primitive",
    category: "color",
    uses: 2,
    status: "needs-review",
    confidence: "low",
  },
  {
    id: "disabled",
    name: "color.disabled",
    value: "#abcdef",
    type: "primitive",
    category: "color",
    uses: 1,
    status: "disabled",
    confidence: "low",
  },
];

describe("token export", () => {
  it("exports only included tokens", () => {
    const css = exportTokensCss(tokens);
    const json = exportTokensJson(tokens);

    assert.match(css, /--color-brand-500: #0066cc;/);
    assert.doesNotMatch(css, /needs-review|disabled|#123456|#abcdef/);
    assert.deepEqual(json, { color: { brand: { "500": { value: "#0066cc" } } } });
  });
});
