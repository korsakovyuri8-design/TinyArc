-- CreateTable
CREATE TABLE "StageApproval" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StageApproval_projectId_stage_key" ON "StageApproval"("projectId", "stage");

-- AddForeignKey
ALTER TABLE "StageApproval" ADD CONSTRAINT "StageApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

