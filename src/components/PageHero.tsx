import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Первый экран внутренней страницы.
 *
 * Главная открывается ночью, и остальные страницы должны открываться так же,
 * иначе сайт выглядит как два сайта: тёмный вход и бумажные комнаты за ним.
 * Тон выбирается по тому, с кем страница говорит, а не по вкусу:
 *
 *   night   заказчик: бриф, вход, кабинет проекта, документы
 *   grove   механизм: как устроены стадии, как выбирает алгоритм
 *   cellar  специалист: пул, анкета, рабочая доска
 *
 * Ниже первого экрана страница остаётся бумагой: там читают и заполняют, и
 * тёмный фон под формой только мешал бы.
 */
export function PageHero({
  tone = 'night',
  eyebrow,
  title,
  back,
  aside,
  lead,
  meta,
  width,
  children,
}: {
  tone?: 'night' | 'grove' | 'cellar'
  eyebrow: string
  title: ReactNode
  lead?: ReactNode
  /** Мелкая строка под заголовком: редакция документа, дата. */
  meta?: ReactNode
  /** Ширина колонки, как у содержимого ниже, чтобы край не прыгал. */
  width?: number
  /** Ссылка назад в кабинетах: над подписью, мелко. */
  back?: { href: string; label: string }
  /** Справа от заголовка: статус, метка, кнопка. */
  aside?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className={`${tone} page-hero`}>
      <div className="shell" style={width ? { maxWidth: width } : undefined}>
        {back && (
          <Link href={back.href} className="hero-back">
            {back.label}
          </Link>
        )}
        <span className="eyebrow">{eyebrow}</span>
        {aside ? (
          <div className="hero-title-row">
            <h1>{title}</h1>
            <div className="hero-aside">{aside}</div>
          </div>
        ) : (
          <h1>{title}</h1>
        )}
        {meta && <p className="hero-meta">{meta}</p>}
        {lead && <p className="lead">{lead}</p>}
        {children && <div className="hero-extra">{children}</div>}
      </div>
    </section>
  )
}
