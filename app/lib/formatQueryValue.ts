import type { QueryColumn } from '@/app/providers'

const DATE_OID = 1082
const TIMESTAMP_OIDS = new Set([1114, 1184])

const DATE_RE = /^(\d{4,})-(\d{2})-(\d{2})/
const TIME_RE = /[ T](\d{2}):(\d{2})(?::(\d{2}))?/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDateParts(value: string): string | null {
  const match = value.match(DATE_RE)
  if (!match) return null
  return `${match[3]}/${match[2]}/${match[1]}`
}

function formatDate(value: unknown): string {
  if (typeof value === 'string') {
    return formatDateParts(value) ?? value
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // PGlite parses a `date` as UTC midnight. Reading the UTC components keeps
    // the calendar day that was inserted instead of shifting it to the local
    // timezone (which would show the previous day in negative offsets).
    return `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`
  }

  return String(value)
}

function formatDateTime(value: unknown): string {
  if (typeof value === 'string') {
    const date = formatDateParts(value)
    const time = value.match(TIME_RE)
    if (date && time) {
      return `${date} ${time[1]}:${time[2]}:${time[3] ?? '00'}`
    }
    return date ?? value
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  }

  return String(value)
}

export function formatQueryValue(value: unknown, column: QueryColumn | undefined): string {
  if (value === null || value === undefined) return ''
  if (!column) return String(value)
  if (column.dataTypeID === DATE_OID) return formatDate(value)
  if (TIMESTAMP_OIDS.has(column.dataTypeID)) return formatDateTime(value)
  return String(value)
}
