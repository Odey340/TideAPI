import { NextResponse, type NextRequest } from "next/server"
import { nearestStations, searchStations } from "@/lib/noaa.ts"

/**
 * GET /api/stations?q=boston           search NOAA stations by name, state or id
 * GET /api/stations?lat=..&lon=..      nearest stations
 */
export async function GET(req: NextRequest) {
    const p = req.nextUrl.searchParams
    const limit = Math.min(Number(p.get("limit") ?? 10) || 10, 50)
    try {
        if (p.get("q")) return NextResponse.json({ stations: await searchStations(p.get("q")!, limit) })
        const lat = Number(p.get("lat"))
        const lon = Number(p.get("lon"))
        if (p.has("lat") && p.has("lon") && isFinite(lat) && isFinite(lon)) {
            return NextResponse.json({ stations: await nearestStations(lat, lon, limit) })
        }
        return NextResponse.json({ error: "Pass q, or lat and lon" }, { status: 400 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Upstream error" }, { status: 502 })
    }
}
