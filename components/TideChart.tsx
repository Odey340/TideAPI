"use client"

import { useMemo, useState } from "react"
import type { TideReport } from "@/lib/types.ts"
import { fmtHeight, M_TO_FT, type Units } from "@/lib/format.ts"

const W = 900
const H = 280
const PAD = { l: 52, r: 16, t: 24, b: 32 }

/** Water level from 12 hours ago to 48 hours ahead, with the live gauge overlaid. */
export default function TideChart({ report, units, now }: { report: TideReport; units: Units; now: number }) {
    const [hover, setHover] = useState<number | null>(null)
    const k = units === "ft" ? M_TO_FT : 1
    const tz = report.place.timezone

    const { x0, x1, series, observed, extremes, yMin, yMax } = useMemo(() => {
        const x0 = now - 12 * 3600_000
        const x1 = now + 48 * 3600_000
        const inRange = (t: string) => {
            const v = Date.parse(t)
            return v >= x0 && v <= x1
        }
        const series = report.series.filter((p) => inRange(p.t))
        const observed = report.observed.filter((p) => inRange(p.t))
        const extremes = report.extremes.filter((p) => inRange(p.t))
        const hs = [...series, ...observed].map((p) => p.h)
        const lo = Math.min(...hs)
        const hi = Math.max(...hs)
        const pad = (hi - lo) * 0.15 || 0.5
        return { x0, x1, series, observed, extremes, yMin: lo - pad, yMax: hi + pad }
    }, [report, now])

    const sx = (t: number) => PAD.l + ((t - x0) / (x1 - x0)) * (W - PAD.l - PAD.r)
    const sy = (h: number) => PAD.t + (1 - (h - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b)
    const path = (pts: { t: string; h: number }[]) =>
        pts.map((p, i) => `${i ? "L" : "M"}${sx(Date.parse(p.t)).toFixed(1)},${sy(p.h).toFixed(1)}`).join("")

    if (series.length < 2) return null

    const area = `${path(series)}L${sx(Date.parse(series[series.length - 1].t))},${H - PAD.b}L${sx(Date.parse(series[0].t))},${H - PAD.b}Z`

    // Gridlines at local midnight and noon.
    const ticks: number[] = []
    for (let t = Math.ceil(x0 / 3600_000) * 3600_000; t <= x1; t += 3600_000) {
        const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(t))
        if (hour === 0 || hour === 12) ticks.push(t)
    }
    const yTicks = niceTicks(yMin * k, yMax * k, 5)

    const hoverPoint =
        hover == null
            ? null
            : series.reduce((best, p) => (Math.abs(Date.parse(p.t) - hover) < Math.abs(Date.parse(best.t) - hover) ? p : best))

    const fmt = (t: number, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(t)

    return (
        <div className="chart">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label="Tide height over the next two days"
                onPointerMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    const px = ((e.clientX - r.left) / r.width) * W
                    if (px < PAD.l || px > W - PAD.r) return setHover(null)
                    setHover(x0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (x1 - x0))
                }}
                onPointerLeave={() => setHover(null)}
            >
                <defs>
                    <linearGradient id="water" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgb(127 224 166)" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="rgb(127 224 166)" stopOpacity="0.02" />
                    </linearGradient>
                </defs>

                {yTicks.map((v) => (
                    <g key={v}>
                        <line x1={PAD.l} x2={W - PAD.r} y1={sy(v / k)} y2={sy(v / k)} stroke="var(--line)" />
                        <text x={PAD.l - 8} y={sy(v / k) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                            {v.toFixed(Math.abs(yTicks[1] - yTicks[0]) < 1 ? 1 : 0)}
                        </text>
                    </g>
                ))}
                {ticks.map((t) => (
                    <g key={t}>
                        <line x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={H - PAD.b} stroke="var(--line)" strokeDasharray="2 4" />
                        <text x={sx(t)} y={H - PAD.b + 18} textAnchor="middle" fontSize="11" fill="var(--muted)">
                            {fmt(t, { hour: "numeric" }) === "12 AM" ? fmt(t, { weekday: "short" }) : "noon"}
                        </text>
                    </g>
                ))}

                <path d={area} fill="url(#water)" />
                <path d={path(series)} fill="none" stroke="var(--accent)" strokeWidth="2" />
                {observed.length > 1 && <path d={path(observed)} fill="none" stroke="var(--obs)" strokeWidth="2" />}

                {extremes.map((e) => (
                    <g key={e.t}>
                        <circle cx={sx(Date.parse(e.t))} cy={sy(e.h)} r="3.5" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
                        <text
                            x={sx(Date.parse(e.t))}
                            y={sy(e.h) + (e.type === "high" ? -10 : 18)}
                            textAnchor="middle"
                            fontSize="11"
                            fill="var(--text)"
                        >
                            {fmt(Date.parse(e.t), { hour: "numeric", minute: "2-digit" })}
                        </text>
                    </g>
                ))}

                <line x1={sx(now)} x2={sx(now)} y1={PAD.t} y2={H - PAD.b} stroke="var(--text)" strokeOpacity="0.6" />
                <circle cx={sx(now)} cy={sy(report.now.h)} r="5" fill="var(--text)" />
                <text x={sx(now) + 6} y={PAD.t - 8} fontSize="11" fill="var(--text)">
                    now
                </text>

                {hoverPoint && (
                    <g pointerEvents="none">
                        <line x1={sx(Date.parse(hoverPoint.t))} x2={sx(Date.parse(hoverPoint.t))} y1={PAD.t} y2={H - PAD.b} stroke="var(--accent)" strokeOpacity="0.5" />
                        <circle cx={sx(Date.parse(hoverPoint.t))} cy={sy(hoverPoint.h)} r="4" fill="var(--accent)" />
                        <text
                            x={Math.min(sx(Date.parse(hoverPoint.t)) + 8, W - 150)}
                            y={sy(hoverPoint.h) - 10}
                            fontSize="12"
                            fill="var(--text)"
                        >
                            {fmt(Date.parse(hoverPoint.t), { weekday: "short", hour: "numeric", minute: "2-digit" })} ·{" "}
                            {fmtHeight(hoverPoint.h, units)}
                        </text>
                    </g>
                )}
            </svg>
            <div className="legend">
                <span>
                    <i style={{ background: "var(--accent)" }} />
                    {report.source === "noaa" ? "Predicted" : "Modeled"} ({units})
                </span>
                {observed.length > 1 && (
                    <span>
                        <i style={{ background: "var(--obs)" }} />
                        Measured by gauge
                    </span>
                )}
            </div>
        </div>
    )
}

function niceTicks(lo: number, hi: number, count: number): number[] {
    const raw = (hi - lo) / count
    const mag = 10 ** Math.floor(Math.log10(raw))
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
    const out: number[] = []
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Math.round(v * 1000) / 1000)
    return out
}
