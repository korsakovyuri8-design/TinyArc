'use client'

import { useEffect, useState } from 'react'
import { translate } from '@/lib/i18n/dict'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locale'

/**
 * Страница сбоя.
 *
 * Показывается вместо содержимого, когда серверная отрисовка упала. Она не
 * извиняется абстрактно: человеку нужно знать, потерялось ли то, что он делал,
 * и что нажать сейчас. Повтор — первым, потому что в половине случаев это
 * сорванное соединение с базой, и второй заход проходит.
 *
 * Язык берётся из атрибута `lang`, который поставил макет: клиентский
 * компонент заголовков запроса не видит, а свойств ему никто не передаёт.
 * Чтение — в useEffect, чтобы отрисовка на сервере и в браузере совпали;
 * английский появляется через кадр после первой отрисовки. Ради страницы,
 * которую человек видит раз в год, это честный размен: расхождение разметки
 * стоило бы предупреждения в консоли и второй отрисовки всей страницы.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    const lang = document.documentElement.lang
    if (isLocale(lang)) setLocale(lang)
  }, [])

  useEffect(() => {
    console.error('Страница упала:', error)
  }, [error])

  const t = (text: string) => translate(text, locale)

  return (
    <section style={{ paddingTop: 'clamp(48px, 8vw, 96px)' }}>
      <div className="shell" style={{ maxWidth: 620 }}>
        <span className="eyebrow">{t('Сбой')}</span>
        <h1 style={{ maxWidth: '18ch' }}>{t('Страница не собралась')}</h1>

        <p className="lead" style={{ marginTop: 20 }}>{t('Это наша сторона, а не ваша. Отправленное раньше — бриф, комментарий, загруженный файл — на месте: сбой произошёл при показе страницы, а не при записи.')}</p>

        <div className="row" style={{ gap: 16, marginTop: 32 }}>
          <button type="button" className="btn btn-solid" onClick={reset}>
            {t('Попробовать снова')}
          </button>
          <a href="/" className="btn btn-quiet">
            {t('На главную')}
          </a>
        </div>

        {/*
          Цифра сбоя — то, по чему его находят в журнале. Без неё разговор с
          бюро сводится к «у меня что-то не открылось», и найти это «что-то»
          можно только по времени.
        */}
        {error.digest && (
          <p className="hint" style={{ marginTop: 24 }}>
            {t('Если повторится, назовите бюро эту метку:')}{' '}
            <span className="num">{error.digest}</span>
          </p>
        )}
      </div>
    </section>
  )
}
