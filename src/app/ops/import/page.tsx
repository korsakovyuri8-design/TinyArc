import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PORTFOLIO_THRESHOLD } from '@/engine/taxonomy'
import { prisma } from '@/lib/db'
import { isOperator } from '@/lib/session'
import { MAX_IMPORT_ROWS } from '@/lib/services/intake'
import { previewIntake, runIntake, sendInvites } from '../actions'
import { OpsAction } from '../OpsForms'

export const metadata = { title: 'Импорт базы — панель бюро' }

export default async function ImportPage() {
  if (!(await isOperator())) redirect('/ops')

  const [invited, waiting, silent] = await Promise.all([
    prisma.specialist.count({ where: { status: 'invited' } }),
    prisma.specialist.count({ where: { status: 'invited', invitedAt: null } }),
    prisma.specialist.count({
      where: {
        status: 'invited',
        invitedAt: { lt: new Date(Date.now() - 7 * 24 * 3_600_000) },
      },
    }),
  ])

  return (
    <section style={{ paddingTop: 'clamp(40px, 7vw, 72px)' }}>
      <div className="shell" style={{ maxWidth: 900 }}>
        <Link href="/ops" className="label">
          ← панель
        </Link>
        <h1 style={{ marginTop: 18 }}>Импорт базы специалистов</h1>

        <p className="muted" style={{ marginTop: 14, maxWidth: '62ch' }}>
          Импорт никого не пускает в выборку. Он заводит запись, выдаёт ключ и зовёт человека
          дозаполнить профиль. До этого рейтинг портфолио нулевой, а порог — {PORTFOLIO_THRESHOLD}
          /10: первый же гейт такую запись не пропускает.
        </p>

        <p className="hint" style={{ marginTop: 12, maxWidth: '62ch' }}>
          Так и задумано. В базе, собранной руками, нет ни юрисдикций, ни пакета, ни часового
          пояса, ни свободной ёмкости. Отбор по такой записи собрал бы команду из умолчаний —
          и заметно это стало бы уже на проекте.
        </p>

        {invited > 0 && (
          <div className="panel" style={{ marginTop: 28 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div className="num" style={{ fontSize: '2rem' }}>{invited}</div>
                <div className="label">заведены, профиль не заполнен</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {waiting > 0 && <span className="tag tag-accent">не позваны · {waiting}</span>}
                {silent > 0 && <span className="tag tag-wait">молчат больше недели · {silent}</span>}
              </div>
            </div>
          </div>
        )}

        <div className="divider" style={{ marginTop: 40 }} />

        <h2>Что нужно в таблице</h2>
        <p className="muted" style={{ marginTop: 12, maxWidth: '62ch' }}>
          Обязательны два столбца: <strong>имя</strong> и <strong>почта</strong>. Остальное —
          насколько есть; чего нет, человек допишет сам. Заголовки узнаются по-русски и
          по-английски, разделитель — запятая, точка с запятой или табуляция.
        </p>

        <div className="table-scroll panel" style={{ padding: 0, marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Столбец</th>
                <th>Как может называться</th>
                <th>Что понимает</th>
              </tr>
            </thead>
            <tbody>
              <Row
                name="Имя"
                aliases="имя, фио, name, специалист"
                reads="как есть"
              />
              <Row name="Почта" aliases="почта, email, адрес" reads="проверяется на вид адреса" />
              <Row name="Роль" aliases="роль, дисциплина, специальность" reads="«Архитектор», «Конструктор», «ОВиК», «Ландшафтный архитектор»" />
              <Row name="Специализация" aliases="специализация" reads="«Монолит», «Дерево, CLT», «Генплан»" />
              <Row name="Страна" aliases="страна, юрисдикция, country" reads="«Черногория», «ME», «Montenegro», «Тиват»" />
              <Row name="Софт" aliases="софт, ПО, software" reads="«Revit», «ArchiCAD», «Автокад»" />
              <Row name="Язык" aliases="язык, языки" reads="«русский», «сербский», «English»" />
              <Row name="Стадия" aliases="стадия, стадии" reads="«Концепция», «Разрешение», «Рабочая документация»" />
              <Row name="Портфолио" aliases="портфолио, ссылка, behance" reads="ссылка как есть" />
              <Row name="Этажность" aliases="этажность, этажи" reads="число; выше пяти срезается до пяти" />
            </tbody>
          </table>
        </div>

        <p className="hint" style={{ marginTop: 14 }}>
          Столбцы, которых нет в этом списке, не импортируются — но и не мешают: разбор их
          назовёт, чтобы вы видели, что осталось за бортом. Значение, которого нет в
          таксономии, тоже не угадывается: «Сметчик» попадёт в отчёт, а не в дисциплину.
        </p>

        <div className="divider" style={{ marginTop: 40 }} />

        <h2>Вставьте таблицу</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          Скопируйте из Excel или Google Sheets вместе со строкой заголовков.
          Сначала <strong>«Разобрать»</strong> — он ничего не создаёт и только показывает,
          что система прочла. Заводить записи — второй кнопкой.
        </p>

        <OpsAction action={previewIntake} label="Разобрать">
          <div className="field">
            <label htmlFor="csv-preview">Таблица</label>
            <textarea
              id="csv-preview"
              name="csv"
              style={{ minHeight: 200, fontFamily: 'var(--font-space-mono), monospace', fontSize: '0.8rem' }}
              placeholder={'Имя;Почта;Роль;Страна;Софт;Язык;Портфолио\nИван Петров;ivan@example.com;Архитектор;Черногория;Revit;русский, английский;https://behance.net/ivan'}
            />
          </div>
        </OpsAction>

        <div className="divider" style={{ marginTop: 40 }} />

        <h2>Завести записи</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          Вставьте ту же таблицу ещё раз — намеренно: заведение записей не должно случаться
          от повторного нажатия на форму предпросмотра. Адреса, которые уже есть в базе,
          пропускаются: импорт не перезаписывает профиль, который человек мог заполнить сам.
          За один заход берётся до {MAX_IMPORT_ROWS} строк; остальное — следующим.
        </p>

        <OpsAction action={runIntake} label="Завести записи" solid>
          <div className="field">
            <label htmlFor="csv-run">Таблица</label>
            <textarea
              id="csv-run"
              name="csv"
              style={{ minHeight: 200, fontFamily: 'var(--font-space-mono), monospace', fontSize: '0.8rem' }}
            />
          </div>
        </OpsAction>

        <div className="divider" style={{ marginTop: 40 }} />

        <h2>Позвать заведённых</h2>
        <p className="muted" style={{ marginTop: 12, marginBottom: 24, maxWidth: '62ch' }}>
          Письмо с ключом и ссылкой на профиль уходит тем, кого завели и ещё не звали.
          Отдельной кнопкой, а не вместе с заведением: вставка записей — один запрос, письмо —
          сетевой вызов на человека, и связывать их значит ставить заведение базы в
          зависимость от почтового провайдера.
        </p>

        <OpsAction action={sendInvites} label="Разослать приглашения" solid />

        <p className="hint" style={{ marginTop: 16 }}>
          Идёт порциями — если ждущих больше, нажмите ещё раз. Приглашённым отмечается только
          тот, до кого письмо дошло: иначе человек молча выпал бы из рассылки навсегда.
          В режиме почты-заглушки письма никуда не уйдут, и ключи видны в списке приглашённых
          на странице заявок — передадите тем каналом, которым и так общаетесь.
        </p>
      </div>
    </section>
  )
}

function Row({ name, aliases, reads }: { name: string; aliases: string; reads: string }) {
  return (
    <tr>
      <td>{name}</td>
      <td className="dim" style={{ fontSize: '0.85rem' }}>{aliases}</td>
      <td className="dim" style={{ fontSize: '0.85rem' }}>{reads}</td>
    </tr>
  )
}
