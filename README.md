# TideTracker

Live tides for any coast. Search a place (or use your location) and get the current water level, whether it's rising or falling, the next highs and lows, and a 60-hour tide chart. Times are shown in the location's local time zone.

It also works as a JSON API.

## Where the data comes from

| Where | Source | What you get |
|---|---|---|
| US coasts (within 60 km of a station) | [NOAA CO-OPS](https://api.tidesandcurrents.noaa.gov/api/prod/) | Official high/low predictions for ~3,500 stations, plus the **live gauge reading** (6-minute water level) where the station has one |
| Everywhere else | [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api) | Hourly modeled sea level (tides + surge) from a global ocean model; highs and lows found by peak detection with parabolic refinement |

Neither API needs a key.

How it works:

1. A place name is geocoded with Open-Meteo's geocoding API.
2. The nearest NOAA prediction station is found by haversine distance (the station list is cached in memory for a day).
3. NOAA stations: the high/low list is turned into a smooth curve with cosine interpolation, the standard way tide tables are interpolated. The measured water level from the last 24 hours is overlaid and used for "now" when it is fresh.
4. Elsewhere: the model's hourly series is used directly, with turning points refined between samples.

## API

```
GET /api/tide?location=lagos
GET /api/tide?lat=37.80&lon=-122.47
GET /api/tide?station=8443970          # a specific NOAA station id
GET /api/stations?q=seattle            # search NOAA stations
GET /api/stations?lat=..&lon=..        # nearest NOAA stations
```

`/api/tide` returns (heights in meters, times in UTC):

```jsonc
{
  "place": { "name": "Boston, Massachusetts, US", "lat": 42.36, "lon": -71.06, "timezone": "America/New_York" },
  "source": "noaa",                     // or "open-meteo"
  "station": { "id": "8443970", "name": "Boston", "distanceKm": 0.9, ... },
  "datum": "MLLW",                      // MLLW for NOAA, MSL for the model
  "now": { "t": "...", "h": 0.59, "trend": "falling", "next": { "t": "...", "h": 0.03, "type": "low" } },
  "extremes": [{ "t": "...", "h": 3.39, "type": "high" }, ...],
  "series":   [{ "t": "...", "h": 1.21 }, ...],   // predicted or modeled curve
  "observed": [{ "t": "...", "h": 1.25 }, ...],   // live gauge, NOAA only
  "attribution": "..."
}
```

Errors come back as `{ "error": "..." }` with 400 (bad input), 404 (unknown place or inland) or 502 (an upstream API failed).

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests for the curve math
```

Deploys to Vercel as-is, with no environment variables needed.

## Stack

Next.js 16 (App Router, route handlers), React 19, TypeScript. The chart is hand-rolled SVG with no chart library.

Not for navigation.
