-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "liveStage" TEXT;

-- Дозаполнение: у выставленных и оплаченных счетов liveStage совпадает со
-- стадией, у отозванных остаётся пустым. Без этого шага уже существующие
-- счета вышли бы из-под уникальности, и следующая приёмка выставила бы
-- второй счёт за ту же стадию.
UPDATE "Invoice" SET "liveStage" = "stage" WHERE "status" <> 'void';

-- DropIndex
DROP INDEX "Invoice_projectId_stage_key";

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_projectId_liveStage_key" ON "Invoice"("projectId", "liveStage");
