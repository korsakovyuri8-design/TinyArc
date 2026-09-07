-- Ставку называет специалист, бюджет проекта — гейт, а не балл.
--
-- `SpecialistRate` — собственная цена человека, отдельно от `PayoutRate`,
-- которая остаётся умолчанием бюро для тех, кто своей не назвал. Переписывать
-- чужую ставку бюро не вправе: гонорар — его деньги, а не наша политика.
--
-- `Setting` — числа, задающие политику, а не описывающие факт. Первое из них
-- (доля стадии, идущая команде) по умолчанию не задано, и пока не задано,
-- бюджетного гейта не существует вовсе.
--
-- Обе таблицы новые, ничего существующего не трогают.
-- CreateTable
CREATE TABLE "SpecialistRate" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialistRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "SpecialistRate_discipline_stage_idx" ON "SpecialistRate"("discipline", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistRate_specialistId_discipline_stage_key" ON "SpecialistRate"("specialistId", "discipline", "stage");

-- AddForeignKey
ALTER TABLE "SpecialistRate" ADD CONSTRAINT "SpecialistRate_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

