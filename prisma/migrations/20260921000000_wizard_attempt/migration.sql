-- CreateTable
CREATE TABLE "WizardAttempt" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "visitorId" TEXT,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "step" INTEGER NOT NULL DEFAULT 1,
    "maxStep" INTEGER NOT NULL DEFAULT 1,
    "blocker" TEXT,
    "blockedCount" INTEGER NOT NULL DEFAULT 0,
    "submitCount" INTEGER NOT NULL DEFAULT 0,
    "lastField" TEXT,
    "stepSeconds" TEXT,
    "resumed" BOOLEAN NOT NULL DEFAULT false,
    "reloads" INTEGER NOT NULL DEFAULT 0,
    "openedExtras" BOOLEAN NOT NULL DEFAULT false,
    "treatment" TEXT,
    "style" TEXT,
    "slideCount" INTEGER,
    "deliveryTier" TEXT,
    "proofreading" TEXT,
    "grammar" TEXT,
    "useGoogleSlides" BOOLEAN NOT NULL DEFAULT false,
    "estimateCents" INTEGER,
    "brief" TEXT,
    "audience" TEXT,
    "brandNotes" TEXT,
    "fontsColors" TEXT,
    "extraNotes" TEXT,
    "billingFilled" TEXT,
    "googleSlidesFilled" BOOLEAN NOT NULL DEFAULT false,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "fileMb" INTEGER NOT NULL DEFAULT 0,
    "styleFileCount" INTEGER NOT NULL DEFAULT 0,
    "detectedSlides" INTEGER,
    "outcome" TEXT NOT NULL DEFAULT 'OPEN',
    "orderId" TEXT,
    "signedIn" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "suspect" BOOLEAN NOT NULL DEFAULT false,
    "contentPurgedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WizardAttempt_attemptId_key" ON "WizardAttempt"("attemptId");

-- CreateIndex
CREATE INDEX "WizardAttempt_outcome_lastSeenAt_idx" ON "WizardAttempt"("outcome", "lastSeenAt");

-- CreateIndex
CREATE INDEX "WizardAttempt_lastSeenAt_idx" ON "WizardAttempt"("lastSeenAt");

-- CreateIndex
CREATE INDEX "WizardAttempt_visitorId_idx" ON "WizardAttempt"("visitorId");

-- CreateIndex
CREATE INDEX "WizardAttempt_orderId_idx" ON "WizardAttempt"("orderId");

-- CreateIndex
CREATE INDEX "WizardAttempt_userId_idx" ON "WizardAttempt"("userId");

-- AddForeignKey
ALTER TABLE "WizardAttempt" ADD CONSTRAINT "WizardAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardAttempt" ADD CONSTRAINT "WizardAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

