-- Подрядчики: сеть, из которой собирается короткий список под стройку (п.14б).
--
-- Отдельная таблица, а не роль специалиста. Специалист проектирует и
-- подписывает — за его работу мы отвечаем комплектом; подрядчик строит, и
-- договор на работы заказчик заключает с ним сам.
--
-- Поля оплаченной позиции здесь нет и не будет: заказчик платит за доступ к
-- отбору, подрядчик — за доступ к спросу, но не за место в списке.

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'import',
    "tradesJson" TEXT NOT NULL DEFAULT '[]',
    "jurisdictionsJson" TEXT NOT NULL DEFAULT '[]',
    "municipalitiesJson" TEXT NOT NULL DEFAULT '[]',
    "typologiesJson" TEXT NOT NULL DEFAULT '[]',
    "scaleBandsJson" TEXT NOT NULL DEFAULT '[]',
    "portfolioRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "portfolioUrl" TEXT NOT NULL DEFAULT '',
    "insured" BOOLEAN NOT NULL DEFAULT false,
    "insuredUntil" TIMESTAMP(3),
    "available" BOOLEAN NOT NULL DEFAULT true,
    "deliveredTickets" INTEGER NOT NULL DEFAULT 0,
    "onTimeTickets" INTEGER NOT NULL DEFAULT 0,
    "firstTimeRightTickets" INTEGER NOT NULL DEFAULT 0,
    "responseMinutesTotal" INTEGER NOT NULL DEFAULT 0,
    "revisionRoundsTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_email_key" ON "Contractor"("email");

-- CreateIndex
CREATE INDEX "Contractor_status_idx" ON "Contractor"("status");

