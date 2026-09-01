-- Нормы въезжают в продукт: правила юрисдикции и вход для их проверки.
--
-- Поля участка на проекте заполняются в два приёма, и это устройство предмета,
-- а не недоделка. Муниципалитет, зону и площадь участка знает владелец — они в
-- его бумагах. Пятно застройки, высоту, отступы, парковку и озеленение знает
-- проект: их не существует, пока никто не спроектировал. Поэтому на брифе
-- проверяются этажность и плотность, а посадка — после концепции.
--
-- Правило принадлежит области, а не стране: страна → муниципалитет → зона.
-- Первоисточник и дата сверки обязательны — правило без них нечем защитить
-- перед органом и нечем перепроверить, когда норма изменится.

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "footprintSqm" INTEGER,
ADD COLUMN     "greenSqm" INTEGER,
ADD COLUMN     "heightM" DOUBLE PRECISION,
ADD COLUMN     "municipality" TEXT,
ADD COLUMN     "parkingSpaces" INTEGER,
ADD COLUMN     "plotAreaSqm" INTEGER,
ADD COLUMN     "setbackFrontM" DOUBLE PRECISION,
ADD COLUMN     "setbackRearM" DOUBLE PRECISION,
ADD COLUMN     "setbackSideM" DOUBLE PRECISION,
ADD COLUMN     "units" INTEGER,
ADD COLUMN     "zone" TEXT;

-- CreateTable
CREATE TABLE "ComplianceRule" (
    "id" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "municipality" TEXT,
    "zone" TEXT,
    "subject" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "document" TEXT NOT NULL,
    "article" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceRule_jurisdiction_municipality_zone_idx" ON "ComplianceRule"("jurisdiction", "municipality", "zone");

