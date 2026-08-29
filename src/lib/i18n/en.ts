/**
 * Английский словарь.
 *
 * Не перевод русского слово в слово, а тот же смысл на языке, для которого он
 * пишется. Продукт держится на голосе: короткая фраза, названная причина,
 * никакого маркетингового шума. Дословный перевод такого текста звучит как
 * подстрочник и обесценивает ровно то, ради чего он написан.
 *
 * Ключ — русская фраза целиком. Почему так, а не идентификаторы, объяснено в
 * `index.ts`.
 */
export const en: Record<string, string> = {
  // --- Шапка и подвал ---
  'Как это работает': 'How it works',
  Алгоритм: 'Algorithm',
  Бриф: 'Brief',
  Специалистам: 'For specialists',
  Вход: 'Sign in',
  'Три стадии': 'Three stages',
  'Демонстрация алгоритма': 'See the algorithm',
  'Вступить в пул': 'Join the pool',
  'Публичная оферта': 'Terms of service',
  'Обработка данных': 'Data processing',
  'Проект в составе TinyArc Group. Отдельный венчур, финансово и структурно отделённый от других проектов группы.':
    'Part of TinyArc Group. A separate venture, financially and structurally independent of the group’s other projects.',

  // --- Вход ---
  'По ключу': 'With your key',
  'Регистрации как отдельного действия здесь нет. Клиент получает ключ после брифа, специалист — после того, как заявку подтвердили.':
    'There is no separate sign-up step. Clients get a key after submitting a brief; specialists get one once their application is approved.',
  'Ключ доступа': 'Access key',
  'Клиенту он пришёл после брифа, специалисту — после подтверждения заявки':
    'Sent to clients after the brief, to specialists after approval',
  'brief-… или spec-…': 'brief-… or spec-…',
  Войти: 'Sign in',
  'Нет ключа и есть участок → оставить бриф': 'No key, but you own a plot → submit a brief',
  'Нет ключа и вы специалист → подать заявку': 'No key, and you are a specialist → apply',
  'Вход для бюро': 'Bureau sign-in',
}
