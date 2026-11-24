export type Units = "m" | "ft"

export const M_TO_FT = 3.28084

export function fmtHeight(m: number, units: Units) {
    const v = units === "ft" ? m * M_TO_FT : m
    return `${v.toFixed(2)} ${units}`
}
