-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "rootUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "maxPages" INTEGER NOT NULL DEFAULT 20,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "healthScore" INTEGER,
    "error" TEXT,
    "warnings" JSONB,
    "analysis" JSONB,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElementSnapshot" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "selector" TEXT,
    "text" TEXT,
    "styles" JSONB NOT NULL,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "ElementSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "targetView" TEXT NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenProposal" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "uses" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "confidence" TEXT,
    "mapsTo" TEXT,

    CONSTRAINT "TokenProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Page_scanId_idx" ON "Page"("scanId");

-- CreateIndex
CREATE INDEX "ElementSnapshot_scanId_idx" ON "ElementSnapshot"("scanId");

-- CreateIndex
CREATE INDEX "Finding_scanId_idx" ON "Finding"("scanId");

-- CreateIndex
CREATE INDEX "TokenProposal_scanId_idx" ON "TokenProposal"("scanId");

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementSnapshot" ADD CONSTRAINT "ElementSnapshot_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenProposal" ADD CONSTRAINT "TokenProposal_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
