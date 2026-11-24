import { NextResponse, type NextRequest } from "next/server"
import { getTides, NotFound } from "@/lib/tides.ts"

/**
 * GET /api/tide?location=boston
 * GET /api/tide?lat=42.35&lon=-71.05
 * GET /api/tide?station=8443970
 */
export async function GET(req: NextRequest) {
    const p = req.nextUrl.searchParams
    const lat = p.get("lat")
    const lon = p.get("lon")
    const query = {
        location: p.get("location") ?? undefined,
        station: p.get("station") ?? undefined,
        lat: lat != null ? Number(lat) : undefined,
        lon: lon != null ? Number(lon) : undefined,
    }
    if ((query.lat != null && !isFinite(query.lat)) || (query.lon != null && !isFinite(query.lon))) {
        return NextResponse.json({ error: "lat and lon must be numbers" }, { status: 400 })
    }

    try {
        const report = await getTides(query)
        return NextResponse.json(report, {
            headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
        })
    } catch (e) {
        const status = e instanceof NotFound ? 404 : 502
        return NextResponse.json({ error: e instanceof Error ? e.message : "Upstream error" }, { status })
    }
}
