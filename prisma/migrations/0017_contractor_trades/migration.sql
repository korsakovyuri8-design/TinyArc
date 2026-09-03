-- Работа подрядчика переезжает из строки JSON в свою таблицу.
--
-- Замерено, а не предположено: короткий список собирается по одной работе, и
-- выборка по подстроке в JSON — это полный проход по сети страны. Тридцать
-- тысяч подрядчиков в одной юрисдикции давали 1163 мс на карточке проекта
-- против 13 мс на пустой сети; правила рядом держались за 4 мс, потому что у
-- них путь доступа проиндексирован.
--
-- Данных в бою нет: таблица подрядчиков появилась предыдущей миграцией и
-- заполняется только сидом и формой бюро. Поэтому колонка снимается, а не
-- переносится, — двойной источник правды здесь дороже, чем перезаполнение.

-- AlterTable
ALTER TABLE "Contractor" DROP COLUMN "tradesJson";

-- CreateTable
CREATE TABLE "ContractorTrade" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "trade" TEXT NOT NULL,

    CONSTRAINT "ContractorTrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractorTrade_trade_idx" ON "ContractorTrade"("trade");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorTrade_contractorId_trade_key" ON "ContractorTrade"("contractorId", "trade");

-- AddForeignKey
ALTER TABLE "ContractorTrade" ADD CONSTRAINT "ContractorTrade_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

