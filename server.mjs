import express from 'express'
import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT ?? 4173)
const token = process.env.ALERTS_IN_UA_TOKEN
const cacheDurationMs = 60_000
let cachedResponse = null

app.get('/api/alerts/active', async (_request, response) => {
  if (!token) {
    try {
      const reportResponse = await fetch('https://api.alerts.in.ua/v3/alerts/active.md')
      if (!reportResponse.ok) {
        response.status(reportResponse.status).json({ message: 'Публічний звіт тривог тимчасово недоступний.' })
        return
      }

      response.type('text/markdown').send(await reportResponse.text())
    } catch {
      response.status(502).json({ message: 'Не вдалося з’єднатися з API тривог.' })
    }
    return
  }

  if (cachedResponse && Date.now() - cachedResponse.createdAt < cacheDurationMs) {
    response.json(cachedResponse.payload)
    return
  }

  try {
    const apiResponse = await fetch('https://api.alerts.in.ua/v1/alerts/active.json', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const payload = await apiResponse.json()

    if (!apiResponse.ok) {
      response.status(apiResponse.status).json({ message: payload.message ?? 'Помилка API тривог.' })
      return
    }

    const normalizedPayload = { alerts: payload.alerts ?? [], fetchedAt: new Date().toISOString() }
    cachedResponse = { createdAt: Date.now(), payload: normalizedPayload }
    response.json(normalizedPayload)
  } catch {
    response.status(502).json({ message: 'Не вдалося з’єднатися з API тривог.' })
  }
})

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
app.use(express.static(path.join(currentDirectory, 'dist')))
app.get('/{*path}', (_request, response) => response.sendFile(path.join(currentDirectory, 'dist', 'index.html')))

app.listen(port, () => console.log(`AntiSHAHED server listening on http://localhost:${port}`))