-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('FREE', 'ONE_TIME', 'SUBSCRIPTION', 'USAGE_BASED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InstallRequestStatus" AS ENUM ('PENDING', 'PROVISIONING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "app_listings" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'FREE',
    "priceAmount" DECIMAL(18,8),
    "priceCurrency" TEXT DEFAULT 'USD',
    "billingPeriodDays" INTEGER,
    "usageUnit" TEXT,
    "usageRate" DECIMAL(18,8),
    "listingStatus" "ListingStatus" NOT NULL DEFAULT 'PENDING',
    "darHash" TEXT NOT NULL,
    "supportEmail" TEXT,
    "supportUrl" TEXT,
    "providerHeartbeat" TIMESTAMP(3),
    "onChainContractId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "licenseeId" TEXT NOT NULL,
    "pricingModel" "PricingModel" NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastRenewalAt" TIMESTAMP(3),
    "nextRenewalAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "usageLimit" INTEGER,
    "amountPaid" DECIMAL(18,8),
    "paymentRef" TEXT,
    "onChainContractId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "install_requests" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "InstallRequestStatus" NOT NULL DEFAULT 'PENDING',
    "statusMessage" TEXT,
    "licenseId" TEXT,
    "deploymentId" TEXT,
    "onChainContractId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "install_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_listings_appId_key" ON "app_listings"("appId");

-- CreateIndex
CREATE INDEX "app_listings_providerId_idx" ON "app_listings"("providerId");

-- CreateIndex
CREATE INDEX "app_listings_listingStatus_idx" ON "app_listings"("listingStatus");

-- CreateIndex
CREATE INDEX "licenses_licenseeId_idx" ON "licenses"("licenseeId");

-- CreateIndex
CREATE INDEX "licenses_status_idx" ON "licenses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_listingId_licenseeId_key" ON "licenses"("listingId", "licenseeId");

-- CreateIndex
CREATE INDEX "install_requests_requesterId_idx" ON "install_requests"("requesterId");

-- CreateIndex
CREATE INDEX "install_requests_listingId_idx" ON "install_requests"("listingId");

-- CreateIndex
CREATE INDEX "install_requests_status_idx" ON "install_requests"("status");

-- AddForeignKey
ALTER TABLE "app_listings" ADD CONSTRAINT "app_listings_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_listings" ADD CONSTRAINT "app_listings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "app_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_licenseeId_fkey" FOREIGN KEY ("licenseeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "install_requests" ADD CONSTRAINT "install_requests_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "app_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "install_requests" ADD CONSTRAINT "install_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "install_requests" ADD CONSTRAINT "install_requests_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "validator_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "install_requests" ADD CONSTRAINT "install_requests_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "app_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
