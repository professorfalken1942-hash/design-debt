-- CreateTable
CREATE TABLE "PageScreenshot" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "teamName" TEXT NOT NULL DEFAULT 'UIpen Team',
    "defaultPageLimit" INTEGER NOT NULL DEFAULT 20,
    "crawlerMode" TEXT NOT NULL DEFAULT 'same-origin',
    "namingPreset" TEXT NOT NULL DEFAULT 'scale',
    "reviewThreshold" TEXT NOT NULL DEFAULT 'balanced',
    "ignoredPaths" JSONB,
    "teamNotes" TEXT NOT NULL DEFAULT '',
    "screenshotEvidence" BOOLEAN NOT NULL DEFAULT true,
    "reportFormatDefault" TEXT NOT NULL DEFAULT 'html',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matchers" JSONB NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4cbaf7',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanSchedule" (
    "id" TEXT NOT NULL,
    "rootUrl" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "maxPages" INTEGER NOT NULL DEFAULT 20,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageScreenshot_scanId_idx" ON "PageScreenshot"("scanId");

-- AddForeignKey
ALTER TABLE "PageScreenshot" ADD CONSTRAINT "PageScreenshot_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
