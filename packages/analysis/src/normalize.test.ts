import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { colorSimilarity, normalizeColor, normalizePixelValue } from "./normalize.ts";

describe("normalization", () => {
  it("normalizes equivalent colors", () => {
    assert.equal(normalizeColor("rgb(0, 102, 204)"), "#0066cc");
    assert.equal(normalizeColor("#06c"), "#0066cc");
  });

  it("normalizes pixel values", () => {
    assert.equal(normalizePixelValue("0px"), "0");
    assert.equal(normalizePixelValue("18.50px"), "18.5px");
  });

  it("uses perceptual color similarity", () => {
    assert.ok(colorSimilarity("#0066cc", "#0569c9") >= 94);
  });
});

