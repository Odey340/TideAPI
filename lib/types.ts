/** All heights are in meters, all times are ISO-8601 UTC strings. */

export type Point = { t: string; h: number }

export type Extreme = Point & { type: "high" | "low" }

export type Source = "noaa" | "open-meteo"

export type TideReport = {
    place: {
        name: string
        lat: number
        lon: number
        /** IANA zone used to display local times, e.g. "America/New_York". */
        timezone: string
    }
    source: Source
    /** Present when the data comes from a NOAA station. */
    station?: { id: string; name: string; state: string; lat: number; lon: number; distanceKm: number }
    /** Vertical reference the heights are measured from. */
    datum: "MLLW" | "MSL"
    /** Predicted (NOAA) or modeled (Open-Meteo) water level curve. */
    series: Point[]
    /** Upcoming and recent high/low tides. */
    extremes: Extreme[]
    /** Real measured water level, when the station has a gauge. */
    observed: Point[]
    now: {
        t: string
        h: number
        trend: "rising" | "falling"
        next: Extreme | null
    }
    attribution: string
}
