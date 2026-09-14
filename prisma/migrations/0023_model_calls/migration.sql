-- Учёт обращений к внешним моделям.
--
-- Расход наружу был ограничен по частоте и не считался нигде. Предел частоты
-- защищает от залипшего пальца на кнопке; он не отвечает на вопрос, во что
-- модели обошлись за неделю, — а этот вопрос задают в конце месяца, когда
-- менять что-либо уже поздно.
--
-- Пишется и успех, и отказ: оборванный по потолку ответ оплачен целиком, и не
-- видеть его значит занижать расход всегда в одну сторону.
CREATE TABLE "ModelCall" (
  "id"           TEXT NOT NULL,
  "provider"     TEXT NOT NULL,
  "model"        TEXT NOT NULL,
  "purpose"      TEXT NOT NULL,
  "inputTokens"  INTEGER,
  "outputTokens" INTEGER,
  "outcome"      TEXT NOT NULL,
  "ms"           INTEGER,
  "at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ModelCall_pkey" PRIMARY KEY ("id")
);

-- Единственная выборка: расход за период.
CREATE INDEX "ModelCall_at_idx" ON "ModelCall" ("at");
