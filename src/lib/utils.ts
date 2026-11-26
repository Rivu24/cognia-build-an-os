import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function mins(m: number | undefined) {
  const v = Math.round(m || 0)
  if (v < 60) return `${v} min`
  return v % 60 ? `${Math.floor(v / 60)} h ${v % 60} min` : `${v / 60} h`
}

export function trunc(s: string | undefined, n: number) {
  const t = s || ''
  if (t.length <= n) return t
  return t.slice(0, n).replace(/\s+\S*$/, '').replace(/[,;:.]$/, '') + '…'
}

export const LEVELS: Record<number, string> = { 1: 'Beginner', 2: 'Medium', 3: 'Advanced', 4: 'Master' }
