'use client'

export default function TimerRing({
  secondsLeft,
  total,
  size = 84,
}: {
  secondsLeft: number
  total: number
  size?: number
}) {
  const radius = size / 2 - 6
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? Math.max(secondsLeft, 0) / total : 0

  const strokeColor =
    progress > 0.5 ? '#a78bfa' : progress > 0.25 ? '#fbbf24' : '#fb7185'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(167,139,250,0.15)"
          strokeWidth={6}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.5s' }}
        />
      </svg>
      <div
        className={`absolute inset-0 flex items-center justify-center font-bold tabular-nums ${
          secondsLeft <= 5 ? 'animate-pop-in text-rose-300' : 'text-violet-100'
        }`}
        style={{ fontSize: size / 3.2 }}
        key={secondsLeft}
      >
        {Math.max(secondsLeft, 0)}
      </div>
    </div>
  )
}
