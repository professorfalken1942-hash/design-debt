import assert from "node:assert/strict";
import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PlaywrightWebsiteScanner } from "./index.ts";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(currentDir, "../../../tests/fixtures/site/index.html");

describe("PlaywrightWebsiteScanner fixture integration", () => {
  it("extracts visible element snapshots from a local fixture site", async () => {
    assert.equal(existsSync(fixturePath), true);

    const server = createServer((_request, response) => {
      response.setHeader("content-type", "text/html");
      createReadStream(fixturePath).pipe(response);
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");

    try {
      const scanner = new PlaywrightWebsiteScanner();
      const result = await scanner.scan(`http://127.0.0.1:${address.port}`, {
        maxPages: 1,
        timeoutMs: 10_000,
        allowPrivateHosts: true,
      });

      assert.equal(result.pages.length, 1);
      assert.ok(result.snapshots.length > 5);
      assert.equal(result.screenshots.length, 1);
      assert.ok(result.screenshots[0].dataUrl.startsWith("data:image/jpeg;base64,"));
      assert.ok(result.snapshots.some((snapshot) => snapshot.selector === "button.primary"));
      assert.ok(result.snapshots.some((snapshot) => snapshot.borderRadius));
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
