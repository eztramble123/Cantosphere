-- AlterTable
ALTER TABLE "installations" ADD COLUMN     "onChainContractId" TEXT;

-- CreateTable
CREATE TABLE "canton_party_mappings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canton_party_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canton_party_mappings_partyId_idx" ON "canton_party_mappings"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "canton_party_mappings_userId_participantId_key" ON "canton_party_mappings"("userId", "participantId");

-- AddForeignKey
ALTER TABLE "canton_party_mappings" ADD CONSTRAINT "canton_party_mappings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
