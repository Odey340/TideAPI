import { test } from "node:test"
import assert from "node:assert/strict"
import { curveFromExtremes, distanceKm, extremesFromSeries, heightAt } from "./curve.ts"
import type { Extreme, Point } from "./types.ts"

test("distanceKm: Boston to New York is about 306 km", () => {
    const d = distanceKm(42.3601, -71.0589, 40.7128, -74.006)
    assert.ok(Math.abs(d - 306) < 5, `got ${d}`)
})

test("curveFromExtremes passes through each extreme and stays between them", () => {
    const ex: Extreme[] = [
        { t: "2026-01-01T00:00:00.000Z", h: 0, type: "low" },
        { t: "2026-01-01T06:00:00.000Z", h: 3, type: "high" },
        { t: "2026-01-01T12:30:00.000Z", h: -0.2, type: "low" },
    ]
    const c = curveFromExtremes(ex, 15)
    assert.equal(c[0].h, 0)
    assert.equal(c[c.length - 1].h, -0.2)
    assert.equal(heightAt(c, Date.parse("2026-01-01T06:00:00Z")), 3)
    assert.equal(heightAt(c, Date.parse("2026-01-01T03:00:00Z")), 1.5) // halfway in time = halfway in height
    for (const p of c) assert.ok(p.h >= -0.2 && p.h <= 3)
})

test("extremesFromSeries recovers peak time between hourly samples", () => {
    // A sine with a 12.42 h period (M2 tide), peak at 03:06:18
    const period = 12.42 * 3600_000
    const peak = Date.parse("2026-01-01T03:06:18Z")
    const series: Point[] = []
    for (let i = 0; i < 24; i++) {
        const t = Date.parse("2026-01-01T00:00:00Z") + i * 3600_000
        series.push({ t: new Date(t).toISOString(), h: Math.cos((2 * Math.PI * (t - peak)) / period) })
    }
    const ex = extremesFromSeries(series)
    assert.deepEqual(ex.map((e) => e.type), ["high", "low", "high", "low"]) // 3.1 h, 9.3 h, 15.5 h, 21.7 h
    const errMin = Math.abs(Date.parse(ex[0].t) - peak) / 60_000
    assert.ok(errMin < 3, `peak off by ${errMin} min`)
    assert.ok(Math.abs(ex[0].h - 1) < 0.01)
})
