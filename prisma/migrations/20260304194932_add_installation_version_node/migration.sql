/*
  Warnings:

  - Added the required column `updatedAt` to the `installations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "installations" ADD COLUMN     "nodeId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "versionId" TEXT;

-- AddForeignKey
ALTER TABLE "installations" ADD CONSTRAINT "installations_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "validator_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installations" ADD CONSTRAINT "installations_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "app_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
