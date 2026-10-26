export type LegacyDistrictPath = { id: string; name: string; path: string }

const districtMapLoaders = import.meta.glob<LegacyDistrictPath[]>('./legacyDistrictMaps/*.json', {
  import: 'default',
})

export function loadLegacyDistrictMap(regionId: string) {
  const loadMap = districtMapLoaders[`./legacyDistrictMaps/${regionId}.json`]
  return loadMap ? loadMap() : Promise.resolve([])
}
