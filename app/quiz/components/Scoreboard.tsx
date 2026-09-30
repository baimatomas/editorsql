'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Flame } from 'lucide-react'

export interface ScoreRow {
  id: string
  nickname: string
  score: number
  streak: number
}

export default function Scoreboard({
  rows,
  highlightId,
  title = 'Top 5',
}: {
  rows: ScoreRow[]
  highlightId?: string
  title?: string
}) {
  const top = [...rows].sort((a, b) => b.score - a.score).slice(0, 5)
  const medals = ['🥇', '🥈', '🥉', '4', '5']

  return (
    <div className="w-full max-w-md mx-auto">
      <h3 className="text-center text-xs uppercase tracking-[0.3em] text-violet-300/60 mb-3">{title}</h3>
      <div className="space-y-2">
        {top.length === 0 && (
          <p className="text-center text-sm text-violet-200/40 py-4">Aún no hay puntajes</p>
        )}
        {top.map((row, i) => (
          <motion.div
            key={row.id}
            layout
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border backdrop-blur-sm ${
              row.id === highlightId
                ? 'bg-fuchsia-500/25 border-fuchsia-300/60'
                : 'bg-violet-500/10 border-violet-400/20'
            }`}
          >
            <span className="text-lg w-7 text-center flex-shrink-0">{medals[i]}</span>
            <span className="flex-1 font-semibold truncate">{row.nickname}</span>
            {row.streak >= 2 && (
              <span className="flex items-center gap-0.5 text-xs text-orange-300 font-bold">
                <Flame size={12} />
                {row.streak}
              </span>
            )}
            <motion.span
              key={row.score}
              initial={{ scale: 1.35, color: '#f0abfc' }}
              animate={{ scale: 1, color: '#f5f3ff' }}
              className="font-bold tabular-nums text-right w-16"
            >
              {row.score.toLocaleString('es-AR')}
            </motion.span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
