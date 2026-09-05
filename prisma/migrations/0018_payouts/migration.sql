-- Вторая сторона денег: гонорар и реестр обязательств.
--
-- У бюро была только выручка. Концепт называет гонорар специалиста одной
-- фразой — «с гонорара комиссия не берётся», — а в продукте его не было ни
-- полем, ни записью, поэтому валовая маржа не считалась не из-за
-- недостающего экрана, а из-за недостающего слагаемого.
--
-- Обе таблицы новые, ничего существующего не трогают.
--
-- `Payout.amount` допускает NULL намеренно: незаданная ставка — это «не
-- задано», а не ноль. Ноль означал бы бесплатную работу, то есть маржу,
-- равную всей цене стадии, и ошибка эта всегда в одну сторону.
-- CreateTable
CREATE TABLE "PayoutRate" (
    "id" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'accrued',
    "accruedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "paidNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRate_discipline_stage_key" ON "PayoutRate"("discipline", "stage");

-- CreateIndex
CREATE INDEX "Payout_status_accruedAt_idx" ON "Payout"("status", "accruedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_projectId_specialistId_discipline_stage_key" ON "Payout"("projectId", "specialistId", "discipline", "stage");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

