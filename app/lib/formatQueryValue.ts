import type { QueryColumn } from '@/app/providers'

const DATE_OID = 1082
const TIMESTAMP_OIDS = new Set([1114, 1184])

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== 'string') return null

  // A PostgreSQL date has no time zone. Parse it as calendar components so
  // it cannot move to the previous/next day in a different local timezone.
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|\s)/)
  if (dateMatch) {
    const [, year, month, day] = dateMatch
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: unknown): string {
  const date = parseDateValue(value)
  if (!date) return String(value)
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

function formatDateTime(value: unknown): string {
  const date = parseDateValue(value)
  if (!date) return String(value)

  // Use local time, matching the usual database-client display behaviour for
  // timestamps with time zone. Hours are 24-hour values despite the requested
  // hh:mm:ss notation, avoiding ambiguity between AM and PM.
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function formatQueryValue(value: unknown, column: QueryColumn | undefined): string {
  if (value === null || value === undefined) return ''
  if (!column) return String(value)
  if (column.dataTypeID === DATE_OID) return formatDate(value)
  if (TIMESTAMP_OIDS.has(column.dataTypeID)) return formatDateTime(value)
  return String(value)
}
