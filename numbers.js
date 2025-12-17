import Decimal from "break_infinity.js";

export { Decimal }

export const D = (v = 0) => new Decimal(v);

export const ZERO = Decimal.ZERO
export const ONE = Decimal.ONE


export function format(d) {
    return d.toString();
}