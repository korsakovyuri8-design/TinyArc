-- Индексы под очереди панели бюро.
--
-- Все три запроса шли перебором таблицы целиком с сортировкой во временном
-- дереве: очередь счетов — по всем счетам за всю историю, журнал писем — по
-- всем письмам, а письма не удаляются никогда, очередь вопросов — по всей
-- переписке с заказчиками. Проверено планом запроса на базе в четыреста тысяч
-- писем: SCAN + USE TEMP B-TREE FOR ORDER BY.

-- CreateIndex
CREATE INDEX "Invoice_status_paidAt_idx" ON "Invoice"("status", "paidAt");

-- CreateIndex
CREATE INDEX "Notification_sentAt_idx" ON "Notification"("sentAt");

-- CreateIndex
CREATE INDEX "ClientMessage_authorRole_answeredAt_idx" ON "ClientMessage"("authorRole", "answeredAt");
