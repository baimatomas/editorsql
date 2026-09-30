import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './quiz.css'

const quizFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-quiz',
})

export const metadata: Metadata = {
  title: 'Preguntas · EditorSQL',
  description: 'Juego de preguntas en vivo para la clase',
  icons: { icon: '/favicon.svg' },
}

export default function QuizLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${quizFont.variable} preguntas-root`}
      style={{ fontFamily: 'var(--font-quiz), system-ui, sans-serif' }}
    >
      <div className="blob bg-violet-600" style={{ width: 420, height: 420, top: '-8%', left: '-6%' }} />
      <div className="blob bg-fuchsia-500" style={{ width: 360, height: 360, bottom: '-10%', right: '-4%', animationDelay: '-6s' }} />
      <div className="blob bg-cyan-500" style={{ width: 300, height: 300, top: '35%', left: '55%', animationDelay: '-11s' }} />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
