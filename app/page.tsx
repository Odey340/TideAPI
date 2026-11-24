import TideApp from "@/components/TideApp.tsx"

export default function Page() {
    return (
        <main>
            <h1>
                Tide<span>Tracker</span>
            </h1>
            <p className="sub">Live tides for any coast. Search a place or use your location.</p>
            <TideApp />
            <footer>
                US coasts use the nearest NOAA tide station (predictions plus the live gauge where there is one). Everywhere
                else uses Open-Meteo&apos;s global sea level model. JSON API: <code>/api/tide?location=lagos</code>,{" "}
                <code>/api/tide?lat=..&amp;lon=..</code>, <code>/api/tide?station=8443970</code>.{" "}
                <a href="https://github.com/Odey340/TideAPI" style={{ color: "inherit" }}>
                    Source
                </a>
                . Not for navigation.
            </footer>
        </main>
    )
}
