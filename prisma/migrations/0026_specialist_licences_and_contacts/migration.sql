-- Лицензии и живые контакты специалиста.
--
-- Право подписи до сих пор держалось на одной галочке в signsInJson: человек
-- отмечал страну, и движок верил. Это самое дорогое утверждение во всей
-- анкете, ради него бюро и ищет этих людей, и проверять его было нечем.
--
-- Теперь рядом с галочкой лежит номер и орган, который его выдал, а бюро
-- ставит отметку о сверке с реестром руками. Автоматической проверки нет и не
-- планируется: реестры палат не дают программного доступа, а совпадение с
-- шаблоном номера это не проверка.
--
-- Контакты нужны, пока первых людей заводят вручную. Движок их не читает.
ALTER TABLE "Specialist" ADD COLUMN "licencesJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Specialist" ADD COLUMN "licenceStatus" TEXT NOT NULL DEFAULT 'declared';
ALTER TABLE "Specialist" ADD COLUMN "linkedinUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Specialist" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Specialist" ADD COLUMN "phoneWhatsapp" BOOLEAN NOT NULL DEFAULT false;
