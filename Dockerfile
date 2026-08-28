# syntax=docker/dockerfile:1

# --- сборка -----------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Компилятор нужен здесь и только здесь: better-sqlite3 приходит
# peer-зависимостью Prisma и собирается через node-gyp. В боевую стадию он
# уезжает уже собранным, поэтому там ни компилятора, ни установки не нужно.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Полная установка: TypeScript держит свой компилятор в необязательных
# зависимостях, и --omit=optional уносит его вместе с SQLite.
RUN npm ci

COPY . .

# Схему выбирает DATABASE_URL. Подключения на сборке не происходит — значение
# имеет только буква провайдера, поэтому здесь стоит заведомо нерабочий адрес.
ENV DATABASE_URL="postgresql://build@build/build"
RUN npx prisma generate && npx next build

# Выкидываем dev-зависимости здесь же. Нативные модули к этому моменту уже
# собраны, и боевой стадии не придётся ставить их заново.
RUN npm prune --omit=dev

# --- боевой образ -----------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# OpenSSL нужен не приложению, а Prisma: без него она не определяет версию
# libssl и лезет докачивать движок — уже под пользователем без прав на запись.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Владелец сразу тот, кто будет работать. Отдельный `chown -R` переписал бы
# все зависимости в новый слой и удвоил образ.
COPY --chown=node:node package.json package-lock.json ./
# Установки здесь нет: зависимости приезжают собранными из сборочной стадии.
COPY --chown=node:node --from=build /app/node_modules ./node_modules

# public/ пуст и держится файлом-заглушкой. Каталог существует не ради
# содержимого, а ради этой строки: убрать её — значит однажды положить туда
# favicon и не понять, почему в образе его нет.
COPY --chown=node:node public ./public
COPY --chown=node:node src ./src
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node next.config.ts prisma.config.ts tsconfig.json ./

# Сборка и сгенерированный клиент — последними: клиент собран под Postgres, и
# перезаписать его исходным деревом было бы легко и незаметно.
COPY --chown=node:node --from=build /app/.next ./.next
COPY --chown=node:node --from=build /app/src/generated ./src/generated

# Docker не выставляет HOME при смене пользователя, а команда запуска вызывает
# npx. Без своего каталога npm полез бы писать кэш в чужой домашний.
ENV HOME=/home/node
ENV NPM_CONFIG_CACHE=/home/node/.npm
USER node

EXPOSE 3000
CMD ["sh", "./scripts/start.sh"]
