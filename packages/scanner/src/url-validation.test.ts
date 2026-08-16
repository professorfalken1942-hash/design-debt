import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPrivateIp, shouldCrawlLink } from "./url-validation.ts";

describe("URL validation helpers", () => {
  it("blocks private IP ranges", () => {
    assert.equal(isPrivateIp("127.0.0.1"), true);
    assert.equal(isPrivateIp("10.0.0.2"), true);
    assert.equal(isPrivateIp("192.168.1.10"), true);
    assert.equal(isPrivateIp("8.8.8.8"), false);
  });

  it("keeps only same-origin crawl links", () => {
    assert.equal(shouldCrawlLink("https://example.com", "/about"), "https://example.com/about");
    assert.equal(shouldCrawlLink("https://example.com", "mailto:a@example.com"), null);
    assert.equal(shouldCrawlLink("https://example.com", "https://other.com"), null);
  });
});

