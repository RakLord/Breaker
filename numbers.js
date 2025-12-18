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
    if (typeof d === "number") return Math.round(d).toString();
    if (typeof d === "string") return new Decimal(d).toFixed(0);
    if (typeof d?.toFixed === "function") return d.toFixed(0);
    return new Decimal(d).toFixed(0);
}
