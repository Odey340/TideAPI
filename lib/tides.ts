import { curveFromExtremes, extremesFromSeries, heightAt } from "./curve.ts"
import * as noaa from "./noaa.ts"
import * as om from "./openmeteo.ts"
import type { Extreme, Point, TideReport } from "./types.ts"

/** Use a NOAA station if one is this close; otherwise fall back to the global model. */
export const MAX_STATION_KM = 60

export class NotFound extends Error {}

export type Query = { location?: string; lat?: number; lon?: number; station?: string }

export async function getTides(q: Query): Promise<TideReport> {
    const now = Date.now()
    const window = { from: new Date(now - 24 * 3600_000), to: new Date(now + 72 * 3600_000) }

    // 1. Work out where we are.
    let place: om.Place
    let forced: noaa.Station | undefined
    if (q.station) {
        forced = await noaa.findStation(q.station)
        if (!forced) throw new NotFound(`No NOAA tide station with id ${q.station}`)
        place = { name: `${forced.name}${forced.state ? `, ${forced.state}` : ""}`, lat: forced.lat, lon: forced.lon, timezone: "" }
    } else if (q.lat != null && q.lon != null) {
        place = { name: `${q.lat.toFixed(3)}, ${q.lon.toFixed(3)}`, lat: q.lat, lon: q.lon, timezone: "" }
    } else if (q.location) {
        const hit = await om.geocode(q.location)
        if (!hit) throw new NotFound(`Couldn't find a place called "${q.location}"`)
        place = hit
    } else {
        throw new NotFound("Pass location, lat and lon, or station")
    }

    // 2. Pick a source: nearest NOAA station if close enough, else the model.
    const [nearest] = forced ? [{ ...forced, distanceKm: 0 }] : await noaa.nearestStations(place.lat, place.lon, 1)
    const useStation = nearest && nearest.distanceKm <= MAX_STATION_KM

    // The marine model also tells us the local time zone, so it is fetched either way.
    const modelPromise = om.seaLevel(place.lat, place.lon).catch(() => null)

    let report: Omit<TideReport, "now" | "place">
    if (useStation) {
        const { extremes, datum } = await noaa.predictions(nearest.id, window)
        const obs = await noaa.observed(nearest.id, datum, { from: window.from, to: new Date(now) })
        report = {
            source: "noaa",
            station: nearest,
            datum,
            series: curveFromExtremes(extremes),
            extremes,
            observed: obs,
            attribution: "Predictions and observations: NOAA CO-OPS (tidesandcurrents.noaa.gov)",
        }
    } else {
        const model = await modelPromise
        if (!model || model.series.length < 3) {
            throw new NotFound(`No tide data near ${place.name}. Is it on the coast?`)
        }
        report = {
            source: "open-meteo",
            datum: "MSL",
            series: model.series,
            extremes: extremesFromSeries(model.series),
            observed: [],
            attribution: "Modeled sea level: Open-Meteo Marine API (open-meteo.com)",
        }
    }

    const timezone = place.timezone || (await modelPromise)?.timezone || "UTC"
    return {
        ...report,
        place: { ...place, timezone },
        now: summarizeNow(report.series, report.extremes, report.observed, now),
    }
}

function summarizeNow(series: Point[], extremes: Extreme[], observed: Point[], now: number): TideReport["now"] {
    const lastObs = observed[observed.length - 1]
    const fresh = lastObs && now - Date.parse(lastObs.t) < 30 * 60_000
    const predicted = heightAt(series, now) ?? series[series.length - 1]?.h ?? 0
    const next = extremes.find((e) => Date.parse(e.t) > now) ?? null
    const trend = next ? (next.type === "high" ? "rising" : "falling") : "rising"
    return {
        t: fresh ? lastObs.t : new Date(now).toISOString(),
        h: fresh ? lastObs.h : predicted,
        trend,
        next,
    }
}
