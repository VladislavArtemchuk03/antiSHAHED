import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  ChevronRight,
  CircleCheck,
  Map,
  Minus,
  Plus,
  RefreshCw,
  ShieldAlert,
  Siren,
  X,
} from 'lucide-react'
import ukraineMap from '@svg-maps/ukraine'
import { type ActiveAlert, fetchActiveAlerts } from './api/alerts'
import { RegionAlertsProvider, type RegionAlert, type RegionState, useRegionAlert } from './hooks/useRegionAlert'
import './App.css'
import './districts.css'
import './district-map.css'
import { districtsByRegion } from './data/districts'
import type { LegacyDistrictPath } from './data/legacyDistrictMaps'

type SvgMapLocation = { id: string; name: string; path: string }

const mapLocations = ukraineMap.locations as SvgMapLocation[]
const extraTerritories = [{ id: 'sevastopol', name: 'м. Севастополь' }]
const displayRegions = [...mapLocations, ...extraTerritories]
const mapZoomStep = 0.2
const minimumMapZoom = 1
const maximumMapZoom = 1.8

const createSafeRegionAlerts = (): Record<string, RegionAlert> => Object.fromEntries(
  displayRegions.map(({ id }) => {
    const state: RegionState = id === 'crimea' || id === 'sevastopol' ? 'neutral' : 'safe'
    return [id, {
      state,
      types: [] as string[],
      districts: (districtsByRegion[id] ?? []).map((name) => ({ name, state })),
    }]
  }),
)

const regionNames: Record<string, string> = {
  cherkasy: 'Черкаська', chernihiv: 'Чернігівська', chernivtsi: 'Чернівецька', crimea: 'АР Крим',
  dnipropetrovsk: 'Дніпропетровська', donetsk: 'Донецька', 'ivano-frankivsk': 'Івано-Франківська',
  kharkiv: 'Харківська', kherson: 'Херсонська', khmelnytskyi: 'Хмельницька', kirovohrad: 'Кіровоградська',
  kyiv: 'Київська', 'kyiv-city': 'м. Київ', luhansk: 'Луганська', lviv: 'Львівська', mykolaiv: 'Миколаївська', sevastopol: 'м. Севастополь',
  odessa: 'Одеська', poltava: 'Полтавська', rivne: 'Рівненська', sumy: 'Сумська', ternopil: 'Тернопільська',
  vinnytsia: 'Вінницька', volyn: 'Волинська', zakarpattia: 'Закарпатська', zaporizhia: 'Запорізька', zhytomyr: 'Житомирська',
}

const apiLocationToRegion: Record<string, string> = {
  'Автономна Республіка Крим': 'crimea', 'Вінницька область': 'vinnytsia', 'Волинська область': 'volyn',
  'Дніпропетровська область': 'dnipropetrovsk', 'Донецька область': 'donetsk', 'Житомирська область': 'zhytomyr',
  'Закарпатська область': 'zakarpattia', 'Запорізька область': 'zaporizhia', 'Івано-Франківська область': 'ivano-frankivsk',
  'Київська область': 'kyiv', 'Кіровоградська область': 'kirovohrad', 'Луганська область': 'luhansk',
  'Львівська область': 'lviv', 'Миколаївська область': 'mykolaiv', 'Одеська область': 'odessa', 'Полтавська область': 'poltava',
  'Рівненська область': 'rivne', 'Сумська область': 'sumy', 'Тернопільська область': 'ternopil',
  'Харківська область': 'kharkiv', 'Херсонська область': 'kherson', 'Хмельницька область': 'khmelnytskyi',
  'Черкаська область': 'cherkasy', 'Чернігівська область': 'chernihiv', 'Чернівецька область': 'chernivtsi',
  'м. Київ': 'kyiv-city', 'м. Севастополь': 'sevastopol', Севастополь: 'sevastopol',
}

const alertTypeLabels: Record<string, string> = {
  air_raid: 'Повітряна тривога', artillery_shelling: 'Загроза артобстрілу', urban_fights: 'Загроза вуличних боїв',
  chemical: 'Хімічна загроза', nuclear: 'Радіаційна загроза',
}

const severity: Record<RegionState, number> = { neutral: 0, safe: 1, warning: 2, alert: 3 }
const districtStatusText: Record<RegionState, string> = {
  alert: 'тривога', warning: 'попередження', safe: 'спокій', neutral: 'дані недоступні',
}
const ukrainianLatin: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ю: 'yu', я: 'ya', ь: '', '’': '', "'": '', '`': '', '-': '', ' ': '',
}
const latinUkrainian: Record<string, string> = {
  a: 'а', b: 'б', c: 'ц', d: 'д', e: 'е', f: 'ф', g: 'ґ', h: 'г', i: 'і', j: 'й', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс', y: 'и', z: 'з', 'ь': 'ь', 'ї': 'ї', '-': '-', ' ': ' ',
}

function displayRegionName(regionId: string) {
  if (regionId === 'kyiv-city' || regionId === 'crimea' || regionId === 'sevastopol') return regionNames[regionId]
  return `${regionNames[regionId]} область`
}

function isEarlierStart(candidate: string | number, current?: string | number) {
  if (current === undefined) return true
  const toTimestamp = (value: string | number) => {
    if (typeof value === 'number') return value < 10_000_000_000 ? value * 1000 : value
    return /^\d{4}-\d{2}-\d{2}/.test(value) ? Date.parse(value) : Number.NaN
  }
  const candidateTimestamp = toTimestamp(candidate)
  const currentTimestamp = toTimestamp(current)
  return !Number.isNaN(candidateTimestamp) && !Number.isNaN(currentTimestamp) && candidateTimestamp < currentTimestamp
}

function formatAlertStart(startedAt?: string | number) {
  if (startedAt === undefined) return 'невідомий'
  const rawStart = String(startedAt)
  if (typeof startedAt === 'number' || /^\d{4}-\d{2}-\d{2}/.test(rawStart)) {
    const timestamp = typeof startedAt === 'number' && startedAt < 10_000_000_000 ? startedAt * 1000 : startedAt
    const date = new Date(timestamp)
    if (!Number.isNaN(date.getTime())) return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
  }
  return rawStart.match(/\b\d{1,2}:\d{2}\b/)?.[0] ?? rawStart
}

function normalizeDistrictName(value: string) {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('uk-UA')
    .replace(/[’`']/g, "'")
    .replace(/(^|\s)район(?:у|і|ом|а|и|ів|ам|ами|ах)?(?=\s|$)/giu, ' ')
    .replace(/[.,:;()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function legacyDistrictKey(value: string) {
  return [...value.toLocaleLowerCase('uk-UA')]
    .map((character) => ukrainianLatin[character] ?? character)
    .join('')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z]/g, '')
}

function ukrainianDistrictName(value: string) {
  const transliterated = value.toLocaleLowerCase('uk-UA')
    .replace(/s'kyi\b/gu, 'ський')
    .replace(/s'ka\b/gu, 'ська')
    .replace(/s'ke\b/gu, 'ське')
    .replace(/skyi\b/gu, 'ський')
    .replace(/ska\b/gu, 'ська')
    .replace(/ske\b/gu, 'ське')
    .replace(/shch/gu, 'щ')
    .replace(/sh/gu, 'ш')
    .replace(/ch/gu, 'ч')
    .replace(/zh/gu, 'ж')
    .replace(/kh/gu, 'х')
    .replace(/ts/gu, 'ц')
    .replace(/iu/gu, 'ю')
    .replace(/ia/gu, 'я')
    .replace(/ye/gu, 'є')
    .replace(/yu/gu, 'ю')
    .replace(/ya/gu, 'я')
    .replace(/[’`']/gu, 'ь')

  return [...transliterated].map((character) => latinUkrainian[character] ?? character).join('')
    .replace(/(^|[\s-])(\p{L})/gu, (_, prefix: string, character: string) => `${prefix}${character.toUpperCase()}`)
}

function applyDistrictAlert(regionAlert: RegionAlert, area: string, state: RegionState, startedAt?: string | number) {
  const name = area.trim()
  const normalizedName = normalizeDistrictName(name)
  if (!normalizedName) return

  const district = regionAlert.districts.find((candidate) => normalizeDistrictName(candidate.name) === normalizedName)
  if (district) {
    if (severity[state] > severity[district.state]) district.state = state
    if (startedAt !== undefined && isEarlierStart(startedAt, district.startedAt)) district.startedAt = startedAt
    return
  }

  regionAlert.districts.push({ name, state, startedAt })
}

const stateForAlert = (alert: ActiveAlert): RegionState => {
  const hasRedThreat = alert.alert_level === 'red' || alert.threats?.some((threat) => threat.level === 'red')
  if (hasRedThreat || ['artillery_shelling', 'urban_fights', 'chemical', 'nuclear'].includes(alert.alert_type)) return 'alert'
  return 'warning'
}

type MapRegionPathProps = SvgMapLocation & {
  label: string
  onSelect: (region: { id: string; name: string }) => void
  onOpenDistrictMap: (region: { id: string; name: string }) => void
}

function MapRegionPath({ id, label, path, onSelect, onOpenDistrictMap }: MapRegionPathProps) {
  const { state, types } = useRegionAlert(id)
  const statusText = state === 'neutral' ? 'дані недоступні' : types.length > 0 ? types.join(', ') : 'активних тривог немає'

  return (
    <path className={`map-region ${state}`} d={path} onClick={() => onSelect({ id, name: label })} onDoubleClick={() => onOpenDistrictMap({ id, name: label })}>
      <title>{`${label}: ${statusText}. Подвійний клік: райони`}</title>
    </path>
  )
}

type LegacyDistrictAlert = {
  id: string
  name: string
  state: RegionState
  startedAt?: string | number
}

type DistrictMiniMapProps = {
  districts: LegacyDistrictPath[]
  regionAlert: RegionAlert
  selectedDistrictId?: string
  onSelect: (district: LegacyDistrictAlert) => void
}

function DistrictMiniMap({ districts, regionAlert, selectedDistrictId, onSelect }: DistrictMiniMapProps) {
  const liveDistricts = new globalThis.Map(regionAlert.districts.map((district) => [legacyDistrictKey(district.name), district]))
  const selectedDistrictPath = districts.find((district) => district.id === selectedDistrictId)

  return (
    <svg className="district-mini-map" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Карта районів">
      <defs>
        <pattern id="district-selection-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="14" />
        </pattern>
      </defs>
      {districts.map((district) => {
        const matchingDistrict = liveDistricts.get(legacyDistrictKey(district.name))
        const districtAlert: LegacyDistrictAlert = {
          id: district.id,
          name: ukrainianDistrictName(district.name),
          state: matchingDistrict?.state ?? regionAlert.state,
          startedAt: matchingDistrict?.startedAt ?? regionAlert.startedAt,
        }

        return <path className={`district-map-area ${districtAlert.state}`} d={district.path} fillRule="evenodd" key={district.id} tabIndex={0} role="button" aria-label={`${districtAlert.name}: ${districtStatusText[districtAlert.state]}`} onClick={() => onSelect(districtAlert)} onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect(districtAlert)
          }
        }}>
          <title>{`${districtAlert.name}: ${districtStatusText[districtAlert.state]}`}</title>
        </path>
      })}
      {selectedDistrictPath && <path className="district-map-selection" d={selectedDistrictPath.path} fillRule="evenodd" pointerEvents="none" />}
    </svg>
  )
}

function MapTerritoryMarker({ onSelect }: Pick<MapRegionPathProps, 'onSelect'>) {
  const selectTerritory = () => onSelect({ id: 'sevastopol', name: regionNames.sevastopol })

  return (
    <g className="map-territory neutral" role="button" tabIndex={0} aria-label="м. Севастополь: дані недоступні" onClick={selectTerritory} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        selectTerritory()
      }
    }}>
      <title>м. Севастополь: дані недоступні</title>
      <circle cx="616" cy="632" r="5" />
      <text x="626" y="636">Севастополь</text>
    </g>
  )
}

function App() {
  const [activePage, setActivePage] = useState('Карта')
  const [, setNotifications] = useState(false)
  const [regionAlerts, setRegionAlerts] = useState<Record<string, RegionAlert>>(createSafeRegionAlerts)
  const [selectedRegion, setSelectedRegion] = useState<{ id: string; name: string } | null>(null)
  const [bannerRegionId, setBannerRegionId] = useState('kyiv')
  const [apiStatus, setApiStatus] = useState<'loading' | 'live' | 'unavailable'>('loading')
  const [lastUpdated, setLastUpdated] = useState<string | undefined>()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [mapZoom, setMapZoom] = useState(minimumMapZoom)
  const [districtMapRegionId, setDistrictMapRegionId] = useState<string | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<LegacyDistrictAlert | null>(null)
  const [legacyMaps, setLegacyMaps] = useState<Record<string, LegacyDistrictPath[]> | null>(null)
  const refreshInProgress = useRef(false)

  const regionCounts = Object.values(regionAlerts).reduce<Record<RegionState, number>>(
    (counts, alert) => ({ ...counts, [alert.state]: counts[alert.state] + 1 }),
    { alert: 0, warning: 0, safe: 0, neutral: 0 },
  )

  const refreshAlerts = async (showRefreshState = false) => {
    if (refreshInProgress.current) return

    refreshInProgress.current = true
    if (showRefreshState) {
      setIsRefreshing(true)
      setApiStatus('loading')
    }

    try {
      const { alerts, fetchedAt } = await fetchActiveAlerts()
      const nextAlerts = createSafeRegionAlerts()

      alerts.forEach((alert) => {
        const regionId = apiLocationToRegion[alert.location_oblast ?? alert.location_title]
        if (!regionId || regionId === 'crimea' || regionId === 'sevastopol') return

        const nextState = stateForAlert(alert)
        if (severity[nextState] > severity[nextAlerts[regionId].state]) nextAlerts[regionId].state = nextState
        const typeLabel = alertTypeLabels[alert.alert_type] ?? 'Інша загроза'
        nextAlerts[regionId].types = [...new Set([...nextAlerts[regionId].types, typeLabel])]
        if (alert.started_at !== undefined && isEarlierStart(alert.started_at, nextAlerts[regionId].startedAt)) {
          nextAlerts[regionId].startedAt = alert.started_at
        }

        const affectedAreas = [...(alert.areas ?? [])]
        if (alert.location_oblast && alert.location_title !== alert.location_oblast) affectedAreas.push(alert.location_title)
        affectedAreas.forEach((area) => applyDistrictAlert(nextAlerts[regionId], area, nextState, alert.started_at))
      })

      setRegionAlerts(nextAlerts)
      setLastUpdated(fetchedAt)
      setApiStatus('live')
    } catch {
      setApiStatus('unavailable')
    } finally {
      refreshInProgress.current = false
      if (showRefreshState) setIsRefreshing(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void refreshAlerts())
    const refreshTimer = window.setInterval(() => void refreshAlerts(), 30_000)
    return () => window.clearInterval(refreshTimer)
  }, [])

  useEffect(() => {
    if (!districtMapRegionId || legacyMaps) return
    void import('./data/legacyDistrictMaps').then(({ legacyDistrictMaps }) => setLegacyMaps(legacyDistrictMaps))
  }, [districtMapRegionId, legacyMaps])

  const navigation = [{ label: 'Карта', icon: Map }]
  const selectedAlertTypes = selectedRegion ? regionAlerts[selectedRegion.id]?.types : undefined
  const selectedRegionState = selectedRegion ? regionAlerts[selectedRegion.id]?.state : undefined
  const selectedRegionStatus = selectedRegionState === 'neutral'
    ? 'дані недоступні'
    : selectedAlertTypes && selectedAlertTypes.length > 0 ? selectedAlertTypes.join(', ') : 'активних тривог немає'
  const bannerAlert = regionAlerts[bannerRegionId]
  const bannerTitle = bannerAlert.state === 'alert' ? 'ПОВІТРЯНА ТРИВОГА' : bannerAlert.state === 'warning' ? 'АКТИВНЕ ПОПЕРЕДЖЕННЯ' : bannerAlert.state === 'neutral' ? 'ДАНІ НЕДОСТУПНІ' : 'ТРІВОГИ НЕМАЄ'
  const bannerStatus = bannerAlert.state === 'neutral'
    ? 'Для цієї території дані тривог не відображаються'
    : bannerAlert.state === 'safe'
    ? 'Зараз тривоги немає'
    : bannerAlert.state === 'alert'
      ? `Тривога активна. Початок: ${formatAlertStart(bannerAlert.startedAt)}`
      : `Попередження активне. Початок: ${formatAlertStart(bannerAlert.startedAt)}`
  const districtMapAlert = districtMapRegionId ? regionAlerts[districtMapRegionId] : undefined
  const legacyDistrictPaths = districtMapRegionId && legacyMaps ? legacyMaps[districtMapRegionId] ?? [] : []
  const liveStatusLabel = apiStatus === 'live' ? 'Дані API активні' : apiStatus === 'loading' ? 'Оновлення даних' : 'API недоступне'
  const liveStatusTime = lastUpdated ? new Date(lastUpdated).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : 'Очікування даних'
  const selectMapRegion = (region: { id: string; name: string }) => {
    setSelectedRegion(region)
    setBannerRegionId(region.id)
  }
  const openDistrictMap = (region: { id: string; name: string }) => {
    selectMapRegion(region)
    setSelectedDistrict(null)
    setDistrictMapRegionId(region.id)
  }
  const zoomMap = (direction: 1 | -1) => {
    setMapZoom((currentZoom) => Math.min(maximumMapZoom, Math.max(minimumMapZoom, Number((currentZoom + direction * mapZoomStep).toFixed(1)))))
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setActivePage('Карта')} aria-label="Повітряні тривоги, головна">
          <span className="trident">♜</span>
          <span><strong>Повітряні тривоги</strong><small>Україна</small></span>
        </button>
        <nav className="main-nav" aria-label="Головна навігація">
          {navigation.map(({ label, icon: Icon }) => (
            <button className={activePage === label ? 'active' : ''} onClick={() => setActivePage(label)} key={label}>
              <Icon size={16} />{label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button className="icon-button" aria-label="Сповіщення" onClick={() => setNotifications((value) => !value)}><Bell size={18} /></button>
          <span className={`system-status ${apiStatus}`}><i />{liveStatusLabel}<small>{liveStatusTime}</small></span>
        </div>
      </header>

      <aside className="sidebar">
        <div className="side-nav">
          <button><span className="home-icon">⌂</span>Головна</button>
        </div>
        <div className="unity"><span className="flag"><i /><i /></span>Разом до перемоги!<br />Слава Україні! <b>♥</b></div>
      </aside>

      <section className="content">
        <div className="content-main">
          <section className={`alert-banner status-${bannerAlert.state}`} aria-live="polite">
            <ShieldAlert size={37} fill="currentColor" strokeWidth={1.6} />
            <div className="alert-banner-copy">
              <h1>{bannerTitle}</h1>
              <label className="region-picker"><span>Регіон</span><select value={bannerRegionId} onChange={(event) => setBannerRegionId(event.target.value)} aria-label="Оберіть регіон">
                {displayRegions.map(({ id }) => <option value={id} key={id}>{displayRegionName(id)}</option>)}
              </select></label>
              <strong>{bannerAlert.state === 'safe' ? <CircleCheck size={16} /> : <Siren size={16} />}{bannerStatus}</strong>
            </div>
            <button onClick={() => setDetailsOpen((value) => !value)}>Детальніше <ChevronRight size={15} /></button>
            {detailsOpen && <p className="alert-detail">Слідкуйте за офіційними повідомленнями та прямуйте до укриття.</p>}
          </section>

          <section className="map-panel" aria-label="Карта станів регіонів">
            <div className="map-grid" />
            <RegionAlertsProvider value={regionAlerts}>
              <svg className="ukraine-map" style={{ '--map-zoom': mapZoom } as React.CSSProperties} viewBox={ukraineMap.viewBox} role="img" aria-label="Інтерактивна карта регіонів України">
                {mapLocations.map(({ id, name, path }) => <MapRegionPath id={id} name={name} path={path} label={regionNames[id] ?? name} onSelect={selectMapRegion} onOpenDistrictMap={openDistrictMap} key={id} />)}
                <MapTerritoryMarker onSelect={selectMapRegion} />
              </svg>
            </RegionAlertsProvider>
            {selectedRegion && <span className="selected-region">{selectedRegion.name}: {selectedRegionStatus}</span>}
            <div className="map-legend">
              <span><i className="alert" />Повітряна тривога</span><span><i className="warning" />Потенційна загроза</span><span><i className="safe" />Спокій</span><span><i className="neutral" />Немає даних</span>
            </div>
            <div className="zoom-controls">
              <button onClick={() => zoomMap(1)} aria-label="Збільшити карту" title="Збільшити карту" disabled={mapZoom === maximumMapZoom}><Plus size={16} /></button>
              <button onClick={() => zoomMap(-1)} aria-label="Зменшити карту" title="Зменшити карту" disabled={mapZoom === minimumMapZoom}><Minus size={16} /></button>
              <button className="refresh-control" onClick={() => void refreshAlerts(true)} aria-label="Оновити дані" title="Оновити дані" disabled={isRefreshing}><RefreshCw className={isRefreshing ? 'is-refreshing' : undefined} size={14} /></button>
            </div>
            <small className="map-source">Контури: <a href="https://mapsvg.com/maps/ukraine" target="_blank" rel="noreferrer">MapSVG / CC BY 4.0</a></small>
          </section>

          <section className="district-panel" aria-label={`Райони: ${displayRegionName(bannerRegionId)}`}>
            <div className="district-heading">
              <div><span>АДМІНІСТРАТИВНИЙ ПОДІЛ</span><h2>РАЙОНИ: {displayRegionName(bannerRegionId)}</h2></div>
              {bannerAlert.districts.length > 0 && <b>{bannerAlert.districts.length}</b>}
            </div>
            {bannerAlert.districts.length > 0 ? <div className="district-list">
              {bannerAlert.districts.map((district) => <span className={`district-chip ${district.state}`} key={district.name} title={`${district.name}: ${districtStatusText[district.state]}`}>
                <i /><span>{district.name}</span>{district.startedAt !== undefined && district.state !== 'safe' && <time>{formatAlertStart(district.startedAt)}</time>}
              </span>)}
            </div> : <p className="district-empty">Місто зі спеціальним статусом не входить до складу районів.</p>}
          </section>

          {districtMapAlert && <div className="district-map-overlay">
            <section className="district-map-dialog" role="dialog" aria-modal="true" aria-label={`Схема районів: ${displayRegionName(districtMapRegionId!)}`}>
              <header className="district-map-header">
                <div><span>КАРТА РАЙОНІВ</span><h2>{displayRegionName(districtMapRegionId!)}</h2></div>
                <button onClick={() => setDistrictMapRegionId(null)} aria-label="Закрити схему районів" title="Закрити"><X size={18} /></button>
              </header>
              {legacyMaps === null ? <p className="district-map-empty">Завантаження карти районів…</p> : legacyDistrictPaths.length > 0 ? <>
                <DistrictMiniMap districts={legacyDistrictPaths} regionAlert={districtMapAlert} selectedDistrictId={selectedDistrict?.id} onSelect={setSelectedDistrict} />
                <div className={`district-map-status ${selectedDistrict?.state ?? 'safe'}`}>
                  {selectedDistrict ? <><i />{selectedDistrict.name}: <b>{districtStatusText[selectedDistrict.state]}</b>{selectedDistrict.startedAt !== undefined && selectedDistrict.state !== 'safe' && <time>{formatAlertStart(selectedDistrict.startedAt)}</time>}</> : 'Оберіть район на схемі'}
                </div>
                <div className="district-map-legend"><span><i className="alert" />Тривога</span><span><i className="warning" />Попередження</span><span><i className="safe" />Спокій</span><span><i className="neutral" />Немає даних</span></div>
                <small className="district-map-source">Контури: GADM 4.1</small>
              </> : <p className="district-map-empty">Для цієї території районний поділ не застосовується.</p>}
            </section>
          </div>}

        </div>

        <aside className="right-rail">
          <section className="panel region-state"><div className="section-heading"><h2>СТАН РЕГІОНІВ</h2><button>Всі регіони <ChevronRight size={13} /></button></div>
            <div className="state-item"><span><i className="alert" />Тривога</span><b className="alert">{regionCounts.alert}</b></div><div className="state-item"><span><i className="warning" />Загроза</span><b className="warning">{regionCounts.warning}</b></div><div className="state-item"><span><i className="safe" />Спокій</span><b className="safe">{regionCounts.safe}</b></div><div className="state-item"><span><i className="neutral" />Немає даних</span><b className="neutral">{regionCounts.neutral}</b></div>
          </section>
        </aside>
      </section>
    </main>
  )
}

export default App
