# DesignDebt + TokenForge

DesignDebt is an MVP SaaS product for UI observability: it scans public websites and reports visual/design-system inconsistency.

TokenForge uses the same scan data to infer a cleaner token system and export it as CSS variables or JSON.

## Architecture

```text
apps/
  web/      Angular standalone app with router and SCSS UI system
  api/      Express API, scan orchestration, Prisma schema
packages/
  shared/   shared TypeScript contracts
  scanner/  Playwright crawling and URL validation
  analysis/ normalization, inventories, findings, scoring, token generation
```

The MVP is demo-ready while preserving production boundaries. Scan execution is behind a service interface and can later move to a queue/worker.

## Local Setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:generate
npm run db:migrate
npm run dev:api
npm run dev
```

Web: `http://localhost:4200`  
API: `http://localhost:4310`

## Database

PostgreSQL runs via Docker Compose on port `5437`.

Prisma models are defined in `apps/api/prisma/schema.prisma`:

- `Scan`
- `Page`
- `ElementSnapshot`
- `Finding`
- `TokenProposal`

The API persists scans, crawled pages, extracted element snapshots, findings, token proposals, scan progress, warnings, and analysis summaries through Prisma.

The API seeds a `demo` scan when demo data is requested and stores new scan requests as durable records. Scan execution currently runs in-process after `POST /api/scans`; a worker queue is the next production hardening step.

Completed scan records include progress, warnings, findings, analysis metrics, and token proposals. Failed or completed scans can be retried from the scan detail UI; the demo retry restores the seeded fixture data instead of crawling the `.test` URL.

## Playwright

The scanner package uses Playwright Chromium.

```bash
npx playwright install chromium
```

The crawler:

- only accepts public HTTP/HTTPS URLs
- rejects localhost, private IPs, metadata IPs, and non-web protocols
- crawls same-origin links
- ignores anchors, mailto/tel links, downloads, and external domains
- extracts computed styles from visible rendered elements

Tests include a local fixture website scan that permits localhost through a test-only scanner option.

## Tests

```bash
npm run test
```

Current coverage includes URL helpers, color normalization, pixel normalization, and perceptual color similarity.
It also includes a Playwright fixture scan that exercises rendered DOM extraction.

For a quick real-scan smoke test with the API running:

```bash
curl -X POST http://localhost:4310/api/scans \
  -H 'content-type: application/json' \
  -d '{"rootUrl":"https://example.com","maxPages":1}'
```

## MVP Limitations

- No auth, billing, teams, permissions, or enterprise controls.
- Scan execution runs in-process rather than through a background queue.
- Token inference uses deterministic rules, not AI.
- Screenshot highlighting is intentionally deferred.
- Component-token generation is marked as a later phase.

## Suggested Next Phases

1. Move scan execution to a queue/worker with retries and cancellation.
2. Add scan detail drill-down routes for individual pages and element snapshots.
3. Expand DesignDebt category analysis.
4. Add richer TokenForge consolidation review and diff previews.
5. Add authenticated workspaces and scan history management.
