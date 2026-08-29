-- AlterTable
ALTER TABLE "Specialist" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT NOT NULL DEFAULT '';

