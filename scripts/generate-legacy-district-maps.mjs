import { readFile, writeFile } from 'node:fs/promises'

const sourcePath = process.argv[2]
const destinationPath = process.argv[3]

if (!sourcePath || !destinationPath) {
  throw new Error('Usage: node generate-legacy-district-maps.mjs <source.geojson> <destination.ts>')
}

const regionIds = {
  Cherkasy: 'cherkasy', Chernihiv: 'chernihiv', Chernivtsi: 'chernivtsi', Crimea: 'crimea',
  "Dnipropetrovs'k": 'dnipropetrovsk', "Donets'k": 'donetsk', "Ivano-Frankivs'k": 'ivano-frankivsk',
  Kharkiv: 'kharkiv', Kherson: 'kherson', "Khmel'nyts'kyy": 'khmelnytskyi', Kirovohrad: 'kirovohrad',
  Kiev: 'kyiv', KievCity: 'kyiv-city', "Luhans'k": 'luhansk', "L'viv": 'lviv', Mykolayiv: 'mykolaiv',
  Odessa: 'odessa', Poltava: 'poltava', Rivne: 'rivne', Sevastopol: 'sevastopol', "Sevastopol'": 'sevastopol',
  Sumy: 'sumy', "Ternopil'": 'ternopil', Vinnytsya: 'vinnytsia', Volyn: 'volyn', Zakarpattia: 'zakarpattia',
  Zaporizhia: 'zaporizhia', Zhytomyr: 'zhytomyr',
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'))
const groupedFeatures = new Map()

for (const feature of source.features) {
  const regionId = regionIds[feature.properties.NAME_1]
  if (!regionId || !feature.geometry) continue
  const features = groupedFeatures.get(regionId) ?? []
  features.push(feature)
  groupedFeatures.set(regionId, features)
}

function collectCoordinates(coordinates, result = []) {
  if (typeof coordinates[0] === 'number') result.push(coordinates)
  else coordinates.forEach((coordinate) => collectCoordinates(coordinate, result))
  return result
}

function simplifyRing(ring, tolerance = 0.002) {
  const output = []
  let previous

  for (const point of ring) {
    if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= tolerance) {
      output.push(point)
      previous = point
    }
  }

  return output.length > 2 ? output : ring
}

function ringsForGeometry(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat()
  return []
}

function toPath(rings, bounds) {
  const width = bounds.maxLongitude - bounds.minLongitude
  const height = bounds.maxLatitude - bounds.minLatitude
  const scale = 920 / Math.max(width, height)
  const xOffset = (1000 - width * scale) / 2
  const yOffset = (1000 - height * scale) / 2

  return rings.map((ring) => {
    const points = simplifyRing(ring).map(([longitude, latitude]) => [
      xOffset + (longitude - bounds.minLongitude) * scale,
      yOffset + (bounds.maxLatitude - latitude) * scale,
    ])
    return `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`
  }).join('')
}

const maps = {}
for (const [regionId, features] of groupedFeatures) {
  const coordinates = features.flatMap((feature) => collectCoordinates(feature.geometry.coordinates))
  const bounds = {
    minLongitude: Math.min(...coordinates.map(([longitude]) => longitude)),
    maxLongitude: Math.max(...coordinates.map(([longitude]) => longitude)),
    minLatitude: Math.min(...coordinates.map(([, latitude]) => latitude)),
    maxLatitude: Math.max(...coordinates.map(([, latitude]) => latitude)),
  }

  maps[regionId] = features.map((feature) => ({
    id: feature.properties.GID_2,
    name: feature.properties.NAME_2,
    path: toPath(ringsForGeometry(feature.geometry), bounds),
  }))
}

const sourceNote = 'GADM 4.1 administrative boundaries; legacy pre-2020 districts.'
await writeFile(destinationPath, `export type LegacyDistrictPath = { id: string; name: string; path: string }\n\n// ${sourceNote}\nexport const legacyDistrictMaps: Record<string, LegacyDistrictPath[]> = ${JSON.stringify(maps)}\n`)
