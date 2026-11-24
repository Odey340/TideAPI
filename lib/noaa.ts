import { distanceKm, round } from "./curve.ts"
import type { Extreme, Point } from "./types.ts"

/** NOAA CO-OPS: US tide stations. Free, no key. https://api.tidesandcurrents.noaa.gov */
const DATA = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
const META = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions"
const APP = "tidetracker"

export type Station = { id: string; name: string; state: string; lat: number; lon: number }

let stationsPromise: Promise<Station[]> | null = null
let stationsLoadedAt = 0
const DAY = 86_400_000

/** About 3,500 prediction stations. The list is ~2 MB so it is kept in memory for a day. */
export function getStations(): Promise<Station[]> {
    if (!stationsPromise || Date.now() - stationsLoadedAt > DAY) {
        stationsLoadedAt = Date.now()
        stationsPromise = fetch(META, { cache: "no-store" })
            .then((r) => {
                if (!r.ok) throw new Error(`NOAA station list: HTTP ${r.status}`)
                return r.json()
            })
            .then((j: { stations: { id: string; name: string; state: string; lat: number; lng: number }[] }) =>
                j.stations.map((s) => ({ id: s.id, name: titleCase(s.name), state: s.state ?? "", lat: s.lat, lon: s.lng })),
            )
            .catch((e) => {
                stationsPromise = null
                throw e
            })
    }
    return stationsPromise
}

export async function nearestStations(lat: number, lon: number, limit = 5) {
    const stations = await getStations()
    return stations
        .map((s) => ({ ...s, distanceKm: round(distanceKm(lat, lon, s.lat, s.lon), 1) }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, limit)
}

export async function findStation(id: string): Promise<Station | undefined> {
    return (await getStations()).find((s) => s.id === id)
}

export async function searchStations(q: string, limit = 10): Promise<Station[]> {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    const stations = await getStations()
    return stations.filter((s) => `${s.name} ${s.state} ${s.id}`.toLowerCase().includes(needle)).slice(0, limit)
}

type Window = { from: Date; to: Date }

/** High and low tide predictions. Works for both harmonic and subordinate stations. */
export async function predictions(stationId: string, w: Window): Promise<{ extremes: Extreme[]; datum: "MLLW" | "MSL" }> {
    let lastError: unknown
    // A few stations have no MLLW datum; fall back to mean sea level.
    for (const datum of ["MLLW", "MSL"] as const) {
        try {
            const j = await get({
                product: "predictions",
                station: stationId,
                begin_date: noaaDate(w.from),
                end_date: noaaDate(w.to),
                datum,
                interval: "hilo",
            })
            const extremes: Extreme[] = (j.predictions as { t: string; v: string; type: string }[]).map((p) => ({
                t: noaaTime(p.t),
                h: Number(p.v),
                type: p.type === "H" ? "high" : "low",
            }))
            return { extremes, datum }
        } catch (e) {
            lastError = e
        }
    }
    throw lastError
}

/** Measured water level from the station's gauge. Many stations don't have one; that returns []. */
export async function observed(stationId: string, datum: string, w: Window): Promise<Point[]> {
    try {
        const j = await get({
            product: "water_level",
            station: stationId,
            begin_date: noaaDate(w.from),
            end_date: noaaDate(w.to),
            datum,
        })
        return (j.data as { t: string; v: string }[])
            .filter((d) => d.v !== "")
            .map((d) => ({ t: noaaTime(d.t), h: Number(d.v) }))
    } catch {
        return []
    }
}

async function get(params: Record<string, string>) {
    const qs = new URLSearchParams({ ...params, units: "metric", time_zone: "gmt", format: "json", application: APP })
    const r = await fetch(`${DATA}?${qs}`, { next: { revalidate: 300 } })
    if (!r.ok) throw new Error(`NOAA: HTTP ${r.status}`)
    const j = await r.json()
    if (j.error) throw new Error(`NOAA: ${j.error.message}`)
    return j
}

/** NOAA wants "yyyyMMdd HH:mm" in the requested zone (GMT here). */
function noaaDate(d: Date): string {
    const p = (n: number) => String(n).padStart(2, "0")
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

/** "2026-11-24 03:59" (GMT) to ISO. */
function noaaTime(t: string): string {
    return new Date(`${t.replace(" ", "T")}:00Z`).toISOString()
}

function titleCase(s: string): string {
    return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase())
}
