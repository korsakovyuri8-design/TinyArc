-- Местные фирмы с правом подписи.
--
-- Подпись нужна не одна на команду, а по каждому разделу, где её требует
-- закон: архитектура, конструкции, инженерные системы. Ставить её может сам
-- участник команды с лицензией в стране проекта или местная проектная фирма,
-- которая проверяет чужую работу и подписывает своими инженерами.
--
-- Таблица новая, ничего существующего не трогает.
-- CreateTable
CREATE TABLE "SigningPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "disciplinesJson" TEXT NOT NULL DEFAULT '[]',
    "registration" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "terms" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SigningPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SigningPartner_jurisdiction_active_idx" ON "SigningPartner"("jurisdiction", "active");
