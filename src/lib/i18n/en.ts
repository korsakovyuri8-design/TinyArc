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

  // --- Метки таксономии ---
  //
  // Видны везде: в брифе, в кабинете, в письмах, в разборе балла. Переводятся
  // один раз здесь, а не в каждом месте показа.
  Архитектура: 'Architecture',
  Конструкции: 'Structures',
  'Инженерия (MEP)': 'MEP',
  Ландшафт: 'Landscape',
  Интерьеры: 'Interiors',
  Согласования: 'Permitting',
  Геодезия: 'Survey',
  Визуализация: 'Visualisation',
  'Сметы и объёмы': 'Cost and quantities',
  'Технология изготовления и сборки': 'Design for manufacture and assembly',
  Энергоэффективность: 'Energy performance',

  'Монолит и железобетон': 'Cast-in-place and reinforced concrete',
  'Металл и ЛСТК': 'Steel and light-gauge framing',
  'Дерево, каркас, CLT': 'Timber, framing, CLT',
  'Отопление, вентиляция, кондиционирование': 'Heating, ventilation, air conditioning',
  'Электрика и освещение': 'Electrical and lighting',
  'Водоснабжение и канализация': 'Water supply and drainage',
  'Автономные системы': 'Off-grid systems',
  'Умный дом': 'Home automation',
  'Малые формы и модульное': 'Small-scale and modular',
  'Городская застройка': 'Urban-scale development',
  'Сад и благоустройство': 'Garden and grounds',
  'Генплан территории': 'Site master planning',
  'Вертикальная планировка и дренаж': 'Grading and drainage',
  'Жилые интерьеры': 'Residential interiors',
  'Встроенная мебель и предметный дизайн': 'Built-in furniture and product design',
  'Общественные пространства': 'Public and hospitality spaces',
  Фотореализм: 'Photorealistic',
  'Атмосферная подача': 'Atmospheric',
  'Проверка зонирования': 'Zoning review',
  'Согласования по риску подтопления': 'Flood-risk approvals',

  'Ровный участок': 'Flat site',
  Склон: 'Slope',
  'Риск подтопления': 'Flood risk',
  'Городские сети': 'Utility connections',
  Автономно: 'Off-grid',

  Свободен: 'Available',
  Частично: 'Part-time',
  Занят: 'Booked',

  'Модель / DWG': 'Model / DWG',
  Чертёж: 'Drawing',
  'Расчёт или записка': 'Calculation or report',

  Вилла: 'Villa',
  Монолит: 'Concrete',
  Кладка: 'Masonry',
  Дерево: 'Timber',
  Сталь: 'Steel',
  Гибрид: 'Hybrid',

  Средиземноморская: 'Mediterranean',
  Континентальная: 'Continental',
  Альпийская: 'Alpine',
  Засушливая: 'Arid',

  'нет обмена': 'no exchange',
  импорт: 'import',
  обмен: 'exchange',
  координация: 'coordination',

  Концепция: 'Concept',
  Разрешение: 'Permit',
  Тендер: 'Tender',
  'Рабочая документация': 'Construction documentation',

  'Лёгкое регулирование': 'Light regulation',
  'Стандартное регулирование': 'Standard regulation',

  Удалённо: 'Remote',

  'Ждёт зависимости': 'Waiting on a dependency',
  'Открыт, не взят': 'Open, unclaimed',
  'В работе': 'In progress',
  Предъявлен: 'Submitted',
  'Возвращён на круг': 'Sent back for revision',
  Принят: 'Accepted',

  'Бриф принят': 'Brief accepted',
  'Вне продуктовой границы': 'Outside the product boundary',
  'Команда собрана': 'Team assembled',
  'Идёт выпуск': 'In production',
  Закрыт: 'Closed',

  'Приглашён, профиль не заполнен': 'Invited, profile incomplete',
  'Заявка на разборе': 'Application under review',
  'В пуле': 'In the pool',
  'Снят по своей просьбе': 'Paused at their request',
  'Не прошёл порог портфолио': 'Below the portfolio threshold',

  'Дисциплина не закрыта': 'A discipline is uncovered',
  'Нет права подписи в юрисдикции': 'No signing rights in this jurisdiction',
  'Проект вне продуктовой границы': 'Project is outside the product boundary',

  'Доступа нет': 'No access',
  'Бесплатно на пилоте': 'Free during the pilot',
  'Платный доступ': 'Paid access',

  // --- Страны и языки ---
  //
  // Живут в таксономии, а не в метках: движок сравнивает по ним, а не только
  // показывает. Перевод всё равно нужен здесь — человек читает их в форме.
  Черногория: 'Montenegro',
  Сербия: 'Serbia',
  Греция: 'Greece',
  английский: 'English',
  сербский: 'Serbian',
  черногорский: 'Montenegrin',
  греческий: 'Greek',
  русский: 'Russian',

  // --- Бриф ---
  Проект: 'Project',
  'Условия работы': 'Working conditions',
  Контакт: 'Contact',
  Название: 'Name',
  'Вилла в Тивате': 'Villa in Tivat',
  Типология: 'Typology',
  Этажей: 'Storeys',
  'Bureau ведёт здания до N этажей': 'Bureau takes buildings up to N storeys',
  'Площадь, м²': 'Floor area, m²',
  Страна: 'Country',
  'Климатическая зона': 'Climate zone',
  'Материальная система': 'Structural system',
  'Регуляторный трек': 'Regulatory track',
  'Bureau работает в зонах лёгкого регулирования': 'Bureau works in light-regulation zones',
  'Стадия документации': 'Documentation stage',
  Участок: 'Site',
  'Склон требует вертикальной планировки, подтопление — отдельных согласований':
    'A slope requires grading design; flood risk requires separate approvals',
  Сети: 'Utilities',
  'Автономка — это другая инженерия, а не та же со звёздочкой':
    'Off-grid is different engineering, not the same engineering with a footnote',
  Софт: 'Software',
  'Справочно: отметьте, если у вас уже есть модель от прежнего подрядчика. Состав команды это не ограничивает — команда сама сходится на одном пакете':
    'For reference only: tick this if you already have a model from a previous consultant. It does not constrain the team — the team converges on one package by itself',
  Языки: 'Languages',
  'На чём вам удобно разговаривать': 'What you are comfortable working in',
  'Занятость, ч/нед': 'Workload, h/week',
  'Сколько времени специалиста нужно проекту': 'How much of a specialist’s time the project needs',
  'Горизонт, дней': 'Start within, days',
  'За сколько дней команда должна выйти на задачу': 'How soon the team must start work',
  'Как к вам обращаться': 'How to address you',
  Почта: 'Email',
  'Ключ доступа к кабинету придёт сюда': 'Your access key will be sent here',
  'Что важно знать про участок': 'What matters about the site',
  'Команде это выдаётся в объёме задачи, а не целиком':
    'The team sees this scoped to their task, not in full',
  'Собрать команду': 'Assemble the team',
  'Движок посчитает сразу — без «мы с вами свяжемся»':
    'The engine answers immediately — no “we’ll get back to you”',
  'Считаем…': 'Working…',

  'Бриф проекта': 'Project brief',
  'Стадия 01 · Filter': 'Stage 01 · Filter',
  'Чем точнее вход, тем меньше в отборе догадок. Ни одно поле здесь не про вкус — всё это измерения, по которым движок считает.':
    'The sharper the input, the less the selection has to guess. Nothing here is a matter of taste — every field is a dimension the engine computes on.',
  'Опишите проект. Движок проверит его на продуктовую границу, отберёт специалистов по двенадцати измерениям и соберёт команду.':
    'Describe your project. The engine checks it against the product boundary, ranks specialists across twelve dimensions and assembles the team.',

  // --- Согласие ---
  'Я прочитал и принимаю': 'I have read and accept the',
  'публичную оферту': 'terms of service',
  и: 'and the',
  'политику обработки данных': 'data processing policy',
  'в редакции': ', revision',
  'Без согласия с офертой и политикой данных заявку принять нельзя':
    'We cannot accept a submission without agreement to the terms and the data policy',

  // --- Главная ---
  // Неразрывный пробел здесь настоящим символом, а не сущностью: JSX
  // раскрывает `&nbsp;` в тексте разметки, но не внутри строкового литерала —
  // обернув фразу в t(), я получил шесть видимых символов в заголовке.
  'Бюро, которое заканчивает бюро': 'The bureau that ends the bureau',
  'Мы не помогаем локальному архитектурному бюро. Мы занимаем его место: берём бриф, собираем команду алгоритмом и отдаём пакет документации.':
    'We do not assist the local architectural practice. We take its place: we take the brief, assemble the team algorithmically and deliver the documentation set.',
  'Оставить бриф': 'Submit a brief',
  'Посмотреть, как выбирает алгоритм': 'See how the algorithm chooses',
  этажей: 'storeys',
  'Продуктовая граница: зоны лёгкого регулирования':
    'Product boundary: light-regulation zones',
  порог: 'threshold',
  'Ниже порога по портфолио специалист не проходит':
    'Below the portfolio threshold a specialist does not pass',
  страны: 'countries',

  Проблема: 'The problem',
  'Локальное бюро — это не компетенция, это дефицит доступа':
    'The local practice is not expertise. It is a shortage of access',
  'Владелец участка платит за то, что у бюро есть люди, а у него — нет. Отбор идёт по записной книжке партнёра, координация стоит как офис, а качество специалиста измеряется репутацией на глаз.':
    'The plot owner pays because the practice has people and they do not. Selection runs off a partner’s address book, coordination costs as much as an office, and a specialist’s quality is measured by reputation, by eye.',
  'Мы разбираем этот дефицит: пул глобальный, отбор алгоритмический, координация протокольная.':
    'We dismantle that shortage: the pool is global, selection is algorithmic, coordination is protocol.',

  'Бриф становится требованиями, пул отсекается жёсткими гейтами':
    'The brief becomes requirements; hard gates cut the pool down',
  'Выжившие ранжируются по Quality × Availability, собирается Tiny Team':
    'Survivors are ranked on Quality × Availability; the Tiny Team is assembled',
  'Команда ведёт проект по Blind Relay Protocol до пакета документации':
    'The team runs the project on the Blind Relay Protocol through to the documentation set',
  'Подробно про каждую стадию →': 'Each stage in detail →',

  Отбор: 'Selection',
  'Умножение, а не сумма. Отличный специалист без свободной ёмкости бесполезен проекту с датой: сумма позволила бы качеству компенсировать недоступность, произведение — нет.':
    'A product, not a sum. An excellent specialist with no free capacity is useless to a project with a date: a sum would let quality compensate for unavailability, a product will not.',
  'По каждому специалисту клиент видит разбор балла целиком: рейтинг портфолио, вклад метрик поставки, соответствие проекту, фактор доступности.':
    'For every specialist the client sees the full score breakdown: portfolio rating, the weight of delivery metrics, fit to the project, availability factor.',
  'Открыть демонстрацию': 'Open the demonstration',
  'Двенадцать измерений таксономии': 'Twelve dimensions of the taxonomy',

  'Специалисты не разговаривают друг с другом': 'Specialists do not talk to each other',
  'Никаких прямых чатов. Только комментарии на уровне тикета задачи. Стадийные гейты по зависимостям: тикет не открывается, пока не приняты те, от которых он зависит.':
    'No direct chats. Comments live on the task ticket and nowhere else. Stage gates follow dependencies: a ticket does not open until the ones it depends on are accepted.',
  'Защита от обхода': 'No route around us',
  'Прямой контакт между специалистами — готовый канал увести проект мимо бюро. Нет канала — нет утечки.':
    'Direct contact between specialists is a ready-made channel for taking the project elsewhere. No channel, no leak.',
  'Чистота метрик': 'Clean metrics',
  'Когда договорённости живут в личных чатах, время отклика и долю переделок посчитать нечем. Тикет — единственное измеримое место.':
    'When agreements live in private chats, there is nothing to compute response time or rework share from. The ticket is the only measurable place.',
  'Дисциплина зависимостей': 'Dependency discipline',
  'Гейты заставляют фиксировать, что именно передано дальше, вместо «мы устно договорились».':
    'Gates force a record of exactly what was handed on, instead of “we agreed verbally”.',

  'Два пути': 'Two ways in',
  'Клиент или специалист': 'Client or specialist',
  Клиент: 'Client',
  'У меня участок': 'I own a plot',
  'Опишите проект. Движок проверит его на продуктовую границу и соберёт команду.':
    'Describe the project. The engine checks it against the product boundary and assembles the team.',
  Специалист: 'Specialist',
  'Я веду разделы': 'I deliver design sections',
  'Подать заявку': 'Apply',
  'Заявка с двенадцатью измерениями. Порог по портфолио — N/10.':
    'An application across twelve dimensions. Portfolio threshold: N/10.',

  Дисциплина: 'Discipline',
  Масштаб: 'Scale',
  Этажность: 'Storey count',
  'Юрисдикция и право подписи': 'Jurisdiction and signing rights',
  'Софт и уровень обмена по IFC': 'Software and IFC exchange level',
  'Язык с клиентом и с органами': 'Language with the client and the authorities',
  'Режим работы и ёмкость': 'Working mode and capacity',

  // --- Метаданные ---
  'TinyArc Cloud Bureau — AI-native архитектурное бюро':
    'TinyArc Cloud Bureau — an AI-native architectural practice',
  'Бюро, которое заканчивает бюро. Алгоритм отбирает специалистов по фактам, собирает команду под проект и ведёт её до пакета документации. Здания до пяти этажей в Черногории, Сербии и Греции.':
    'The bureau that ends the bureau. An algorithm selects specialists on facts, assembles a team for the project and runs it through to the documentation set. Buildings up to five storeys in Montenegro, Serbia and Greece.',
}
