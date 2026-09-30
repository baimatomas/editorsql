'use client'

import { useEffect, useState } from 'react'
import { OPTION_CLASSES } from '../lib/game'

const OPTION_GLYPHS = ['▲', '◆', '●', '■']

export type RevealState = 'none' | 'correct' | 'wrong'

/**
 * Grilla de opciones. En modo "player" es clickeable; en modo "host" solo
 * muestra conteos. `reveal` pinta la correcta/incorrecta al mostrar resultado.
 */
export default function AnswerGrid({
  options,
  onAnswer,
  disabled,
  chosen,
  reveal,
  correctIndex,
  counts,
  columns = 2,
}: {
  options: string[]
  onAnswer?: (index: number) => void
  disabled?: boolean
  chosen?: number | null
  reveal?: RevealState
  correctIndex?: number | null
  counts?: number[]
  columns?: 2 | 4
}) {
  return (
    <div
      className={`grid gap-3 md:gap-4 ${columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-4'}`}
    >
      {options.map((opt, i) => {
        const style = OPTION_CLASSES[i] ?? OPTION_CLASSES[0]
        const isCorrect = reveal !== 'none' && correctIndex === i
        const isWrongPick = reveal === 'wrong' && chosen === i
        return (
          <button
            key={i}
            disabled={disabled || !onAnswer}
            onClick={() => onAnswer?.(i)}
            className={`relative flex items-center gap-3 md:gap-4 px-4 md:px-6 py-4 md:py-5 rounded-2xl border text-left font-semibold
                        transition-all duration-200 border ${style.bg}
                        ${disabled && onAnswer ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                        ${onAnswer && !disabled ? 'hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl' : ''}
                        ${isCorrect ? 'ring-4 ring-emerald-300 scale-[1.03] !from-emerald-500/90 !to-emerald-700/90' : ''}
                        ${isWrongPick ? 'animate-shake ring-4 ring-rose-400/70' : ''}
                        ${chosen === i && reveal === 'none' ? 'ring-4 ring-white/70' : ''}`}
          >
            <span className="text-2xl md:text-3xl flex-shrink-0 opacity-90 select-none">
              {OPTION_GLYPHS[i]}
            </span>
            <span className="flex-1 text-sm md:text-lg leading-snug">{opt}</span>
            {counts && (
              <span className="text-lg md:text-2xl font-bold tabular-nums opacity-90 flex-shrink-0">
                {counts[i] ?? 0}
              </span>
            )}
            {isCorrect && (
              <span className="absolute -top-2.5 -right-2.5 bg-emerald-300 text-emerald-950 text-xs font-bold px-2 py-0.5 rounded-full animate-pop-in">
                ✓
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
