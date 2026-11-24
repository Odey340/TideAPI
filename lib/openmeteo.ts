import type { Point } from "./types.ts"

/** Open-Meteo: free, no key, global. https://open-meteo.com */
const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search"
const MARINE = "https://marine-api.open-meteo.com/v1/marine"

export type Place = { name: string; lat: number; lon: number; timezone: string }

export async function geocode(query: string): Promise<Place | null> {
    const qs = new URLSearchParams({ name: query, count: "1", language: "en", format: "json" })
    const r = await fetch(`${GEOCODE}?${qs}`, { next: { revalidate: 86_400 } })
    if (!r.ok) throw new Error(`Geocoding: HTTP ${r.status}`)
    const j = await r.json()
    const hit = j.results?.[0]
    if (!hit) return null
    const name = [hit.name, hit.admin1 && hit.admin1 !== hit.name ? hit.admin1 : null, hit.country_code]
        .filter(Boolean)
        .join(", ")
    return { name, lat: hit.latitude, lon: hit.longitude, timezone: hit.timezone ?? "UTC" }
}

/**
 * Modeled sea level relative to mean sea level, hourly. Includes tides and
 * surge from a global ocean model, so it works on any coast, but it is
 * coarser than a station prediction.
 */
export async function seaLevel(lat: number, lon: number): Promise<{ series: Point[]; timezone: string }> {
    const qs = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        hourly: "sea_level_height_msl",
        timezone: "auto",
        past_days: "1",
        forecast_days: "3",
        cell_selection: "sea",
        timeformat: "unixtime",
    })
    const r = await fetch(`${MARINE}?${qs}`, { next: { revalidate: 1800 } })
    const j = await r.json()
    if (!r.ok || j.error) throw new Error(`Open-Meteo marine: ${j.reason ?? `HTTP ${r.status}`}`)

    const times: number[] = j.hourly?.time ?? []
    const values: (number | null)[] = j.hourly?.sea_level_height_msl ?? []
    const series: Point[] = []
    times.forEach((t, i) => {
        const h = values[i]
        if (h != null) series.push({ t: new Date(t * 1000).toISOString(), h })
    })
    return { series, timezone: j.timezone ?? "UTC" }
}
