import { createContext, useContext } from 'react'

export type RegionState = 'neutral' | 'safe' | 'warning' | 'alert'

export type DistrictAlert = {
  name: string
  state: RegionState
  startedAt?: string | number
}

export type RegionAlert = {
  state: RegionState
  types: string[]
  startedAt?: string | number
  districts: DistrictAlert[]
}

const safeRegionAlert: RegionAlert = { state: 'safe', types: [], districts: [] }
const RegionAlertsContext = createContext<Record<string, RegionAlert>>({})

export const RegionAlertsProvider = RegionAlertsContext.Provider

export function useRegionAlert(regionId: string) {
  return useContext(RegionAlertsContext)[regionId] ?? safeRegionAlert
}
