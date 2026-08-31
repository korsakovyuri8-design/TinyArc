-- Окна ограничителя частоты переезжают из памяти процесса в базу.
--
-- В памяти они жили честно и временно: при двух инстансах окно у каждого своё,
-- и предел молча умножается на их число, а перезапуск контейнера обнуляет
-- накопленное — на бесплатном плане он случается сам по себе.

-- CreateTable
CREATE TABLE "RateWindow" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateWindow_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateWindow_resetAt_idx" ON "RateWindow"("resetAt");
