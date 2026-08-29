-- AlterTable
ALTER TABLE "Artifact" ADD COLUMN     "contentType" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sizeBytes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "storageKey" TEXT;

