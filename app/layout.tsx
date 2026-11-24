import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
    title: "TideTracker",
    description: "Live tide predictions and water levels for any coast, from NOAA and Open-Meteo.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}
