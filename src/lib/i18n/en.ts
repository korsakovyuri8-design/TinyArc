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
  'Bureau ведёт здания до {n} этажей': 'Bureau takes buildings up to {n} storeys',
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
  'Заявка с двенадцатью измерениями. Порог по портфолио — {threshold}/10.':
    'An application across twelve dimensions. Portfolio threshold: {threshold}/10.',

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

  // --- Кабинет заказчика ---
  'Кабинет проекта': 'Project workspace',
  'Сохраните ключ доступа': 'Save your access key',
  'Ключ заменяет пароль: по нему вы вернётесь в кабинет с любого устройства. Копия ушла на {email} — но если письмо не дойдёт, останется только этот экран.':
    'The key replaces a password: it gets you back into this workspace from any device. A copy went to {email} — but if that email never arrives, this screen is all there is.',
  'Проект не берётся': 'We are not taking this project',
  'Проект закрыт': 'Project closed',
  'Комплект у вас': 'The set is yours',
  'Все стадии выпущены и подтверждены вами. Файлы ниже — то, за чем вы приходили. Доступ по ключу остаётся: кабинет не закрывается вместе с проектом, и вернуться к документации можно когда угодно.':
    'Every stage has been issued and confirmed by you. The files below are what you came for. Your key keeps working: the workspace does not close with the project, and you can come back to the documentation whenever you need it.',
  'Направление проекта ещё не выбрано.': 'No design direction has been chosen yet.',
  'Выбрать →': 'Choose →',

  'Где сейчас проект': 'Where the project stands',
  'Стадия закрывается, когда приняты все её задачи. Пропустить стадию нельзя: гейт просто не откроет следующую.':
    'A stage closes once every task in it is accepted. Stages cannot be skipped: the gate simply will not open the next one.',
  'Стадия закрыта': 'Stage closed',
  'Идёт работа': 'In progress',
  'Ждёт оплаты': 'Awaiting payment',
  'Ждёт предыдущей стадии': 'Waiting on the previous stage',

  'Ваша Tiny Team': 'Your Tiny Team',
  'Состав собран движком. Ниже — разбор балла по каждому: рейтинг портфолио, вклад метрик поставки, соответствие проекту, фактор доступности.':
    'The engine assembled this team. Below is the full score breakdown for each member: portfolio rating, the weight of delivery metrics, fit to the project, availability factor.',
  подпись: 'signatory',
  'Как считался отбор': 'How the selection was computed',
  'Пул → прошли гейты': 'Pool → passed the gates',

  Выпуск: 'Production',
  'Тикет открывается, только когда приняты те, от которых он зависит. Специалисты между собой не переписываются — вся работа идёт через бюро.':
    'A ticket opens only once the tickets it depends on are accepted. Specialists do not correspond with each other — all work goes through the bureau.',
  Стадия: 'Stage',
  Задача: 'Task',
  Исполнитель: 'Assignee',
  Состояние: 'State',

  'Комплект документации': 'Documentation set',
  'Собирается по мере закрытия стадий, а не выдаётся разом в конце: вы заплатили за стадию — вы получаете её файлы, когда она закрыта. Сгенерированные изображения сюда не входят ни на одной стадии, это материал работы, а не документация.':
    'It builds up as stages close rather than arriving all at once at the end: you paid for a stage, you get its files when that stage closes. Generated images never form part of it at any stage — they are working material, not documentation.',
  'подтверждена вами': 'confirmed by you',
  'ждёт вашего подтверждения': 'awaiting your confirmation',

  Счета: 'Invoices',
  'Стадия оплачивается до начала работы по ней. Команда — живые люди, и их время начинается в тот момент, когда открывается задача; начинать стадию в долг бюро не вправе. Цена названа целиком заранее и не пересчитывается по ходу: под каждым счётом видно, из чего он сложился.':
    'A stage is paid for before work on it begins. The team are real people, and their time starts the moment a task opens; the bureau is not entitled to begin a stage on credit. The price is stated in full up front and is not recalculated along the way: under every invoice you can see what it is made of.',
  Оплачен: 'Paid',
  Отозван: 'Voided',
  'Куда платить': 'Where to pay',
  'Реквизиты для оплаты ещё не опубликованы — бюро пришлёт их письмом.':
    'Payment details have not been published yet — the bureau will send them by email.',
  'Отметку об оплате ставит бюро, увидев поступление: приёма платежей на сайте нет, и делать вид, что есть, значило бы обещать сверку, которой не существует.':
    'The bureau marks an invoice paid once it sees the money arrive: there is no payment processing on this site, and pretending otherwise would promise a reconciliation that does not exist.',
  'Нижняя граница чека за эту стадию — {floor} {currency}. По площади вышло бы меньше, но посадка на участок, согласования и координация команды на маленьком объекте стоят почти столько же, сколько на большом.':
    'The floor price for this stage is {floor} {currency}. By area it would come out lower, but siting, approvals and team coordination on a small building cost almost as much as on a large one.',
  'за общие системы дома': 'for shared building systems',
  'по уровню цен страны': 'for the country’s price level',

  'Ждёт вашего подтверждения': 'Awaiting your confirmation',
  'Бюро приняло все задачи этой стадии — это значит «сделано как заказано». Подтверждение с вашей стороны значит другое: «заказано было именно это». Пока его нет, следующая стадия не начинается.':
    'The bureau has accepted every task in this stage — that means “done as specified”. Your confirmation means something else: “this is what was specified”. Until it arrives, the next stage does not start.',
  'Вы подтвердили': 'You have confirmed',
  'Команда работает по подтверждённому. Если что-то нужно изменить задним числом — напишите бюро: переделка на поздней стадии стоит дороже, и решать, как её провести, будем вместе.':
    'The team is working to what you confirmed. If something has to change after the fact, write to the bureau: rework at a later stage costs more, and how to handle it is a decision we make together.',

  'Разговор с бюро': 'Talking to the bureau',
  'Сроки, участок, изменившиеся обстоятельства — всё это сюда. Бюро отвечает перед вами за проект целиком, и вопрос по проекту — это вопрос к нему.':
    'Deadlines, the site, changed circumstances — all of it goes here. The bureau answers to you for the project as a whole, and a question about the project is a question for the bureau.',

  'Команда пока не собрана': 'The team is not assembled yet',
  'Состав под ваш проект не сошёлся. Бюро разбирается; ключ доступа у вас, по нему вы вернётесь в проект.':
    'A team for your project did not come together. The bureau is looking into it; you have your key and can come back to the project with it.',
  'Специалисты под ваш проект есть, но ни у кого из них нет права подписи в стране «{country}». Пакет документации без местной подписи не имеет силы — его не примут в органах, и браться за проект без неё значит продать вам бумагу. Бюро ищет подписанта; ключ доступа у вас, по нему вы вернётесь в проект.':
    'There are specialists for your project, but none of them holds signing rights in {country}. A documentation set without a local signature has no force — the authorities will not accept it, and taking the project on without one would mean selling you paper. The bureau is looking for a signatory; you have your key and can come back to the project with it.',

  'Этажей / площадь': 'Storeys / area',

  // --- Направление проекта ---
  'Направление проекта': 'Design direction',
  схема: 'diagram',
  'Ваш выбор. Ориентир для команды — не проектное решение и не часть комплекта документации.':
    'Your choice. A reference point for the team — not a design decision and not part of the documentation set.',
  'Выбрано клиентом до начала работ. Это ориентир, а не требование: если направление на этом участке нереализуемо, скажите об этом в тикете.':
    'Chosen by the client before work began. A reference point, not a requirement: if the direction cannot be built on this site, say so in the ticket.',

  // --- Разбор балла ---
  Портфолио: 'Portfolio',
  'Поставка · вес {percent}%': 'Delivery · weight {percent}%',
  'Истории поставок нет — Quality это портфолио':
    'No delivery history yet — Quality is the portfolio',
  'Соответствие проекту': 'Fit to the project',
  Доступность: 'Availability',
  'Совпадение с проектом': 'Match with the project',

  // --- Названия задач ---
  //
  // Приходят из матрицы задач в движке и лежат в базе строкой. Переводятся тем
  // же словарём: набор фиксирован кодом, а не введён человеком.
  'Посадка на участок и пятно застройки': 'Siting and building footprint',
  'Объёмно-планировочное решение': 'Massing and spatial layout',
  'Черновые планировки этажей': 'Draft floor plans',
  'Проверка конструктивной осуществимости объёма': 'Structural feasibility check of the massing',
  'Место под оборудование, шахты и вводы': 'Space for plant, risers and service entries',
  'Схема организации участка': 'Site organisation plan',
  'Функциональная схема общественной части': 'Functional plan of the public areas',
  'Визуализация экстерьера': 'Exterior visualisation',
  'Ключевой кадр интерьера': 'Key interior view',
  'Топографическая съёмка участка': 'Topographic survey',
  'Отчёт по грунтам': 'Geotechnical report',
  'Планы этажей': 'Floor plans',
  Фасады: 'Elevations',
  Разрезы: 'Sections',
  'Пояснительная записка': 'Design and access statement',
  'Конструктивная схема': 'Structural scheme',
  'Расчёт нагрузок': 'Load calculations',
  Фундамент: 'Foundations',
  'Отопление и вентиляция': 'Heating and ventilation',
  'Схема благоустройства': 'Landscape layout',
  'Планировочное решение интерьеров': 'Interior layout',
  'Проверка зонирования участка': 'Site zoning review',
  'Комплектование пакета': 'Assembling the submission set',
  'Подача и сопровождение': 'Submission and follow-through',
  'Теплотехнический расчёт ограждающих конструкций': 'Thermal calculation of the building envelope',
  'Элаборат энергоэффективности': 'Energy performance report',
  'Спецификация отделки': 'Finishes schedule',
  'Ведомость проёмов': 'Door and window schedule',
  'Ведомость материалов и объёмов': 'Materials and quantities schedule',
  'Спецификация оборудования': 'Equipment schedule',
  'Сводная ведомость объёмов работ': 'Consolidated bill of quantities',
  'Сметный расчёт по разделам': 'Cost estimate by section',
  'Рабочие планы': 'Working plans',
  'Узлы и детали': 'Junctions and details',
  'Рабочие чертежи конструкций': 'Structural working drawings',
  Армирование: 'Reinforcement',
  'Рабочие схемы сетей': 'Services working drawings',
  'Чертежи изготовления элементов': 'Fabrication drawings',
  'Схема монтажа и узлы стыковки': 'Erection sequence and connection details',
  'Рабочая документация интерьеров': 'Interior working drawings',

  // --- Направления проекта ---
  Террасирование: 'Terracing',
  'Врезка в склон': 'Cut into the slope',
  'Поднятый уровень': 'Raised level',
  'Внутренний двор': 'Courtyard',
  Павильоны: 'Pavilions',
  'Компактный объём': 'Compact volume',
  'Линейный объём': 'Linear volume',
  'Ступенчатая этажность': 'Stepped storeys',

  // --- Описания направлений ---
  //
  // Тоже константы движка: их девять, набор фиксирован, и клиенту они
  // показываются на самом видном месте кабинета.
  'Объём разбит на уровни, каждый следует линии склона. Здание читается как продолжение рельефа, а не как поставленный на него предмет.':
    'The volume is broken into levels, each following the line of the slope. The building reads as a continuation of the terrain rather than an object set down on it.',
  'Больше подпорных конструкций и сложнее гидроизоляция. Каждый уровень требует своей отметки и своего входа.':
    'More retaining structures and harder waterproofing. Every level needs its own datum and its own entrance.',
  'Часть объёма уходит в землю, кровля становится эксплуатируемой площадкой. Со стороны подъезда здание почти не читается.':
    'Part of the volume goes into the ground and the roof becomes usable terrace. From the approach the building is barely legible.',
  'Дорогая гидроизоляция и вентиляция заглублённой части. Инсоляция помещений в грунте требует отдельного решения.':
    'Expensive waterproofing and ventilation for the buried part. Daylight to the below-grade rooms needs a solution of its own.',
  'Основной объём поднят над землёй на опорах, нижний уровень остаётся открытым или техническим.':
    'The main volume is lifted on supports; the lower level stays open or serves as plant space.',
  'Сложнее теплотехника перекрытия над улицей, дороже вертикальные связи. Зато участок под зданием остаётся проницаемым.':
    'Harder thermal performance for the slab over open air and costlier vertical circulation. In exchange, the ground under the building stays permeable.',
  'Объём обёрнут вокруг закрытого двора. Приватность обеспечивается планировкой, а не забором и не расстоянием до соседа.':
    'The volume wraps a closed courtyard. Privacy comes from the plan, not from a fence or from distance to the neighbour.',
  'Больше наружных стен на ту же площадь и, соответственно, теплопотерь. Требует участка, где двор помещается.':
    'More external wall for the same floor area, and heat loss to match. It needs a site the courtyard actually fits on.',
  'Объём разобран на несколько связанных частей вместо одного тела. Функции разведены, между ними — открытые переходы.':
    'The volume is broken into several connected parts instead of one body. Functions are separated, with open links between them.',
  'Периметр и стоимость наружных ограждений растут заметно. Инженерные сети приходится вести между корпусами.':
    'Perimeter and envelope cost rise noticeably. Services have to be run between the blocks.',
  'Одно плотное тело с минимальным периметром. Самая экономная геометрия по стоимости оболочки и по теплу.':
    'A single dense body with minimal perimeter. The most economical geometry for envelope cost and for heat.',
  'Меньше фасадного фронта и видовых точек. Планировка жёстче: перемещать стены почти негде.':
    'Less façade frontage and fewer viewpoints. The plan is more rigid: there is barely anywhere to move a wall.',
  'Здание вытянуто вдоль участка одной полосой. Все основные помещения получают одну ориентацию и один вид.':
    'The building runs along the site as a single band. Every principal room gets the same orientation and the same view.',
  'Длинные коммуникации и коридоры. Требует участка с выраженной длинной стороной.':
    'Long service runs and long corridors. It needs a site with a pronounced long side.',
  'Верхние этажи отступают внутрь, освобождая террасы. Объём теряет массивность к верху.':
    'The upper floors step back, freeing up terraces. The volume sheds mass towards the top.',
  'Каждый отступ — это переход конструктивной схемы и узел, который надо решать отдельно.':
    'Every setback is a change in the structural scheme and a junction that has to be solved on its own.',
  'Здание стоит на выраженном цоколе, который выравнивает участок и отделяет жилые уровни от земли.':
    'The building sits on a pronounced plinth that levels the site and lifts the living floors off the ground.',
  'Подиум — это объём, который надо построить и в котором надо что-то разместить, иначе он становится дорогой пустотой.':
    'A podium is a volume you have to build and then fill with something, or it becomes expensive emptiness.',
  Подиум: 'Podium',

  // --- Формы кабинета ---
  'Что сказать бюро': 'What to tell the bureau',
  'Нужно сдвинуть срок на месяц — уезжаю. Или: передумал по направлению, хочу вернуться к первому варианту.':
    'I need to push the deadline by a month — I’m travelling. Or: I’ve changed my mind on the direction and want to go back to the first option.',
  'Отправить бюро': 'Send to the bureau',
  'Сказанное идёт бюро, а не команде. Так и задумано: бюро отвечает перед вами за проект целиком и переводит вашу просьбу в постановку задач. Просьба, отданная исполнителю напрямую, ломает ровно то, за что вы платите — ответственность за результат.':
    'What you write goes to the bureau, not to the team. That is deliberate: the bureau answers to you for the project as a whole and turns your request into task specifications. A request handed straight to a contributor breaks precisely what you are paying for — accountability for the result.',
  'Что сказать, подтверждая (необязательно)': 'Anything to say as you confirm (optional)',
  'Подтвердить стадию «{stage}»': 'Confirm the “{stage}” stage',
  'Подтверждение откроет команде следующую стадию. Пока его нет, работа по ней не начинается — это не задержка, а защита: документация по неподтверждённой концепции переделывается целиком. Если есть замечания, не подтверждайте, а напишите бюро ниже: оно превратит их в круг правок.':
    'Confirming opens the next stage for the team. Until you do, no work on it begins — that is not a delay but a safeguard: documentation built on an unconfirmed concept gets redone in full. If you have comments, do not confirm — write to the bureau below and it will turn them into a round of revisions.',
  'м²': 'm²',

  // --- Ответы действий ---
  'Отправлено бюро. Ответ появится здесь же.':
    'Sent to the bureau. The reply will appear right here.',
  'Стадия подтверждена.': 'Stage confirmed.',
  'Не отправилось. Попробуйте ещё раз.': 'It did not send. Please try again.',
  'Не получилось. Напишите бюро — разберём.':
    'That did not work. Write to the bureau and we will sort it out.',
  'Неизвестная стадия.': 'Unknown stage.',
  'Сначала войдите по ключу.': 'Sign in with your key first.',

  // --- Правовые документы ---
  //
  // Не подстрочник. Договор, переведённый дословно, звучит как перевод — а его
  // будут читать перед тем, как заплатить.
  'Правовые документы': 'Legal',
  Редакция: 'Revision',
  'применимое право —': 'governing law —',
  'адрес:': 'address:',
  'регистрационный номер': 'registration number',
  'налоговый номер': 'tax number',
  '— наименование не заполнено —': '— company name not set —',
  '— адрес не заполнен —': '— address not set —',

  'Прежде чем читать': 'Before you read',
  'Это рабочая редакция, подготовленная вместе с продуктом и описывающая ровно то, как он устроен. Она не заменяет проверку юристом в юрисдикции регистрации и подлежит такой проверке до первого платного заказа.':
    'This is a working revision, drafted alongside the product and describing exactly how it works. It does not replace review by a lawyer in the jurisdiction of registration, and it is subject to that review before the first paid order.',
  'Реквизиты не заполнены': 'Company details are not filled in',
  'Наименование, регистрационный номер и адрес подставляются из настроек окружения и сейчас пусты. Пока их нет, оферта договором не является: заключать его не с кем. Вымышленные реквизиты здесь не подставляются намеренно.':
    'The company name, registration number and address come from environment settings and are currently empty. Until they are set, this offer is not a contract: there is no one to enter into it with. Invented details are deliberately not substituted here.',

  '1. Кто оказывает услугу': '1. Who provides the service',
  'Услугу оказывает': 'The service is provided by',
  '(далее — Бюро).': '(the “Bureau”).',
  'Бюро зарегистрировано в Черногории и действует по праву Черногории. Заказчиком может быть лицо из любой страны; право, применимое к договору, от этого не меняется.':
    'The Bureau is registered in Montenegro and operates under Montenegrin law. The Client may be located in any country; this does not change the law governing the contract.',

  '2. Что мы делаем и чего не делаем': '2. What we do and what we do not',
  'Бюро выпускает проектную документацию силами команды специалистов, собранной алгоритмом под конкретный проект, и отвечает перед Заказчиком за результат целиком.':
    'The Bureau produces design documentation using a team of specialists assembled algorithmically for the specific project, and is accountable to the Client for the result as a whole.',
  'Бюро не выполняет и не обещает:': 'The Bureau does not perform and does not promise:',
  'строительные работы, поставку материалов и технический надзор на площадке;':
    'construction work, supply of materials or site supervision;',
  'получение разрешения как гарантированный результат: Бюро готовит и подаёт комплект, решение принимает орган;':
    'a permit as a guaranteed outcome: the Bureau prepares and submits the set, the authority makes the decision;',
  'работу за пределами продуктовой границы — здания выше {n} этажей и зоны стандартного (тяжёлого) регулирования Бюро не берёт;':
    'work outside the product boundary — the Bureau does not take buildings above {n} storeys or sites in standard (heavy) regulation zones;',
  'выпуск разрешительной документации вне стран, где у команды есть право подписи. Сейчас это {countries}. Проект вне этого перечня Бюро принять не может — не по договорённости, а потому что подписать комплект будет некому.':
    'issuing permit documentation outside the countries where the team holds signing rights. Currently those are {countries}. A project outside that list is one the Bureau cannot take — not as a matter of policy, but because there would be no one to sign the set.',

  '3. Состав комплекта по стадиям': '3. What the set contains, by stage',
  'Работа идёт стадиями: {stages}. Заказчик выбирает целевую стадию в брифе; стадии за ней не заказываются и не оплачиваются.':
    'Work proceeds in stages: {stages}. The Client selects the target stage in the brief; stages beyond it are neither ordered nor paid for.',
  'Состав задач каждой стадии определяется формой проекта — типологией, материальной системой, рельефом, подключением к сетям — и виден Заказчику в кабинете проекта до начала работ.':
    'The tasks in each stage follow from the shape of the project — typology, structural system, terrain, utility connection — and are visible to the Client in the project workspace before work begins.',

  '4. Цена и порядок оплаты': '4. Price and payment',
  'Цена стадии рассчитывается автоматически и складывается из площади объекта, ставки стадии, множителя типологии и множителя страны, но не ниже установленного для стадии минимума. Расчёт показывается Заказчику вместе со счётом: он видит не только сумму, но и то, из чего она сложилась.':
    'The price of a stage is calculated automatically from the floor area, the stage rate, the typology multiplier and the country multiplier, but never below the minimum set for that stage. The calculation is shown to the Client together with the invoice: they see not only the amount but what it is made of.',
  'Стадия оплачивается до начала работ по ней.': 'A stage is paid for before work on it begins.',
  'Открытие задачи означает, что за неё взялся конкретный специалист, и Бюро не вправе начинать стадию в долг перед исполнителями.':
    'Opening a task means a specific specialist has taken it on, and the Bureau is not entitled to start a stage on credit against its contributors.',
  'Счёт на очередную стадию выставляется только после того, как Заказчик подтвердил предыдущую. Платить вперёд за работу, которую Заказчик ещё не принял, не приходится ни разу.':
    'An invoice for the next stage is issued only after the Client has confirmed the previous one. At no point does the Client pay in advance for work they have not yet accepted.',
  'Цена, указанная в выставленном счёте, не пересматривается. Изменение расценок Бюро действует только на счета, выставленные после изменения.':
    'The price stated on an issued invoice is not revised. A change in the Bureau’s rates applies only to invoices issued after the change.',

  '5. Приёмка и подтверждение стадии': '5. Acceptance and confirmation of a stage',
  'Стадия закрывается двумя действиями. Бюро принимает работу у специалистов — это означает «сделано так, как поставлено». Заказчик подтверждает стадию — это означает «поставлено было именно то, что заказывалось».':
    'A stage closes on two acts. The Bureau accepts the work from the specialists — that means “done as specified”. The Client confirms the stage — that means “what was specified is what was ordered”.',
  'Пока подтверждения нет, следующая стадия не начинается. Замечания Заказчика принимаются через его канал связи с Бюро и переводятся Бюро в круг правок в рамках оплаченной стадии.':
    'Until confirmation arrives, the next stage does not begin. The Client’s comments are received through their channel to the Bureau and turned by the Bureau into a round of revisions within the stage already paid for.',

  '6. Состав команды': '6. Composition of the team',
  'Команду под проект определяет алгоритм по заявленным и подтверждённым признакам специалистов. Ни Заказчик, ни Бюро не назначают конкретных исполнителей: такого действия в системе не существует.':
    'The team for a project is determined by an algorithm from the declared and verified attributes of specialists. Neither the Client nor the Bureau appoints particular contributors: no such action exists in the system.',
  'Выбывшего участника заменяет следующий по расчёту кандидат. Замена не является изменением условий договора и не влияет на цену стадии.':
    'A departing member is replaced by the next candidate in the calculation. A replacement is not a change to the terms of the contract and does not affect the price of the stage.',

  '7. Права на результат': '7. Rights in the result',
  'Материалы, выпущенные по договору и принятые Бюро, принадлежат Заказчику и передаются ему в полном объёме по завершении оплаченных стадий.':
    'Materials produced under the contract and accepted by the Bureau belong to the Client and are handed over in full on completion of the stages paid for.',
  'Бюро вправе указывать факт выполнения проекта и обезличенные его характеристики (типология, площадь, стадия, страна) в своих материалах. Адрес объекта, имя Заказчика и содержание документации при этом не раскрываются без его согласия.':
    'The Bureau may state the fact that a project was carried out, together with its anonymised characteristics (typology, area, stage, country), in its own materials. The address of the property, the Client’s name and the contents of the documentation are not disclosed without the Client’s consent.',

  '8. Ответственность': '8. Liability',
  'Бюро отвечает за соответствие выпущенной документации поставленной задаче и требованиям, действующим в стране объекта на момент выпуска стадии.':
    'The Bureau is responsible for the documentation conforming to the task set and to the requirements in force in the country of the property at the time the stage is issued.',
  'Ответственность Бюро по каждой стадии ограничена суммой, фактически оплаченной за эту стадию. Бюро не отвечает за убытки, возникшие из-за сведений об участке, предоставленных Заказчиком и оказавшихся недостоверными, а также за изменения требований органов после выпуска стадии.':
    'The Bureau’s liability for each stage is limited to the amount actually paid for that stage. The Bureau is not liable for losses arising from site information supplied by the Client that proves inaccurate, nor for changes in the authorities’ requirements after a stage has been issued.',

  '9. Отказ от договора и возврат': '9. Withdrawal and refunds',
  'Заказчик вправе отказаться от дальнейшей работы в любой момент. Оплаченная стадия, работа по которой ещё не начата (ни одна задача не открыта), возвращается полностью. По начатой стадии возвращается часть, соответствующая непринятым задачам на момент отказа: принятая работа выполнена людьми и оплачена им.':
    'The Client may withdraw from further work at any time. A stage that has been paid for but not started (no task opened) is refunded in full. For a stage already underway, the share corresponding to tasks not yet accepted at the moment of withdrawal is refunded: accepted work was done by people and has been paid to them.',
  'Бюро вправе отказаться от проекта, если после брифа выясняется, что он выходит за продуктовую границу, — с полным возвратом оплаченного.':
    'The Bureau may decline a project if, after the brief, it turns out to fall outside the product boundary — with a full refund of anything paid.',

  '10. Персональные данные': '10. Personal data',
  'Обработка персональных данных описана в': 'The processing of personal data is described in the',
  'Политике обработки данных': 'Data Processing Policy',
  ', которая является неотъемлемой частью настоящей оферты.':
    ', which forms an integral part of this offer.',
  'Политика обработки данных →': 'Data processing policy →',
  '← Публичная оферта': '← Terms of service',

  '11. Применимое право и споры': '11. Governing law and disputes',
  'К договору применяется право Черногории. Споры, не урегулированные переговорами, рассматриваются судом по месту регистрации Бюро.':
    'The contract is governed by the law of Montenegro. Disputes not settled by negotiation are heard by the court at the Bureau’s place of registration.',
  'Если Заказчик — потребитель, находящийся в стране, право которой предоставляет ему защиту, не отменяемую соглашением сторон, такая защита за ним сохраняется.':
    'Where the Client is a consumer located in a country whose law affords them protection that cannot be set aside by agreement, that protection is preserved.',

  '12. Язык оферты': '12. Language of the offer',
  'Оферта существует на русском и английском языках, и обе редакции равнозначны.':
    'This offer exists in Russian and in English, and both revisions are equally authentic.',
  'При расхождении между ними преимущество имеет та, на языке которой оферта была показана Заказчику в момент принятия. Язык принятия фиксируется вместе с отметкой о согласии. Правило выбрано так намеренно: связывать человека редакцией, которой он не читал, нечестно, а «русская редакция главная, потому что мы её писали» — именно это и означало бы.':
    'Where they differ, the one in the language in which the offer was shown to the Client at the moment of acceptance prevails. The language of acceptance is recorded together with the record of consent. The rule is deliberate: binding someone to a revision they never read is unfair, and “the Russian revision governs because we wrote it” would mean exactly that.',

  '13. Изменения оферты': '13. Changes to this offer',
  'Редакция оферты обозначена датой в начале документа. К уже заключённому договору применяется та редакция, которая действовала на момент согласия Заказчика: она фиксируется вместе с отметкой времени.':
    'The revision of the offer is marked by the date at the top of the document. A contract already entered into is governed by the revision in force at the moment of the Client’s consent: it is recorded together with the timestamp.',
  'Вопросы по договору:': 'Questions about the contract:',

  // --- Политика обработки данных ---
  'Обработка персональных данных': 'Processing of personal data',
  Коротко: 'In short',
  'Мы собираем то, без чего нельзя собрать команду и выпустить документацию, и не собираем ничего сверх. Контакты заказчика не уходят специалистам, контакты специалистов не уходят заказчику — это устроено не правилом, а тем, что нужные поля физически не попадают в браузер другой стороны.':
    'We collect what it takes to assemble a team and issue documentation, and nothing beyond that. The client’s contact details never reach the specialists, and the specialists’ never reach the client — that is enforced not by a rule but by the fact that those fields physically never arrive in the other side’s browser.',
  'Оператор не указан': 'No controller named',
  'Наименование и адрес для обращений подставляются из настроек окружения и сейчас пусты. Без них человеку некуда обратиться по своим правам, а значит документ неполон.':
    'The company name and the address for enquiries come from environment settings and are currently empty. Without them there is nowhere to exercise your rights, which makes this document incomplete.',

  '1. Кто обрабатывает данные': '1. Who processes the data',
  'Оператор —': 'The controller is',
  'Черногория.': 'Montenegro.',
  'Обращения по любым вопросам об этих данных:': 'Enquiries on any matter regarding this data:',
  'Ответ даётся в срок не более 30 дней.': 'We reply within 30 days at most.',

  '2. Что собирается у заказчика': '2. What we collect from the client',
  'имя и адрес электронной почты — чтобы выдать ключ доступа и вести переписку;':
    'name and email address — to issue an access key and to correspond;',
  'данные проекта: типология, площадь, этажность, страна, участок, стадия, свободный текст брифа — из них рассчитывается состав команды и цена;':
    'project data: typology, area, storeys, country, site, stage and the free text of the brief — the team composition and the price are calculated from these;',
  'ключ доступа к кабинету — это учётные данные, а не идентификатор;':
    'the workspace access key — these are credentials, not an identifier;',
  'отметка о согласии с офертой и настоящим документом: дата, время и редакция.':
    'the record of consent to the offer and to this document: date, time and revision.',
  'Платёжных данных мы не собираем: приёма платежей на сайте нет, оплата идёт банковским переводом мимо продукта.':
    'We collect no payment data: there is no payment processing on this site, and payment goes by bank transfer outside the product.',

  '3. Что собирается у специалиста': '3. What we collect from the specialist',
  'имя, адрес электронной почты, ссылка на портфолио;': 'name, email address, a link to the portfolio;',
  'профессиональные признаки: дисциплины, специализации, типологии, материалы, страны и право подписи, программное обеспечение, языки, стадии, часовой пояс, заявленная свободная ёмкость;':
    'professional attributes: disciplines, specialisations, typologies, materials, countries and signing rights, software, languages, stages, time zone, declared free capacity;',
  'метрики поставки, которые считаются из событий задач и не редактируются никем, включая Бюро;':
    'delivery metrics, computed from task events and editable by no one, the Bureau included;',
  'ключ доступа и отметка о согласии — так же, как у заказчика.':
    'the access key and the record of consent — the same as for a client.',
  'Портфолио хранится ссылкой и структурированными признаками. Архив чужих файлов Бюро у себя не держит.':
    'A portfolio is stored as a link and as structured attributes. The Bureau does not keep an archive of other people’s files.',

  '4. Зачем и на каком основании': '4. Why, and on what basis',
  'Исполнение договора.': 'Performance of the contract.',
  'Данные проекта и профессиональные признаки нужны, чтобы собрать команду и выпустить документацию. Без них услуга не оказывается.':
    'Project data and professional attributes are needed to assemble a team and issue documentation. Without them the service cannot be provided.',
  'Согласие.': 'Consent.',
  'Заявка в пул и отправка брифа — добровольные действия; согласие отзывается обращением на адрес выше.':
    'Applying to the pool and submitting a brief are voluntary acts; consent can be withdrawn by writing to the address above.',
  'Законный интерес.': 'Legitimate interest.',
  'Ведение записей о принятой работе, выставленных счетах и подтверждениях стадий — то, чем при споре восстанавливается, что происходило.':
    'Keeping records of accepted work, issued invoices and stage confirmations — this is what reconstructs events if there is a dispute.',

  '5. Кому данные передаются': '5. Who the data goes to',
  'Команде проекта': 'To the project team',
  '— бриф раскрывается в объёме конкретной задачи, а не целиком. Имя и контакты заказчика не передаются.':
    '— the brief is disclosed scoped to the specific task, not in full. The client’s name and contact details are not passed on.',
  Заказчику: 'To the client',
  '— состав команды с профессиональными признаками и разбором расчёта. Почта, ключ доступа и другие контакты специалистов не передаются.':
    '— the team composition with professional attributes and the score breakdown. Specialists’ email, access key and other contact details are not passed on.',
  'Между специалистами': 'Between specialists',
  '— принятая работа становится входными данными следующей задачи с указанием дисциплины автора, но не его имени. Прямых каналов связи между специалистами не существует.':
    '— accepted work becomes the input to the next task, credited to the author’s discipline but not their name. No direct channel between specialists exists.',
  'Обработчикам:': 'To processors:',
  'хостинг приложения и базы, отправка писем. Они обрабатывают данные по нашему поручению и не используют их для себя.':
    'application and database hosting, email delivery. They process data on our instructions and do not use it for their own purposes.',
  'Данные не продаются, не передаются рекламным сетям и не используются для профилирования за пределами расчёта состава команды.':
    'Data is not sold, not passed to advertising networks and not used for profiling beyond computing the team composition.',

  '6. Передача за пределы страны': '6. Transfers outside the country',
  'Бюро зарегистрировано в Черногории, заказчик может находиться в любой стране, а хостинг и почтовый сервис расположены за её пределами. Это означает, что данные пересекают границы.':
    'The Bureau is registered in Montenegro, the client may be located in any country, and hosting and email services sit outside it. That means data crosses borders.',
  'К поставщикам, обрабатывающим данные, применяются договорные условия о защите данных. Если вы находитесь в Европейском союзе, вы вправе запросить сведения о том, на каком основании происходит такая передача.':
    'Contractual data-protection terms apply to the providers that process the data. If you are located in the European Union, you may ask on what basis such a transfer takes place.',

  '7. Сколько данные хранятся': '7. How long we keep data',
  'данные проекта и переписка с бюро — пока идёт проект и три года после его закрытия: столько же живут претензии по выпущенной документации;':
    'project data and correspondence with the bureau — for the life of the project and three years after it closes: that is how long claims about issued documentation live;',
  'профиль специалиста — пока он в пуле; после выхода из пула профиль обезличивается, а метрики поставки остаются в обезличенном виде;':
    'a specialist’s profile — while they are in the pool; on leaving, the profile is anonymised and delivery metrics remain in anonymised form;',
  'записи о счетах и подтверждениях — срок, установленный требованиями к бухгалтерским документам страны регистрации.':
    'records of invoices and confirmations — for the period required of accounting records in the country of registration.',

  '8. Ваши права': '8. Your rights',
  'Вы вправе:': 'You have the right to:',
  'узнать, какие ваши данные у нас есть, и получить их копию;':
    'find out what data of yours we hold and obtain a copy;',
  'исправить неточные данные;': 'have inaccurate data corrected;',
  'удалить данные — за вычетом того, что мы обязаны хранить по закону или по незакрытому договору;':
    'have data erased — except what we must keep by law or under an open contract;',
  'отозвать согласие;': 'withdraw consent;',
  'возразить против обработки на основании законного интереса;':
    'object to processing based on legitimate interest;',
  'пожаловаться в надзорный орган по защите данных — в Черногории это Агентство по защите персональных данных, в стране вашего нахождения — соответствующий орган.':
    'lodge a complaint with a data protection supervisory authority — in Montenegro that is the Agency for Personal Data Protection, or the corresponding authority where you are located.',
  'Отдельно про специалистов: поля для оценки человека нет ни у кого, включая Бюро. Мнений о вас в системе не хранится — только события задач и то, что вы заявили сами.':
    'A note for specialists: there is no field anywhere, the Bureau included, for rating a person. No opinions about you are stored in the system — only task events and what you declared yourself.',

  '9. Что делают автоматические расчёты': '9. What the automated calculations do',
  'Состав команды рассчитывается алгоритмом. Расчёт не выносит суждений о личности и не использует данных, кроме профессиональных признаков и событий задач. Специалисту показывается, какое именно условие не выполнено, а заказчику — разбор балла каждого участника.':
    'Team composition is computed by an algorithm. The calculation makes no judgements about a person and uses no data beyond professional attributes and task events. A specialist is shown exactly which condition was not met; a client is shown the score breakdown for every member.',
  'Модели искусственного интеллекта участвуют в подготовке черновиков и изображений и не участвуют в расчёте состава команды, в приёмке работы и в определении очерёдности задач.':
    'AI models take part in preparing drafts and images. They take no part in computing team composition, in accepting work, or in setting the order of tasks.',

  '10. Файлы cookie': '10. Cookies',
  'Используется одна техническая cookie — подписанная сессия, которая помнит, в чей кабинет вы вошли. Аналитических и рекламных cookie нет.':
    'One technical cookie is used — a signed session that remembers whose workspace you signed into. There are no analytics or advertising cookies.',

  '11. Язык документа': '11. Language of this document',
  'Документ существует на русском и английском языках, и обе редакции равнозначны. При расхождении преимущество имеет та, на языке которой документ был показан вам в момент согласия; язык согласия фиксируется вместе с ним.':
    'This document exists in Russian and in English, and both revisions are equally authentic. Where they differ, the one in the language in which it was shown to you at the moment of consent prevails; the language of consent is recorded alongside it.',

  // --- Письма ---
  //
  // Язык письма берётся из согласия, а не из заголовка браузера: у фонового
  // задания браузера нет вовсе.
  '{name}, здравствуйте.': 'Dear {name},',
  'Счёт за стадию «{stage}» — {project}': 'Invoice for the “{stage}” stage — {project}',
  'По проекту «{project}» выставлен счёт за стадию «{stage}»: {amount} {currency}.':
    'An invoice has been issued for the “{stage}” stage of the {project} project: {amount} {currency}.',
  'Стадия оплачивается до начала работы по ней: команда — живые люди, и их время начинается в тот момент, когда открывается задача. Разбор суммы — из чего она сложилась — виден в кабинете проекта.':
    'A stage is paid for before work on it begins: the team are real people, and their time starts the moment a task opens. The breakdown of the amount — what it is made of — is visible in the project workspace.',
  'Реквизиты:': 'Payment details:',
  'Реквизиты пришлём ответом на это письмо.':
    'We will send payment details in reply to this email.',
  'Кабинет проекта:': 'Project workspace:',

  'Стадия «{stage}» ждёт вашего подтверждения — {project}': 'The “{stage}” stage awaits your confirmation — {project}',
  'По проекту «{project}» закончена стадия «{stage}»: бюро приняло все её задачи. Это означает «сделано так, как поставлено».':
    'The “{stage}” stage of the {project} project is complete: the bureau has accepted every task in it. That means “done as specified”.',
  'Осталось ваше слово — «заказано было именно это». Пока его нет, следующая стадия не начинается: разрабатывать документацию по неподтверждённой концепции значит готовить переделку.':
    'What remains is your word — “this is what was ordered”. Until it arrives the next stage does not begin: developing documentation on an unconfirmed concept is preparing rework.',
  'Если есть замечания — не подтверждайте, а напишите нам из кабинета: мы переведём их в круг правок.':
    'If you have comments, do not confirm — write to us from the workspace and we will turn them into a round of revisions.',

  'Новая задача: {title}': 'New task: {title}',
  'Вам открыта задача: {title}.': 'A task has been opened for you: {title}.',
  'Срок: до {due}.': 'Due: {due}.',
  'Срок: {hours} ч с этого момента.': 'Due: {hours} h from now.',
  'Постановка и входные данные — на доске работ. Взять в работу нужно там же: срок считается от открытия задачи, а не от того, когда вы её увидели.':
    'The specification and the input files are on your work board. Claim it there as well: the clock runs from when the task opened, not from when you saw it.',
  'Доска работ:': 'Work board:',

  // --- Три стадии ---
  'Как устроены три стадии': 'How the three stages work',
  'Три стадии: Validate, Assemble, Deliver. Продуктовая граница, отбор по двенадцати измерениям, формула Quality × Availability, Blind Relay Protocol и метрики качества.':
    'Three stages: Validate, Assemble, Deliver. The product boundary, selection across twelve dimensions, the Quality × Availability formula, the Blind Relay Protocol and quality metrics.',
  'Внутренние имена стадий. На сайте те же три стадии называются короче — Filter, Score, Relay. Это одно и то же, просто с разной стороны стола.':
    'These are the internal names. On the site the same three stages go by shorter ones — Filter, Score, Relay. Same thing, seen from the other side of the table.',
  'Бриф становится требованиями, пул отсекается': 'The brief becomes requirements; the pool is cut down',
  'Бриф разбирается в структурированные требования: юрисдикция, типология, этажность, площадь, климатическая зона, материальная система, стадия документации, сроки, софт.':
    'The brief is parsed into structured requirements: jurisdiction, typology, storeys, area, climate zone, structural system, documentation stage, timing, software.',
  'Каждый жёсткий критерий сжимает пул. Поэтому жёстких — только те, без которых нельзя; остальные восемь измерений таксономии ранжируют, а не отсеивают.':
    'Every hard criterion shrinks the pool. So only the indispensable ones are hard; the other eight dimensions of the taxonomy rank rather than exclude.',
  'Quality × Availability и сборка Tiny Team': 'Quality × Availability and assembling the Tiny Team',
  'Выжившие ранжируются по формуле': 'Survivors are ranked by the formula',
  'у специалиста без истории — это рейтинг портфолио. Как только появляются закрытые тикеты, в Quality подмешиваются метрики поставки: они вытесняют портфолио до потолка в 60%. Портфолио стареет, метрики — нет.':
    'for a specialist with no history it is the portfolio rating. As soon as closed tickets appear, delivery metrics enter Quality: they displace the portfolio up to a ceiling of 60%. Portfolios age; metrics do not.',
  '— свободная ёмкость против требуемой, срок выхода на задачу и пересечение рабочего дня по часовым поясам.':
    '— free capacity against what is required, time to start on a task, and the working-day overlap across time zones.',
  'Дальше собирается Tiny Team — минимальная достаточная команда, а не полный штат бюро. Состав дисциплин определяется проектом: вилле не нужен тот же набор, что mixed-use. Проверяется совместимость по софту — кандидат, ломающий обмен моделями, уступает место следующему даже с более высоким баллом. И проверяется право подписи: без специалиста, подписывающего пакет в стране проекта, команда не собирается вовсе.':
    'Then the Tiny Team is assembled — the minimum sufficient team, not a full practice roster. The set of disciplines follows from the project: a villa does not need what a mixed-use building needs. Software compatibility is checked — a candidate who breaks model exchange gives way to the next one even with a higher score. And signing rights are checked: without someone who can sign the set in the project’s country, no team is assembled at all.',
  'Посмотреть, как это считается →': 'See how this is computed →',
  'Операционный протокол выпуска. Три правила:': 'The operating protocol for production. Three rules:',
  'Никаких прямых чатов между специалистами. Такого канала не существует.':
    'No direct chats between specialists. No such channel exists.',
  'Только комментарии на уровне тикета задачи.': 'Comments live on the task ticket and nowhere else.',
  'Стадийные гейты по зависимостям: тикет не открывается, пока не приняты те, от которых он зависит.':
    'Stage gates follow dependencies: a ticket does not open until the ones it depends on are accepted.',
  'Специалист видит свой тикет, входные артефакты, выданные гейтом, и комментарии по этому тикету. Соседей по команде он видит как роли, а не как имена и контакты.':
    'A specialist sees their own ticket, the input files released by the gate, and the comments on that ticket. They see teammates as roles, not as names and contact details.',
  'Протокол добавляет трения там, где живое бюро решило бы вопрос за минуту в переговорке. Это принятая цена: без неё нет ни защиты от обхода, ни измеримых метрик, ни дисциплины зависимостей.':
    'The protocol adds friction where a conventional practice would settle the question in a minute in a meeting room. That is a price we accept: without it there is no protection against being routed around, no measurable metrics and no dependency discipline.',
  Качество: 'Quality',
  'Метрики, а не отзывы': 'Metrics, not reviews',
  'Качество специалиста измеряется математически и считается из событий тикетов. Ни у клиента, ни у оператора нет способа поставить оценку — такого поля не существует.':
    'A specialist’s quality is measured mathematically and computed from ticket events. Neither the client nor an operator has any way to leave a rating — no such field exists.',
  'Доля тикетов, закрытых в срок.': 'Share of tickets closed on time.',
  'Доля тикетов, принятых с первого предъявления.': 'Share of tickets accepted first time.',
  'Время до первого содержательного ответа в тикете.': 'Time to the first substantive reply in a ticket.',
  'Среднее число кругов правок на тикет.': 'Average number of revision rounds per ticket.',
  'Метрики входят в Quality и потому напрямую двигают шанс попасть в следующую команду. Это и есть механизм отбора: специалист, который срывает сроки, теряет доступ к проектам без единого разбирательства.':
    'Metrics feed into Quality and so move the odds of joining the next team directly. That is the selection mechanism: a specialist who misses deadlines loses access to projects without a single hearing.',

  // --- Демонстрация алгоритма ---
  'Как алгоритм собирает команду': 'How the algorithm assembles a team',
  'Как из пула специалистов собирается команда под конкретный проект: фильтр по двенадцати измерениям, ранжирование по Quality × Availability, сборка Tiny Team и граф тикетов.':
    'How a team for a specific project is assembled out of the pool: filtering across twelve dimensions, ranking by Quality × Availability, assembling the Tiny Team, and the ticket graph.',
  'Пул синтетический и намеренно неровный: в нём есть люди ниже порога по портфолио, без права подписи, без нужного языка и без свободной ёмкости. Демонстрация, где проходят все, ничего не демонстрирует.':
    'The pool is synthetic and deliberately uneven: it contains people below the portfolio threshold, without signing rights, without the required language and without free capacity. A demonstration where everyone passes demonstrates nothing.',
  'Оставить бриф на свой проект': 'Submit a brief for your own project',

  // --- Специалистам ---
  Пул: 'The pool',
  'Проекты приходят к вам, а не вы к ним': 'Projects come to you, not the other way round',
  'Ни тендеров, ни писем «расскажите о себе», ни торга по ставке. Движок сам решает, кто попадает в команду, — по фактам, которые вы заявили, и по тому, как вы сдавали прошлые тикеты.':
    'No tenders, no “tell us about yourself” emails, no haggling over rates. The engine decides who joins a team — from the facts you declared and from how you delivered past tickets.',
  'Условия честные, но не мягкие': 'The terms are fair, not soft',
  'Гейт стоит до скоринга. Ниже порога заявка не проходит, какой бы свободной ни была ваша неделя.':
    'The gate comes before the scoring. Below the threshold an application does not pass, however free your week is.',
  'Оценок не существует': 'There are no ratings',
  'Ни клиент, ни бюро не могут поставить вам балл. Считаются только сроки, приёмка с первого раза, время отклика и круги правок.':
    'Neither the client nor the bureau can score you. Only deadlines, first-time acceptance, response time and revision rounds are counted.',
  'Прямых чатов нет': 'There are no direct chats',
  'Вы видите свой тикет и комментарии по нему. Соседей по команде — как роли, не как имена.':
    'You see your ticket and the comments on it. Teammates appear as roles, not as names.',
  'Метрики двигают доступ': 'Metrics move your access',
  'Сорванные сроки снижают Quality и убирают вас из следующих команд. Без разбирательств и без второго шанса, выданного вручную.':
    'Missed deadlines lower Quality and take you out of the next teams. Without a hearing and without a second chance handed out by anyone.',
  'Ёмкость — это множитель': 'Capacity is a multiplier',
  'Формула Quality × Availability. Нулевая свободная ёмкость обнуляет балл: качество недоступность не компенсирует.':
    'The formula is Quality × Availability. Zero free capacity zeroes the score: quality does not compensate for unavailability.',
  'Плата за доступ': 'Paying for access',
  'Подписка специалиста — за доступ к проектам. Комиссии с вашей ставки нет.':
    'The specialist subscription pays for access to projects. There is no commission on your fee.',
  'Как идёт работа': 'How the work runs',
  'Тикет, гейт, приёмка': 'Ticket, gate, acceptance',
  'Тикет открывается гейтом': 'The gate opens the ticket',
  'Пока не приняты задачи, от которых зависит ваша, тикет закрыт. Вы видите название и стадию, но не содержание — входных артефактов ещё нет.':
    'Until the tasks yours depends on are accepted, the ticket stays closed. You see the title and the stage but not the content — the input files do not exist yet.',
  'Вы работаете и комментируете в тикете': 'You work and comment in the ticket',
  'Первый содержательный ответ засекает Response Time. Всё общение — в тикете, и это единственное место, где его вообще можно вести.':
    'Your first substantive reply starts the Response Time clock. All communication happens in the ticket, and that is the only place it can happen at all.',
  'Бюро принимает или возвращает на круг': 'The bureau accepts or sends it back',
  'Приёмка в срок и с первого раза поднимает Quality. Возврат добавляет круг правок и снижает First Time Right.':
    'Acceptance on time and first time raises Quality. A return adds a revision round and lowers First Time Right.',
  'У меня уже есть ключ': 'I already have a key',
  'Пул специалистов Bureau: отбор по двенадцати измерениям, порог по портфолио 8/10, работа по тикетам, метрики вместо отзывов.':
    'The Bureau specialist pool: selection across twelve dimensions, a portfolio threshold of 8/10, work on tickets, metrics instead of reviews.',

  // --- Заявка специалиста ---
  'Заявка специалиста': 'Specialist application',
  Заявка: 'Application',
  'Двенадцать измерений': 'Twelve dimensions',
  'Это не резюме. Каждое поле — измерение, по которому движок считает пересечение с проектом. Заявить лишнее не выгодно: несовпадение вскроется на первом же тикете и осядет в метриках.':
    'This is not a CV. Every field is a dimension the engine uses to compute overlap with a project. Claiming more than you do is not to your advantage: the mismatch surfaces on the very first ticket and settles into your metrics.',

  // Подписи словарей: вид портфолио и полоса масштаба.
  '3D-рендер': '3D render',
  'Чертежи и разрезы': 'Drawings and sections',
  'Скриншоты модели': 'Model screenshots',
  'Фото со стройки': 'Site photographs',
  'до 250 м²': 'up to 250 m²',
  '250–1000 м²': '250–1000 m²',
  '1000–3000 м²': '1000–3000 m²',
  'от 3000 м²': 'over 3000 m²',

  // --- Три стадии ---
  'внутреннее имя —': 'internal name —',
  'Здесь же проверяется сам проект. Bureau ведёт здания до {n} этажей в зонах лёгкого регулирования в трёх странах: {countries}. Если проект выходит за эту границу, мы отказываем — а не берём и не тянем.':
    'The project itself is checked here too. Bureau handles buildings up to {n} storeys in light-regulation zones in three countries: {countries}. A project outside that boundary is declined — not taken on and then dragged along.',
  'Затем пул проходит жёсткие гейты: дисциплина, юрисдикция, этажность, стадия, обмен моделями, язык, пересечение по времени. И порог по портфолио — {threshold}/10, ниже которого специалист не проходит, каким бы свободным он ни был.':
    'The pool then goes through the hard gates: discipline, jurisdiction, storeys, stage, model exchange, language, working-hours overlap. And the portfolio threshold — {threshold}/10, below which a specialist does not pass, however free their week.',
  'Умножение, а не сумма: сумма позволила бы качеству компенсировать недоступность, произведение — нет. Отличный специалист без свободной ёмкости бесполезен проекту с датой.':
    'A product, not a sum: a sum would let quality make up for unavailability, a product does not. An excellent specialist with no free capacity is of no use to a project that has a date.',

  // --- Демонстрация алгоритма ---
  'Меняйте требования проекта и смотрите, что происходит с пулом. Считает тот же движок, что работает в продукте, — здесь он просто крутится в браузере на синтетическом пуле из {count} специалистов.':
    'Change the project requirements and watch what happens to the pool. The counting is done by the same engine that runs in the product — here it simply runs in the browser against a synthetic pool of {count} specialists.',

  // --- Специалистам ---
  'Порог по портфолио — {threshold}/10': 'Portfolio threshold — {threshold}/10',

  // --- Заявка специалиста ---
  'Заявка принята': 'Application received',
  'Дальше — разбор портфолио': 'Next — the portfolio review',
  'Портфолио смотрит бюро и ставит рейтинг. Порог — {threshold}/10; ниже него заявка не проходит, и это не обсуждается отдельно с каждым. Если проходите — ключ доступа придёт на указанный адрес.':
    'The bureau reviews the portfolio and sets the rating. The threshold is {threshold}/10; below it an application does not pass, and that is not negotiated case by case. If you pass, the access key arrives at the address you gave.',
  'Кто вы': 'Who you are',
  'Что вы ведёте · измерения 1–4': 'What you handle · dimensions 1–4',
  'Где и в чём · измерения 5–8': 'Where and in what · dimensions 5–8',
  'Как вы работаете · измерения 9–12': 'How you work · dimensions 9–12',
  'Имя для клиента': 'Name shown to the client',
  'Сюда придёт ключ доступа': 'The access key comes to this address',
  'Главный вход отбора: показанное весит больше заявленного':
    'The main entrance to selection: what you show weighs more than what you claim',
  Дисциплины: 'Disciplines',
  Специализация: 'Specialisation',
  'Отметьте только то, что вели сами. Конструктор по монолиту на деревянном доме — это не «почти то же самое», и движок разводит их специально':
    'Tick only what you have led yourself. A concrete-frame engineer on a timber house is not “near enough the same thing”, and the engine keeps the two apart on purpose',
  Типологии: 'Typologies',
  'Максимальная этажность': 'Maximum storeys',
  'Только та, на которую есть подтверждённый опыт': 'Only what you have proven experience with',
  'Материальные системы': 'Material systems',
  'Климатические зоны': 'Climate zones',
  Юрисдикции: 'Jurisdictions',
  'Где вы реально проходили согласования':
    'Where you have actually taken projects through approvals',
  'Право подписи': 'Signing rights',
  'Только страны из списка выше. Без подписи в стране проект не берётся вовсе':
    'Only countries from the list above. Without signing rights in a country the project is not taken at all',
  'Уровень обмена по IFC': 'IFC exchange level',
  'Общий формат заменяет общий пакет: с координацией по IFC вы совместимы с любой командой':
    'A shared format replaces a shared software suite: with IFC coordination you are compatible with any team',
  'Стадии документации': 'Documentation stages',
  'Для согласований язык органов — жёсткое требование':
    'For approvals the language of the authorities is a hard requirement',
  Режим: 'Work mode',
  'Смещение от UTC': 'UTC offset',
  'По нему считается пересечение рабочего дня': 'Working-day overlap is calculated from it',
  'Свободная ёмкость, ч/нед': 'Free capacity, h/week',
  'Ноль означает, что в отборе вы не участвуете: формула — произведение':
    'Zero means you are out of selection: the formula is a product',
  'Срок выхода на задачу, дней': 'Days before you can start on a task',

  // --- Демонстрация: вход, воронка, состав ---
  'Требования проекта': 'Project requirements',
  'Продуктовая граница — {n}': 'Product boundary — {n}',
  Климат: 'Climate',
  Материал: 'Material',
  'Склон требует вертикальной планировки': 'A slope calls for grading and drainage',
  'Софт проекта': 'Project software',
  'Пустой список — обмен не ограничен': 'An empty list leaves the exchange unrestricted',
  'Языки клиента': 'Client languages',
  'в пуле': 'in the pool',
  'прошли гейты': 'passed the gates',
  'ролей в команде': 'roles on the team',
  'Что отсекло дисциплину «{discipline}»': 'What cut down “{discipline}”',
  '{count} в дисциплине': '{count} in the discipline',
  Осталось: 'Left',
  'Порог по портфолио — {threshold}/10, и он стоит до скоринга: это гейт, а не слагаемое.':
    'The portfolio threshold is {threshold}/10, and it stands before scoring: a gate, not a term in the sum.',
  'В этой дисциплине не осталось никого. Команда не собирается — ослабьте требования или расширьте пул.':
    'No one is left in this discipline. The team does not assemble — relax the requirements or widen the pool.',
  'право подписи': 'signing rights',
  Роль: 'Role',
  Балл: 'Score',
  'Граф тикетов': 'Ticket graph',
  'Тикет не открывается, пока не приняты те, от которых он зависит. Прямых чатов между специалистами не существует.':
    'A ticket does not open until the ones it depends on are accepted. Direct chats between specialists do not exist.',
  'ждёт:': 'waits for:',
  '{hours} ч': '{hours} h',
  'Команда не собрана': 'The team did not assemble',
  'Специализация в этой роли не требуется.': 'This role needs no specialisation.',
  или: 'or',
  'Роль требует всё сразу: {list}.': 'The role requires all of it at once: {list}.',
  'Роль требует специализацию: {list}.': 'The role requires a specialisation: {list}.',
  'внутреннее имя стадии —': 'internal stage name —',

  // --- Гейты: чем отсекло ---
  'Портфолио ниже {threshold}/10': 'Portfolio below {threshold}/10',
  'Не работает в этой дисциплине': 'Does not work in this discipline',
  'Дисциплина та, специализация не та': 'Right discipline, wrong specialisation',
  'Не проходил согласования в этой стране': 'Has not taken approvals through in this country',
  'Нет подтверждённого опыта на такой этажности': 'No proven experience at this number of storeys',
  'Не ведёт документацию до нужной стадии': 'Does not carry documentation to the stage required',
  'Нет общего языка с клиентом или с органами':
    'No language in common with the client or the authorities',
  'Пересечение по времени меньше рабочего минимума':
    'Working-hours overlap below the working minimum',
  'Нет свободной ёмкости или не успевает выйти к сроку':
    'No free capacity, or cannot start in time',
  'Нет действующей подписки на доступ к проектам': 'No active subscription for access to projects',

  // --- Доска работ специалиста ---
  'Мои задачи': 'My tasks',
  'Доска работ': 'Work board',
  'Профиль и метрики': 'Profile and metrics',
  'Вы вышли из проекта. Роль передана следующему по рангу из того же прогона, ваши незакрытые задачи по нему перешли к нему же.':
    'You have left the project. The role went to the next by rank from the same run, and your open tasks on it went with the role.',
  'Вы вышли из проекта. Замены в прогоне не нашлось — роль вернулась бюро, и оно ищет исполнителя.':
    'You have left the project. No replacement was found in the run — the role went back to the bureau, which is looking for someone.',
  'Ждёт гейта': 'Waiting on a gate',
  'Зависимости ещё не приняты': 'Its dependencies are not accepted yet',
  'К взятию': 'To pick up',
  'Открыт, но не взят в работу': 'Open, not yet taken on',
  'Взят или вернулся на круг': 'Taken on, or back for another round',
  Сдано: 'Submitted',
  'Предъявлено или принято': 'Handed in or accepted',
  'Выход оформлен': 'Your exit is recorded',
  'На балл это не влияет: выход не считается ошибкой и в отбор не входит. Но если вы вышли из-за загрузки, поправьте свободную ёмкость —':
    'This does not touch your score: leaving is not counted as a failure and does not enter selection. But if you left because of workload, correct your free capacity —',
  'в профиле': 'in your profile',
  'Отбор считает по ней, и заявленные часы, которых нет, приведут к тому же ещё раз.':
    'Selection counts on it, and declared hours you do not have will bring you here again.',
  'Задач пока нет': 'No tasks yet',
  'Задач не будет, пока закрыт доступ к проектам: без него движок вас не рассматривает. Это про доступ, а не про качество вашей работы — ни портфолио, ни метрики здесь ни при чём. Что делать — написано в профиле.':
    'There will be no tasks while access to projects is closed: without it the engine does not consider you. This is about access, not about the quality of your work — neither portfolio nor metrics come into it. What to do is written in your profile.',
  'Тикеты появляются, когда движок ставит вас в команду проекта. Откликаться никуда не нужно — отбор идёт без вашего участия.':
    'Tickets appear when the engine puts you on a project team. There is nothing to apply to — selection runs without your involvement.',
  'Пусто.': 'Empty.',
  'Ждёт:': 'Waits for:',
  'Срок:': 'Due:',
  конфликт: 'conflict',
  просрочен: 'overdue',

  // --- Тикет ---
  Тикет: 'Ticket',
  '← к доске работ': '← back to the work board',
  'запрос смежника': 'request from an adjacent discipline',
  'от дисциплины «{discipline}»': 'from “{discipline}”',
  'срок {hours} ч': '{hours} h to deliver',
  'до {due}': 'due {due}',
  'кругов правок: {rounds}': 'revision rounds: {rounds}',
  'Конфликт передан арбитру': 'The conflict went to the arbiter',
  'Работа по тикету стоит, пока бюро не вынесет решение.':
    'Work on the ticket is on hold until the bureau rules.',
  'Тикет ещё закрыт гейтом': 'The ticket is still closed by a gate',
  'Ждём приёмки:': 'Waiting on acceptance of:',
  'Постановка и входные файлы появятся здесь, когда тикет откроется.':
    'The brief and the input files appear here when the ticket opens.',
  Постановка: 'The brief',
  'Бюро ещё не дописало постановку — задайте вопрос в комментарии.':
    'The bureau has not finished the brief — ask in a comment.',
  'Входные файлы': 'Input files',
  'То, что сдали предшественники по графу. Автор указан дисциплиной.':
    'What your predecessors in the graph handed in. The author is named by discipline.',
  'Смежники на проекте: {roles}.': 'Adjacent roles on the project: {roles}.',
  'Их контактов в системе нет — всё через бюро.':
    'The system holds no contacts for them — everything goes through the bureau.',
  'Время до принятия задачи — это метрика. Тикет, открытый и не взятый, видит цифровой менеджер и напоминает.':
    'Time to pick a task up is a metric. A ticket left open and untaken is seen by the digital manager, and it will remind you.',
  'Ваши файлы по тикету': 'Your files on this ticket',
  сгенерировано: 'generated',
  Изображение: 'Image',
  'Черновой материал для работы. В записях он помечен как сгенерированный — ответственность за сданное остаётся на вас.':
    'Draft material to work from. The records mark it as generated — responsibility for what you hand in stays yours.',
  'Направление: {title}. {summary}': 'Direction: {title}. {summary}',
  Комментарии: 'Comments',
  'Пока пусто.': 'Nothing yet.',
  Бюро: 'Bureau',
  Вы: 'You',
  'Приёмку делает бюро. Принято в срок и с первого раза — Quality растёт.':
    'The bureau does the accepting. Accepted on time and first time — Quality goes up.',
  'Работа предъявлена и ждёт приёмки бюро.':
    'The work is handed in and waits for the bureau to accept it.',
  'Тикет принят. Зависящие от него задачи гейт откроет сам.':
    'The ticket is accepted. The gate opens the tasks that depend on it by itself.',
  'Ваши запросы смежникам': 'Your requests to adjacent disciplines',
  'Нужно что-то от смежной дисциплины': 'Need something from an adjacent discipline',
  'Это не спор и не переписка. Запрос станет тикетом для нужной дисциплины — с исполнителем, сроком и приёмкой, как всякая другая работа.':
    'This is neither an argument nor a conversation. The request becomes a ticket for that discipline — with someone on it, a deadline and acceptance, like any other work.',
  'Если договориться нельзя': 'If agreement is not possible',
  'Арбитраж останавливает работу по тикету. Для рабочего вопроса используйте запрос выше.':
    'Arbitration stops work on the ticket. For a working question use the request above.',
  'Если не сможете вести': 'If you cannot carry it',
  'Болезнь, чужой срок, недооценённый объём — это бывает, и молчание здесь хуже отказа. Сказать заранее значит дать проекту найти замену, пока срок ещё не горит.':
    'Illness, someone else’s deadline, an underestimated scope — it happens, and silence here is worse than declining. Saying it early lets the project find a replacement while the deadline is not yet burning.',

  // --- Действия на тикете ---
  'Взять в работу': 'Take it on',
  'Предъявить работу': 'Hand in the work',
  Отправить: 'Send',
  'Передать арбитру': 'Refer to the arbiter',
  'Отправить запрос': 'Send the request',
  Сгенерировать: 'Generate',
  Приложить: 'Attach',
  'Комментарий в тикете': 'Comment on the ticket',
  'Вопрос по постановке, ход работы, что передаёте дальше':
    'A question about the brief, how the work is going, what you are handing on',
  'Это единственный канал: личных сообщений между специалистами в системе нет.':
    'This is the only channel: there are no private messages between specialists in the system.',
  'Расхождение по задаче': 'The disagreement on this task',
  'Например: вентканал по разделу инженерии проходит там, где дверь по архитектуре':
    'For example: the duct in the MEP set runs where the architectural set has a door',
  'Договариваться со смежником напрямую негде и не нужно. Решает бюро.':
    'There is nowhere to settle it with the adjacent discipline directly, and no need. The bureau decides.',
  Кому: 'To whom',
  'Что нужно': 'What you need',
  'Сдвинуть дверь в осях 3–4': 'Move the door on gridlines 3–4',
  Подробно: 'In detail',
  'Вентканал 200×400 идёт по стене в осях 3–4 и упирается в дверной проём. Нужно сдвинуть проём на 200 мм к оси 4.':
    'A 200×400 duct runs along the wall on gridlines 3–4 and hits the door opening. The opening needs to move 200 mm towards gridline 4.',
  'Станет тикетом для этой дисциплины со сроком в сутки. Переписки не будет: адресат должен понять запрос без вас.':
    'It becomes a ticket for that discipline with a one-day deadline. There will be no exchange: the recipient has to understand the request without you.',
  'Экстерьер, вечер, вид с подъезда': 'Exterior, evening, view from the approach',
  'Что должно быть на изображении': 'What the image should show',
  'Ляжет в тикет с пометкой, что сгенерировано. Это материал для работы: предъявляете вы то, за что готовы отвечать.':
    'It goes onto the ticket marked as generated. It is material to work from: what you hand in is what you are prepared to answer for.',
  'Название файла': 'File name',
  'Планы этажей, rev.B': 'Floor plans, rev.B',
  Тип: 'Kind',
  Файл: 'File',
  'До {limit} МБ. Файл ложится к нам: материалы проекта принадлежат заказчику и передаются ему целиком (п.13), а ссылка на чужой диск живёт до того дня, когда там наведут порядок.':
    'Up to {limit} MB. The file is stored by us: project materials belong to the client and are handed over in full (§13), whereas a link to someone else’s drive lives until the day they tidy it up.',
  '…или ссылка': '…or a link',
  'Для того, что снаружи по своей природе: облачная модель, общий диск заказчика.':
    'For what is external by nature: a cloud model, the client’s shared drive.',
  'Почему выходите': 'Why you are leaving',
  'Заболел, выхожу не раньше чем через три недели':
    'Ill; I cannot start for another three weeks',
  'Причину увидит бюро и тот, кто придёт на замену. Оценкой она не станет — поля оценки специалиста в системе нет.':
    'The bureau and whoever replaces you will see the reason. It does not become a rating — there is no field for rating a specialist in the system.',
  'Выйти из проекта': 'Leave the project',
  'Уйдёт роль целиком: все ваши незакрытые задачи по этому проекту перейдут следующему по рангу из того же прогона. Принятая работа останется вашей — она уже в ваших метриках, и переписывать её никто не будет.':
    'The whole role goes: every open task of yours on this project passes to the next by rank from the same run. Accepted work stays yours — it is already in your metrics, and no one will rewrite it.',

  // --- Профиль специалиста ---
  'Заполнить профиль': 'Complete your profile',
  '← профиль': '← profile',
  '{name}, заполните профиль': '{name}, complete your profile',
  'адрес бюро — ответом на письмо с ключом доступа':
    'the bureau’s address — reply to the email with your access key',
  портфолио: 'portfolio',
  'порог {threshold}/10': 'threshold {threshold}/10',
  'балл поставки': 'delivery score',
  'вес в Quality — {percent}%': 'weight in Quality — {percent}%',
  'истории пока нет': 'no history yet',
  'ч/нед свободно': 'h/week free',
  'при нуле вас нет в выборке': 'at zero you are out of selection',
  '{status}, выход за {days} дн.': '{status}, starts within {days} days',
  'Доступ к проектам': 'Access to projects',
  'Пока доступ закрыт, движок вас не рассматривает — независимо от портфолио и метрик. Это про оплату доступа, а не про качество вашей работы: отказ по деньгам и отказ по квалификации — разные вещи, и мы их не смешиваем. Чтобы открыть, напишите на {email}.':
    'While access is closed the engine does not consider you — whatever your portfolio and metrics. This is about paying for access, not about the quality of your work: being turned away over money and being turned away over qualification are different things, and we do not mix them. To open it, write to {email}.',
  'Доступ открыт: вы участвуете в отборе на общих основаниях. Платит сторона предложения за доступ к спросу — с вашего гонорара бюро комиссию не берёт.':
    'Access is open: you take part in selection on the usual terms. The supply side pays for access to demand — the bureau takes no commission from your fee.',
  'Единственное, чем вы управляете напрямую. Балл считает движок, время считаете вы.':
    'The one thing you control directly. The engine counts the score, you count the time.',
  'Метрики качества': 'Quality metrics',
  'Считаются из событий ваших тикетов. Ни бюро, ни клиент не могут их поправить: поля для оценки в системе нет.':
    'Calculated from the events on your tickets. Neither the bureau nor the client can adjust them: there is no field for a rating in the system.',
  '{onTime} из {delivered} в срок': '{onTime} of {delivered} on time',
  '{count} принято с первого раза': '{count} accepted first time',
  'до первого содержательного ответа': 'to the first substantive reply',
  'кругов правок на тикет': 'revision rounds per ticket',
  'Закрытых тикетов пока нет, поэтому Quality у вас — это рейтинг портфолио. Как только появится история, она начнёт вытеснять портфолио: до 60% веса.':
    'You have no closed tickets yet, so your Quality is your portfolio rating. Once a history appears it starts displacing the portfolio: up to 60% of the weight.',
  'Что о вас знает движок': 'What the engine knows about you',
  нет: 'none',
  'Обмен по IFC': 'IFC exchange',
  'Изменить эти поля можно через бюро: они входят в отбор, и править их самому в обход разбора — значит править собственный балл.':
    'These fields are changed through the bureau: they enter selection, and editing them yourself, around the review, would mean editing your own score.',
  Статус: 'Status',
  'Статус «занят» обнуляет ёмкость: в отборе вас не будет, пока не вернёте часы.':
    'The “busy” status zeroes your capacity: you stay out of selection until you put the hours back.',
  'Фактор доступности — множитель, а не слагаемое. Ноль часов означает выход из выборки.':
    'Availability is a multiplier, not a term added on. Zero hours means dropping out of selection.',
  'Сохраняем…': 'Saving…',
  Сохранить: 'Save',
  'Зачем эти поля': 'What these fields are for',
  'Вас позвало бюро — заявку вы не подавали. Из нашей базы известны имя и адрес, и, возможно, дисциплина со страной: они уже отмечены ниже. Остальное знаете только вы.':
    'The bureau invited you — you did not apply. From our records we know your name and address, and possibly your discipline and country: those are already ticked below. The rest only you know.',
  'Команду под проект собирает алгоритм, а не человек. Он отбирает по фактам: юрисдикция, пакет, стадия, язык, часовой пояс, свободная ёмкость. Пустое поле — это не «нейтрально», это «не проходит»: половина из них — жёсткие гейты. Пока профиль не заполнен, вас просто нет в выборке.':
    'The team for a project is assembled by an algorithm, not a person. It selects on facts: jurisdiction, software suite, stage, language, time zone, free capacity. An empty field is not “neutral”, it is “does not pass”: half of them are hard gates. Until the profile is filled in, you are simply not in the pool.',
  'После сохранения профиль уходит на разбор портфолио. Порог — {threshold}/10, и рейтинг ставит бюро: вы даёте данные о себе, а не оценку себе.':
    'Once saved, the profile goes for portfolio review. The threshold is {threshold}/10, and the bureau sets the rating: you give facts about yourself, not a rating of yourself.',
  'Профиль отправлен': 'Profile submitted',
  'Бюро смотрит портфолио и ставит рейтинг. Порог — {threshold}/10. Ключ доступа у вас уже есть — тот же, по которому вы вошли.':
    'The bureau reviews the portfolio and sets the rating. The threshold is {threshold}/10. You already have the access key — the one you signed in with.',
  'К профилю →': 'To the profile →',
  'Отправить на разбор': 'Send for review',

  // --- Сообщения действий специалиста ---
  'Не получилось.': 'That did not work.',
  'Не получилось. Напишите в тикет — бюро разберёт вручную.':
    'That did not work. Write in the ticket — the bureau will sort it by hand.',
  'Тикет взят в работу.': 'The ticket is now yours to work on.',
  'Работа предъявлена, ждёт приёмки бюро.':
    'The work is handed in and waits for the bureau to accept it.',
  'Пустой комментарий.': 'The comment is empty.',
  'Опишите, в чём именно расхождение.': 'Describe exactly what the disagreement is.',
  'Выберите дисциплину.': 'Choose a discipline.',
  'Коротко назовите, что нужно.': 'Say briefly what you need.',
  'Опишите запрос: адресату нужно понять его без вас.':
    'Describe the request: the recipient has to understand it without you.',
  'Опишите, что нужно на изображении.': 'Describe what the image should show.',
  'Назовите файл: смежник увидит это имя, а не ваше.':
    'Name the file: the adjacent discipline sees this name, not yours.',
  'Приложите файл или дайте ссылку.': 'Attach a file or give a link.',
  'Файл больше потолка, указанного у поля. Это уже архив, а не чертёж: положите его отдельно и дайте ссылку.':
    'The file is over the limit stated by the field. That is an archive, not a drawing: keep it elsewhere and give a link.',
  'Напишите причину: её увидит и бюро, и тот, кто придёт на замену.':
    'Write the reason: both the bureau and your replacement will see it.',
  'Неизвестный статус.': 'Unknown status.',
  'Ёмкость — от 0 до 60 часов в неделю.': 'Capacity runs from 0 to 60 hours a week.',
  'Доступность обновлена.': 'Availability updated.',
  'Тикет назначен не вам.': 'This ticket is assigned to someone else.',
  'В команде проекта нет такой дисциплины — просить некого.':
    'The project team has no such discipline — there is no one to ask.',
  'Тикет сейчас в другом статусе: это действие недоступно.':
    'The ticket is in a different state right now: this action is unavailable.',
  'Файл больше потолка, указанного у поля. Это уже не чертёж, а архив: положите его отдельно и приложите ссылкой.':
    'The file is over the limit stated by the field. That is an archive, not a drawing: keep it elsewhere and attach it as a link.',
  'Без причины выход не оформляется: её увидит тот, кто придёт.':
    'Leaving is not recorded without a reason: whoever replaces you will read it.',
  'Вы не ведёте роль на этом проекте.': 'You do not hold a role on this project.',

  // --- Ключ доступа: выдача и напоминание ---
  'ключ доступа': 'access key',
  'Ключ доступа:': 'Access key:',
  'кабинет проекта': 'the project cabinet',
  'доску работ': 'the work board',
  'Введите его на {url}, чтобы открыть {where}.': 'Enter it at {url} to open {where}.',
  'Ключ заменяет пароль — не пересылайте его.':
    'The key stands in for a password — do not forward it.',
  'Вы попросили напомнить ключ. За этим адресом числится:':
    'You asked us to remind you of your key. This address holds:',
  'Проект «{title}» — ключ {key}': 'Project “{title}” — key {key}',
  'Доска работ — ключ {key}': 'Work board — key {key}',
  'Вход: {url}': 'Sign in: {url}',
  'Если ключ не просили вы — письмо можно не читать: по нему ничего не произошло.':
    'If you did not ask for this, there is nothing to do: nothing happened on your account.',
  'Ключ не сохранился': 'Lost your key',
  'Ключ пришлём на тот адрес, на который выдавали. Нового ключа не будет: старое письмо, если оно найдётся, продолжит работать.':
    'We send the key to the address it was issued to. There will be no new key: the old email, if it turns up, keeps working.',
  'Адрес почты': 'Email address',
  'Тот, на который выдавали ключ': 'The one the key was issued to',
  'Напомнить ключ': 'Remind me',
  'Введите адрес почты.': 'Enter an email address.',
  'Если этот адрес у нас есть, письмо с ключом уже ушло. Проверьте почту.':
    'If we have this address, the email with the key has already gone out. Check your inbox.',

  // --- Вход ---
  'Введите ключ доступа.': 'Enter your access key.',
  'Такого ключа нет.': 'No such key.',
  'Этот ключ больше не активен.': 'This key is no longer active.',
  'Заявка ещё на разборе. Ключ заработает, когда портфолио пройдёт порог.':
    'The application is still under review. The key starts working once the portfolio passes the threshold.',
  'Слишком часто. Попробуйте через минуту.': 'Too often. Try again in a minute.',
  'Слишком часто. Попробуйте через {minutes} мин.': 'Too often. Try again in {minutes} min.',

  // --- Адрес не открылся и сбой ---
  'Адрес не открылся': 'Page not found',
  'Такого адреса нет': 'There is no such address',
  'Ссылка могла устареть — например, пришла из старого письма. Так же отвечает адрес, который существует, но не ваш: чужой проект и чужой тикет неотличимы от несуществующих намеренно, иначе по ответу можно было бы проверять, что у нас есть.':
    'The link may be out of date — from an old email, say. An address that exists but is not yours answers the same way: someone else’s project and someone else’s ticket are indistinguishable from ones that do not exist, deliberately — otherwise the answer itself could be used to check what we hold.',
  'На главную': 'To the home page',
  'Войти по ключу — кабинет проекта или доска работ':
    'Sign in with a key — project cabinet or work board',
  Сбой: 'Failure',
  'Страница не собралась': 'The page did not come together',
  'Это наша сторона, а не ваша. Отправленное раньше — бриф, комментарий, загруженный файл — на месте: сбой произошёл при показе страницы, а не при записи.':
    'This is our side, not yours. What you sent earlier — a brief, a comment, an uploaded file — is where you left it: the failure happened while showing the page, not while writing.',
  'Попробовать снова': 'Try again',
  'Если повторится, назовите бюро эту метку:': 'If it happens again, give the bureau this mark:',
}
