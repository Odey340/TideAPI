import type { Extreme, Point } from "./types.ts"

const R_KM = 6371

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const rad = Math.PI / 180
    const dLat = (lat2 - lat1) * rad
    const dLon = (lon2 - lon1) * rad
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
    return 2 * R_KM * Math.asin(Math.sqrt(a))
}

/**
 * Builds a smooth curve from a list of highs and lows. Between two
 * consecutive extremes the water follows half a cosine wave, which is how
 * tide tables are traditionally interpolated.
 */
export function curveFromExtremes(extremes: Extreme[], stepMinutes = 10): Point[] {
    const out: Point[] = []
    const step = stepMinutes * 60_000
    for (let i = 0; i < extremes.length - 1; i++) {
        const a = extremes[i]
        const b = extremes[i + 1]
        const t1 = Date.parse(a.t)
        const t2 = Date.parse(b.t)
        if (!(t2 > t1)) continue
        for (let t = t1; t < t2; t += step) {
            const phase = (Math.PI * (t - t1)) / (t2 - t1)
            const h = (a.h + b.h) / 2 + ((a.h - b.h) / 2) * Math.cos(phase)
            out.push({ t: new Date(t).toISOString(), h: round(h) })
        }
    }
    const last = extremes[extremes.length - 1]
    if (last) out.push({ t: last.t, h: last.h })
    return out
}

/**
 * Finds highs and lows in an evenly spaced series. Each turning point is
 * refined with a parabola through its neighbours, so an hourly series still
 * gives the time of the peak to within a few minutes.
 */
export function extremesFromSeries(series: Point[]): Extreme[] {
    const out: Extreme[] = []
    for (let i = 1; i < series.length - 1; i++) {
        const y0 = series[i - 1].h
        const y1 = series[i].h
        const y2 = series[i + 1].h
        const isHigh = y1 > y0 && y1 >= y2
        const isLow = y1 < y0 && y1 <= y2
        if (!isHigh && !isLow) continue

        const t0 = Date.parse(series[i - 1].t)
        const t1 = Date.parse(series[i].t)
        const dt = t1 - t0
        const denom = y0 - 2 * y1 + y2
        const offset = denom === 0 ? 0 : (0.5 * (y0 - y2)) / denom // in steps, within [-0.5, 0.5]
        const h = y1 - 0.25 * (y0 - y2) * offset

        out.push({ t: new Date(t1 + offset * dt).toISOString(), h: round(h), type: isHigh ? "high" : "low" })
    }
    return out
}

/** Linear interpolation of the series at time `t` (ms). */
export function heightAt(series: Point[], t: number): number | null {
    for (let i = 0; i < series.length - 1; i++) {
        const a = Date.parse(series[i].t)
        const b = Date.parse(series[i + 1].t)
        if (t >= a && t <= b) {
            const f = b === a ? 0 : (t - a) / (b - a)
            return round(series[i].h + f * (series[i + 1].h - series[i].h))
        }
    }
    return null
}

export function round(x: number, digits = 3): number {
    const p = 10 ** digits
    return Math.round(x * p) / p
}
