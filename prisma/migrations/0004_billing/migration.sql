-- AlterTable
ALTER TABLE "Specialist" ADD COLUMN     "subscription" TEXT NOT NULL DEFAULT 'founding';

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "basisJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'issued',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "paidNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_projectId_stage_key" ON "Invoice"("projectId", "stage");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

