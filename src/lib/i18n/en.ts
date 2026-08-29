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

  // --- Кабинет заказчика ---
  'Кабинет проекта': 'Project workspace',
  'Сохраните ключ доступа': 'Save your access key',
  'Ключ заменяет пароль: по нему вы вернётесь в кабинет с любого устройства. Копия ушла на N — но если письмо не дойдёт, останется только этот экран.':
    'The key replaces a password: it gets you back into this workspace from any device. A copy went to N — but if that email never arrives, this screen is all there is.',
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
  'Нижняя граница чека за эту стадию — F C. По площади вышло бы меньше, но посадка на участок, согласования и координация команды на маленьком объекте стоят почти столько же, сколько на большом.':
    'The floor price for this stage is F C. By area it would come out lower, but siting, approvals and team coordination on a small building cost almost as much as on a large one.',
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
  'Специалисты под ваш проект есть, но ни у кого из них нет права подписи в стране «N». Пакет документации без местной подписи не имеет силы — его не примут в органах, и браться за проект без неё значит продать вам бумагу. Бюро ищет подписанта; ключ доступа у вас, по нему вы вернётесь в проект.':
    'There are specialists for your project, but none of them holds signing rights in N. A documentation set without a local signature has no force — the authorities will not accept it, and taking the project on without one would mean selling you paper. The bureau is looking for a signatory; you have your key and can come back to the project with it.',

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
  'Поставка · вес N%': 'Delivery · weight N%',
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
  'Подтвердить стадию «N»': 'Confirm the “N” stage',
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
}
