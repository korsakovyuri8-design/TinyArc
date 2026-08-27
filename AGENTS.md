# TinyArc Cloud Bureau — контекст проекта

Прежде чем работать над чем-либо в этом репозитории, прочитай
[`docs/concept.md`](docs/concept.md). Это канонический документ TinyArc Cloud
Bureau: манифест и категория, позиционирование, продуктовая граница, три стадии,
таксономия из двенадцати измерений, логика скоринга, сборка Tiny Team, Blind
Relay Protocol, метрики качества, монетизация, рынок, команда, финансы, пилот,
риски, место в группе.

Решения в нём уже приняты — это не черновик для пересмотра. Если предложение
противоречит документу, сначала скажи об этом, а не переписывай молча.

Ключевое, что ломать нельзя:

- **Команду собирает алгоритм.** Человек нигде не выбирает, кто попадёт в
  команду. Бюро пишет постановку, принимает работу и отвечает перед клиентом —
  но не назначает специалистов (п.7).
- **Это B2C.** Мы полностью заменяем локальное архитектурное бюро, а не
  помогаем ему. Инструмент для бюро — отвергнутая развилка (п.4).
- **Продуктовая граница.** До пяти этажей, зоны лёгкого регулирования,
  Черногория / Сербия / Греция. Граница не двигается раньше первого пилота (п.5).
- **Blind Relay.** Прямых чатов между специалистами не существует — не «не
  рекомендуется», а не реализовано (п.11).
- **Метрики, а не отзывы.** Поля для оценки специалиста нет ни у кого (п.12).
- **Tiny Mansion** в материалах Bureau появляется только как доказательство, что
  команда исполняет. Никогда как клиент и никогда как юзкейс (п.22).

Движок (`src/engine`) не знает ни про базу, ни про React, и покрыт модульными
тестами. Логику отбора правь там и тестом, а не на странице.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
