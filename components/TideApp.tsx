"use client"

import { useCallback, useEffect, useState } from "react"
import type { TideReport } from "@/lib/types.ts"
import { fmtHeight, type Units } from "@/lib/format.ts"
import TideChart from "./TideChart.tsx"

const QUICK = ["Boston", "San Francisco", "Honolulu", "Seattle", "Lagos", "Lisbon", "Sydney"]

export default function TideApp() {
    const [query, setQuery] = useState("")
    const [report, setReport] = useState<TideReport | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [units, setUnits] = useState<Units>("ft")
    const [now, setNow] = useState(() => Date.now())

    const load = useCallback(async (params: Record<string, string>) => {
        setLoading(true)
        setError(null)
        try {
            const r = await fetch(`/api/tide?${new URLSearchParams(params)}`)
            const j = await r.json()
            if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
            setReport(j)
            setUnits(j.source === "noaa" ? "ft" : "m")
            const url = new URL(window.location.href)
            url.search = new URLSearchParams(params).toString()
            window.history.replaceState(null, "", url)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong")
        } finally {
            setLoading(false)
        }
    }, [])

    // Restore from the URL so links are shareable; default to Boston.
    useEffect(() => {
        const p = new URLSearchParams(window.location.search)
        const params: Record<string, string> = {}
        for (const k of ["location", "lat", "lon", "station"]) {
            const v = p.get(k)
            if (v) params[k] = v
        }
        if (params.location) setQuery(params.location)
        load(Object.keys(params).length ? params : { location: "Boston" })
    }, [load])

    // Tick the clock every minute, and refetch every 10 minutes for fresh gauge readings.
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60_000)
        return () => clearInterval(id)
    }, [])

    useEffect(() => {
        if (!report) return
        const id = setInterval(() => {
            const p = new URLSearchParams(window.location.search)
            load(Object.fromEntries(p.entries()))
        }, 10 * 60_000)
        return () => clearInterval(id)
    }, [report, load])

    const locate = () => {
        if (!navigator.geolocation) return setError("Your browser doesn't share location")
        setLoading(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => load({ lat: pos.coords.latitude.toFixed(4), lon: pos.coords.longitude.toFixed(4) }),
            () => {
                setLoading(false)
                setError("Couldn't get your location")
            },
        )
    }

    return (
        <>
            <form
                className="search"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (query.trim()) load({ location: query.trim() })
                }}
            >
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="City, beach or harbor"
                    aria-label="Location"
                />
                <button className="primary" disabled={loading}>
                    {loading ? "Loading…" : "Get tides"}
                </button>
                <button type="button" onClick={locate} disabled={loading}>
                    Use my location
                </button>
            </form>
            <div className="chips">
                {QUICK.map((q) => (
                    <button
                        key={q}
                        onClick={() => {
                            setQuery(q)
                            load({ location: q })
                        }}
                    >
                        {q}
                    </button>
                ))}
            </div>

            {error && <p className="error">{error}</p>}
            {!report && loading && <p className="loading">Fetching tides…</p>}
            {report && <Report report={report} units={units} setUnits={setUnits} now={now} />}
        </>
    )
}

function Report({ report, units, setUnits, now }: { report: TideReport; units: Units; setUnits: (u: Units) => void; now: number }) {
    const tz = report.place.timezone
    const time = (iso: string) =>
        new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso))
    const day = (iso: string) =>
        new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso))

    const next = report.extremes.find((e) => Date.parse(e.t) > now) ?? null
    const after = next ? report.extremes.find((e) => Date.parse(e.t) > Date.parse(next.t)) : null
    const lastObs = report.observed[report.observed.length - 1]
    const live = lastObs && now - Date.parse(lastObs.t) < 30 * 60_000
    const upcoming = report.extremes.filter((e) => Date.parse(e.t) > now - 12 * 3600_000)

    return (
        <>
            <section className="panel">
                <div className="head">
                    <div>
                        <div className="place">{report.place.name}</div>
                        <div className="meta">
                            {report.station ? (
                                <>
                                    NOAA station{" "}
                                    <a
                                        href={`https://tidesandcurrents.noaa.gov/stationhome.html?id=${report.station.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {report.station.name} ({report.station.id})
                                    </a>
                                    {report.station.distanceKm > 0 && `, ${report.station.distanceKm} km away`}
                                </>
                            ) : (
                                "Open-Meteo global sea level model"
                            )}
                            {" · "}heights above {report.datum === "MLLW" ? "mean lower low water" : "mean sea level"} · {tz}
                        </div>
                    </div>
                    <div className="units" role="group" aria-label="Units">
                        {(["ft", "m"] as const).map((u) => (
                            <button key={u} className={units === u ? "on" : ""} onClick={() => setUnits(u)}>
                                {u}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="stats">
                    <div className="stat">
                        <div className="label">{live ? "Measured now" : "Water level now"}</div>
                        <div className="value">{fmtHeight(report.now.h, units)}</div>
                        <div className={`note ${report.now.trend === "rising" ? "up" : "down"}`}>
                            {report.now.trend === "rising" ? "▲ Rising" : "▼ Falling"}
                            {live && <span style={{ color: "var(--muted)" }}> · gauge at {time(lastObs.t)}</span>}
                        </div>
                    </div>
                    {next && (
                        <div className="stat">
                            <div className="label">Next {next.type} tide</div>
                            <div className="value">{time(next.t)}</div>
                            <div className="note">
                                {fmtHeight(next.h, units)} · in {countdown(Date.parse(next.t) - now)}
                            </div>
                        </div>
                    )}
                    {after && (
                        <div className="stat">
                            <div className="label">Then {after.type}</div>
                            <div className="value">{time(after.t)}</div>
                            <div className="note">{fmtHeight(after.h, units)}</div>
                        </div>
                    )}
                </div>

                <TideChart report={report} units={units} now={now} />
            </section>

            <section className="panel">
                <table>
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Tide</th>
                            <th>Height</th>
                        </tr>
                    </thead>
                    <tbody>
                        {upcoming.map((e) => (
                            <tr key={e.t} className={Date.parse(e.t) < now ? "past" : ""}>
                                <td>{day(e.t)}</td>
                                <td>{time(e.t)}</td>
                                <td>
                                    <span className={`tag ${e.type}`}>{e.type === "high" ? "High" : "Low"}</span>
                                </td>
                                <td>{fmtHeight(e.h, units)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="meta" style={{ marginTop: 12 }}>
                    {report.attribution}
                    {report.source === "open-meteo" && ". Model times can be off by up to an hour near complex coastlines."}
                </p>
            </section>
        </>
    )
}

function countdown(ms: number) {
    const mins = Math.max(0, Math.round(ms / 60_000))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h ? `${h}h ${m}m` : `${m}m`
}
