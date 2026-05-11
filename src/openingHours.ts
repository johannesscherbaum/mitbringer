const DAYS = ['so', 'mo', 'tu', 'we', 'th', 'fr', 'sa'] // JS getDay() order
const DAY_LABELS: Record<string, string> = {
  mo: 'Mo', tu: 'Di', we: 'Mi', th: 'Do', fr: 'Fr', sa: 'Sa', su: 'So'
}
const DAY_KEYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']

export type OpeningHours = {
  mo?: string | null; tu?: string | null; we?: string | null; th?: string | null
  fr?: string | null; sa?: string | null; su?: string | null
}

/** Returns today's opening hours string or null */
export function todayHours(oh: OpeningHours | null | undefined): string | null {
  if (!oh) return null
  const key = DAYS[new Date().getDay()]
  return (oh as any)[key] || null
}

/** Renders full week as compact string, grouping consecutive equal days */
export function formatHoursFull(oh: OpeningHours | null | undefined): string {
  if (!oh) return ''
  return DAY_KEYS
    .map(k => {
      const v = (oh as any)[k]
      return v ? `${DAY_LABELS[k]} ${v}` : `${DAY_LABELS[k]} geschl.`
    })
    .join(' · ')
}

/** Editor component data */
export { DAY_KEYS, DAY_LABELS }
