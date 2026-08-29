-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Specialist" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'apply',
    "invitedAt" TIMESTAMP(3),
    "disciplinesJson" TEXT NOT NULL DEFAULT '[]',
    "specializationsJson" TEXT NOT NULL DEFAULT '[]',
    "typologiesJson" TEXT NOT NULL DEFAULT '[]',
    "scaleBandsJson" TEXT NOT NULL DEFAULT '[]',
    "maxStoreys" INTEGER NOT NULL DEFAULT 1,
    "materialSystemsJson" TEXT NOT NULL DEFAULT '[]',
    "climateZonesJson" TEXT NOT NULL DEFAULT '[]',
    "jurisdictionsJson" TEXT NOT NULL DEFAULT '[]',
    "signsInJson" TEXT NOT NULL DEFAULT '[]',
    "softwareJson" TEXT NOT NULL DEFAULT '[]',
    "ifcLevel" TEXT NOT NULL DEFAULT 'none',
    "docStagesJson" TEXT NOT NULL DEFAULT '[]',
    "regulatoryTracksJson" TEXT NOT NULL DEFAULT '[]',
    "languagesJson" TEXT NOT NULL DEFAULT '[]',
    "workMode" TEXT NOT NULL DEFAULT 'remote',
    "utcOffset" INTEGER NOT NULL DEFAULT 0,
    "weeklyCapacityHours" INTEGER NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "availabilityStatus" TEXT NOT NULL DEFAULT 'available',
    "portfolioRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "portfolioUrl" TEXT NOT NULL DEFAULT '',
    "deliveredTickets" INTEGER NOT NULL DEFAULT 0,
    "onTimeTickets" INTEGER NOT NULL DEFAULT 0,
    "firstTimeRightTickets" INTEGER NOT NULL DEFAULT 0,
    "responseMinutesTotal" INTEGER NOT NULL DEFAULT 0,
    "revisionRoundsTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Specialist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "typology" TEXT NOT NULL,
    "storeys" INTEGER NOT NULL,
    "areaSqm" INTEGER NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "climateZone" TEXT NOT NULL,
    "materialSystem" TEXT NOT NULL,
    "regulatoryTrack" TEXT NOT NULL DEFAULT 'light',
    "targetStage" TEXT NOT NULL DEFAULT 'permit',
    "terrain" TEXT NOT NULL DEFAULT 'flat',
    "gridConnection" TEXT NOT NULL DEFAULT 'grid',
    "softwareJson" TEXT NOT NULL DEFAULT '[]',
    "languagesJson" TEXT NOT NULL DEFAULT '[]',
    "requiredHoursPerWeek" INTEGER NOT NULL DEFAULT 10,
    "horizonDays" INTEGER NOT NULL DEFAULT 30,
    "utcOffset" INTEGER NOT NULL DEFAULT 1,
    "briefNotes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "rejectionReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMessage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignDirection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tradeoff" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'stub',
    "chosen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignDirection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pooledCount" INTEGER NOT NULL DEFAULT 0,
    "survivedCount" INTEGER NOT NULL DEFAULT 0,
    "outcome" TEXT NOT NULL DEFAULT 'ok',
    "notes" TEXT NOT NULL DEFAULT '',
    "gapJson" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MatchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "roleSpecializationsJson" TEXT NOT NULL DEFAULT '[]',
    "roleMode" TEXT NOT NULL DEFAULT 'any',
    "passed" BOOLEAN NOT NULL,
    "failedGate" TEXT NOT NULL DEFAULT '',
    "portfolioRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "historyWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "relevance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "replacedById" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSlot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "roleSpecializationsJson" TEXT NOT NULL DEFAULT '[]',
    "roleMode" TEXT NOT NULL DEFAULT 'any',
    "isSignatory" BOOLEAN NOT NULL DEFAULT false,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "spec" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'planned',
    "requestedFromId" TEXT,
    "specialistId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'blocked',
    "slaHours" INTEGER NOT NULL DEFAULT 24,
    "openedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "revisionRounds" INTEGER NOT NULL DEFAULT 0,
    "conflictRaisedAt" TIMESTAMP(3),
    "conflictBy" TEXT,
    "conflictNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketDependency" (
    "id" TEXT NOT NULL,
    "dependentId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,

    CONSTRAINT "TicketDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "isConflict" BOOLEAN NOT NULL DEFAULT false,
    "specialistId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'sheet',
    "source" TEXT NOT NULL DEFAULT 'human',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collaboration" (
    "id" TEXT NOT NULL,
    "aId" TEXT NOT NULL,
    "bId" TEXT NOT NULL,
    "projects" INTEGER NOT NULL DEFAULT 0,
    "requestsAnswered" INTEGER NOT NULL DEFAULT 0,
    "conflicts" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collaboration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'render',
    "url" TEXT NOT NULL DEFAULT '',
    "roleDescription" TEXT NOT NULL DEFAULT '',
    "softwareJson" TEXT NOT NULL DEFAULT '[]',
    "areaSqm" INTEGER,
    "budgetEur" INTEGER,
    "durationMonths" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Specialist_accessKey_key" ON "Specialist"("accessKey");

-- CreateIndex
CREATE UNIQUE INDEX "Specialist_email_key" ON "Specialist"("email");

-- CreateIndex
CREATE INDEX "Specialist_status_idx" ON "Specialist"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_clientKey_key" ON "Project"("clientKey");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "ClientMessage_projectId_idx" ON "ClientMessage"("projectId");

-- CreateIndex
CREATE INDEX "DesignDirection_projectId_idx" ON "DesignDirection"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignDirection_projectId_key_key" ON "DesignDirection"("projectId", "key");

-- CreateIndex
CREATE INDEX "MatchRun_projectId_idx" ON "MatchRun"("projectId");

-- CreateIndex
CREATE INDEX "Candidate_runId_discipline_idx" ON "Candidate"("runId", "discipline");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_runId_specialistId_discipline_key" ON "Candidate"("runId", "specialistId", "discipline");

-- CreateIndex
CREATE INDEX "Withdrawal_projectId_idx" ON "Withdrawal"("projectId");

-- CreateIndex
CREATE INDEX "Withdrawal_specialistId_idx" ON "Withdrawal"("specialistId");

-- CreateIndex
CREATE INDEX "TeamSlot_specialistId_idx" ON "TeamSlot"("specialistId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSlot_projectId_discipline_key" ON "TeamSlot"("projectId", "discipline");

-- CreateIndex
CREATE INDEX "Ticket_projectId_status_idx" ON "Ticket"("projectId", "status");

-- CreateIndex
CREATE INDEX "Ticket_specialistId_status_idx" ON "Ticket"("specialistId", "status");

-- CreateIndex
CREATE INDEX "TicketDependency_prerequisiteId_idx" ON "TicketDependency"("prerequisiteId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketDependency_dependentId_prerequisiteId_key" ON "TicketDependency"("dependentId", "prerequisiteId");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Artifact_ticketId_idx" ON "Artifact"("ticketId");

-- CreateIndex
CREATE INDEX "Collaboration_aId_idx" ON "Collaboration"("aId");

-- CreateIndex
CREATE INDEX "Collaboration_bId_idx" ON "Collaboration"("bId");

-- CreateIndex
CREATE UNIQUE INDEX "Collaboration_aId_bId_key" ON "Collaboration"("aId", "bId");

-- CreateIndex
CREATE INDEX "PortfolioItem_specialistId_idx" ON "PortfolioItem"("specialistId");

-- AddForeignKey
ALTER TABLE "ClientMessage" ADD CONSTRAINT "ClientMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignDirection" ADD CONSTRAINT "DesignDirection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRun" ADD CONSTRAINT "MatchRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MatchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSlot" ADD CONSTRAINT "TeamSlot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSlot" ADD CONSTRAINT "TeamSlot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MatchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSlot" ADD CONSTRAINT "TeamSlot_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requestedFromId_fkey" FOREIGN KEY ("requestedFromId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketDependency" ADD CONSTRAINT "TicketDependency_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketDependency" ADD CONSTRAINT "TicketDependency_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_aId_fkey" FOREIGN KEY ("aId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_bId_fkey" FOREIGN KEY ("bId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

