import Decimal from "break_infinity.js";

export { Decimal }

export const D = (v = 0) => new Decimal(v);

export const ZERO = Decimal.ZERO
export const ONE = Decimal.ONE


export function format(d) {
    return d.toString();
}

export function formatInt(d) {
    if (d === null || d === undefined) return "0";
    let dec;
    try {
        dec = d instanceof Decimal ? d : new Decimal(d);
    } catch {
        return "0";
    }
    const text = dec.toString();
    if (text === "NaN" || text === "Infinity" || text === "-Infinity") return "0";
    if (dec.abs().gte(1e6)) return dec.toExponential(2);
    return dec.toFixed(0);
}
