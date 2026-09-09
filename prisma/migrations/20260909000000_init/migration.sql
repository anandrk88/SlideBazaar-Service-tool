-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "billingAddress" TEXT,
    "billingCity" TEXT,
    "billingCountry" TEXT,
    "billingVat" TEXT,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "emailAtLink" TEXT NOT NULL,
    "emailVerifiedByProvider" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "designerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "escrowStatus" TEXT NOT NULL DEFAULT 'NONE',
    "treatment" TEXT NOT NULL,
    "finalTreatment" TEXT,
    "style" TEXT NOT NULL,
    "slideCount" INTEGER NOT NULL,
    "deliveryTier" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "proofreading" TEXT NOT NULL DEFAULT 'NONE',
    "grammar" TEXT NOT NULL DEFAULT 'US',
    "brief" TEXT NOT NULL,
    "googleSlidesUrl" TEXT,
    "audience" TEXT,
    "brandNotes" TEXT,
    "fontsColors" TEXT,
    "extraNotes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "perSlideMinCents" INTEGER NOT NULL,
    "perSlideMaxCents" INTEGER NOT NULL,
    "addonPerSlideCents" INTEGER NOT NULL DEFAULT 0,
    "subtotalMinCents" INTEGER NOT NULL,
    "subtotalMaxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "finalTotalCents" INTEGER,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderFile" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "kind" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlidePreview" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "released" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlidePreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSessionId" TEXT,
    "providerPaymentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowEntry" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerRefundId" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minCents" INTEGER NOT NULL,
    "maxCents" INTEGER NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'palette',
    "tint" TEXT NOT NULL DEFAULT 'bg-violet-100 text-violet-700',
    "badge" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StyleOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "swatch" TEXT NOT NULL DEFAULT 'from-brand-800 to-brand-950',
    "accent" TEXT NOT NULL DEFAULT 'bg-accent-500',
    "requiresUpload" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StyleOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTierOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryTierOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TextServiceOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "perSlideCents" INTEGER NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'search',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TextServiceOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "OrderMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerAccountId_key" ON "AuthIdentity"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_userId_provider_key" ON "AuthIdentity"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_purpose_idx" ON "VerificationToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_designerId_idx" ON "Order"("designerId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "OrderFile_orderId_idx" ON "OrderFile"("orderId");

-- CreateIndex
CREATE INDEX "SlidePreview_orderId_version_idx" ON "SlidePreview"("orderId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerSessionId_key" ON "Payment"("providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowEntry_idempotencyKey_key" ON "EscrowEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EscrowEntry_orderId_idx" ON "EscrowEntry"("orderId");

-- CreateIndex
CREATE INDEX "RefundAttempt_orderId_idx" ON "RefundAttempt"("orderId");

-- CreateIndex
CREATE INDEX "RefundAttempt_status_idx" ON "RefundAttempt"("status");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");

-- CreateIndex
CREATE INDEX "SavedCard_userId_idx" ON "SavedCard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "OrderMessage_orderId_idx" ON "OrderMessage"("orderId");

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFile" ADD CONSTRAINT "OrderFile_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFile" ADD CONSTRAINT "OrderFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlidePreview" ADD CONSTRAINT "SlidePreview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowEntry" ADD CONSTRAINT "EscrowEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowEntry" ADD CONSTRAINT "EscrowEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundAttempt" ADD CONSTRAINT "RefundAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMessage" ADD CONSTRAINT "OrderMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMessage" ADD CONSTRAINT "OrderMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

