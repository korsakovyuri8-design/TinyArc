-- Доступ к подрядчикам: отдельная платная услуга поверх комплекта (п.14б).
--
-- Своей таблицей, а не строкой в счетах за стадии. Счёт за стадию живёт в
-- машинерии стадий: порядок, гейт, подтверждение заказчика, зависимость
-- следующей стадии от этой. У доступа к подрядчикам нет ничего из
-- перечисленного, и положенный в ту же таблицу он однажды попал бы в расчёт
-- «за какую стадию заплачено», то есть открыл или закрыл бы чужую работу.
--
-- Таблица новая, ничего существующего не трогает.
-- CreateTable
CREATE TABLE "BuildAccess" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "basisJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'issued',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "paidNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "BuildAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuildAccess_projectId_key" ON "BuildAccess"("projectId");

-- CreateIndex
CREATE INDEX "BuildAccess_status_issuedAt_idx" ON "BuildAccess"("status", "issuedAt");

-- AddForeignKey
ALTER TABLE "BuildAccess" ADD CONSTRAINT "BuildAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

