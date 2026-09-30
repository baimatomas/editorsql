'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import type { QuizPlayer } from '../lib/types'

export default function Podium({
  players,
  highlightId,
  onRestart,
}: {
  players: QuizPlayer[]
  highlightId?: string
  onRestart?: () => void
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const first = sorted[0]
  const second = sorted[1]
  const third = sorted[2]

  useEffect(() => {
    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        origin: { y: 0.6 },
        colors: ['#c084fc', '#f0abfc', '#67e8f9', '#fbbf24'],
        particleCount: Math.floor(220 * particleRatio),
        ...opts,
      })
    }
    fire(0.25, { spread: 30, startVelocity: 55 })
    fire(0.2, { spread: 60 })
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.9 })
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
    fire(0.1, { spread: 120, startVelocity: 45 })
  }, [])

  const step = (place: number) =>
    place === 1 ? first : place === 2 ? second : third

  const heights = { 1: 'h-40', 2: 'h-28', 3: 'h-20' }
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' }
  const podiumColors = {
    1: 'from-amber-400/30 border-amber-300/60',
    2: 'from-slate-300/25 border-slate-200/50',
    3: 'from-orange-700/30 border-orange-400/40',
  }

  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <motion.h2
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="text-4xl md:text-5xl font-bold mb-10"
      >
        <span className="bg-gradient-to-r from-amber-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
          ¡Fin del juego!
        </span>
      </motion.h2>

      <div className="flex items-end justify-center gap-3 md:gap-6 mb-12">
        {[2, 1, 3].map((place) => {
          const p = step(place)
          return (
            <motion.div
              key={place}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 + (place === 1 ? 0.25 : place === 2 ? 0 : 0.5), type: 'spring', stiffness: 160, damping: 18 }}
              className="flex flex-col items-center"
            >
              <div
                className={`text-4xl md:text-5xl mb-2 ${p && p.id === highlightId ? 'animate-pop-in' : ''}`}
              >
                {medals[place as 1 | 2 | 3]}
              </div>
              <div
                className={`text-sm md:text-lg font-bold mb-1 max-w-[110px] truncate ${
                  p?.id === highlightId ? 'text-fuchsia-200' : 'text-violet-100'
                }`}
              >
                {p?.nickname ?? '—'}
              </div>
              <div
                className={`text-xs md:text-sm text-violet-300/70 font-semibold tabular-nums mb-2`}
              >
                {p ? p.score.toLocaleString('es-AR') : '0'} pts
              </div>
              <div
                className={`w-20 md:w-28 rounded-t-xl border border-b-0 bg-gradient-to-t ${podiumColors[place as 1 | 2 | 3]} ${heights[place as 1 | 2 | 3]}`}
              />
              <span className="text-violet-300/50 font-bold -mt-6">{place}</span>
            </motion.div>
          )
        })}
      </div>

      {sorted.length > 3 && (
        <div className="space-y-1.5 mb-10">
          {sorted.slice(3, 8).map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 text-sm px-4 py-2 rounded-lg border ${
                p.id === highlightId
                  ? 'bg-fuchsia-500/20 border-fuchsia-300/50'
                  : 'bg-violet-500/5 border-violet-400/15'
              }`}
            >
              <span className="text-violet-300/50 w-6">{i + 4}°</span>
              <span className="flex-1 text-left truncate">{p.nickname}</span>
              <span className="font-semibold tabular-nums">{p.score.toLocaleString('es-AR')}</span>
            </div>
          ))}
        </div>
      )}

      {onRestart && (
        <button
          onClick={onRestart}
          className="px-8 py-3.5 rounded-xl font-bold bg-gradient-to-r from-fuchsia-500 to-violet-500
                     hover:from-fuchsia-400 hover:to-violet-400 transition-all hover:scale-105"
        >
          Nueva partida
        </button>
      )}
    </div>
  )
}
