export type AlertLevel = 'red' | 'yellow'

export type ActiveAlert = {
  id: number
  location_title: string
  location_oblast?: string
  areas?: string[]
  alert_type: string
  started_at?: string | number
  alert_level?: AlertLevel
  threats?: { level: AlertLevel; threat_type: string }[]
}

type AlertsPayload = {
  alerts?: ActiveAlert[]
  fetchedAt?: string
  message?: string
}

function extractAffectedAreas(details: string) {
  const affectedSection = details.match(/areas affected:\s*([\s\S]*?)(?=\s*\[(?:red|yellow)\s*\(|\.\s*(?:The most recent|Alert level:)|$)/i)?.[1] ?? ''
  return [...affectedSection.matchAll(/\(([^)]+)\)/g)].flatMap((match) => match[1]
    .split(/[,;]/)
    .map((area) => area.trim())
    .filter(Boolean))
}

function parsePublicReport(markdown: string): ActiveAlert[] {
  const currentStatus = markdown.match(/## 3\. CURRENT WARNING STATUS([\s\S]*?)(?=\n## 4\.)/)?.[1]
  if (!currentStatus) throw new Error('Невідомий формат публічного звіту тривог')

  const entries = currentStatus.matchAll(/\*\*[^\n(]+\(([^)]+)\)\*\* — ([\s\S]*?)(?=\n\n\*\*|$)/g)
  return [...entries].map((match, index) => {
    const [, oblast, details] = match
    const startedAt = details.match(/in effect since\s+(.+?),\s*ongoing/i)?.[1]
    const alertType = details.includes('artillery shelling')
      ? 'artillery_shelling'
      : details.includes('urban fighting')
        ? 'urban_fights'
        : details.includes('chemical')
          ? 'chemical'
          : details.includes('nuclear')
            ? 'nuclear'
            : 'air_raid'

    return {
      id: index,
      location_title: oblast,
      location_oblast: oblast,
      areas: extractAffectedAreas(details),
      alert_type: alertType,
      started_at: startedAt,
      alert_level: details.includes('[red') ? 'red' : 'yellow',
    }
  })
}

export async function fetchActiveAlerts(signal?: AbortSignal) {
  const response = await fetch('/api/alerts/active', { signal })

  if (!response.ok) {
    const payload = await response.json() as AlertsPayload
    throw new Error(payload.message ?? 'Не вдалося отримати стан тривог')
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = await response.json() as AlertsPayload
    return { alerts: payload.alerts ?? [], fetchedAt: payload.fetchedAt }
  }

  return { alerts: parsePublicReport(await response.text()), fetchedAt: new Date().toISOString() }
}