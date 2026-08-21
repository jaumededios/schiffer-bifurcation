"""Scan real-order Bessel crossings below N=100 in the lambda window (1, 4)."""

import math

import numpy as np
from scipy import optimize, special


def scan(max_n=99, zero_count=64):
    crossings = []
    for zero_index, rho in enumerate(special.jn_zeros(1, zero_count), start=1):
        lower = max(2.001, rho / 2 + 1e-8)
        upper = min(max_n + 0.999, rho - 1e-8)
        if lower >= upper:
            continue
        orders = np.linspace(lower, upper, max(800, int((upper - lower) * 180)))
        values = special.jv(orders, rho)
        previous_root = None
        for left, right, f_left, f_right in zip(orders[:-1], orders[1:], values[:-1], values[1:]):
            if not np.isfinite(f_left) or not np.isfinite(f_right) or f_left * f_right > 0:
                continue
            order = optimize.brentq(lambda value: special.jv(value, rho), left, right, xtol=5e-14)
            if previous_root is not None and abs(order - previous_root) < 1e-7:
                continue
            previous_root = order
            integer = math.floor(order)
            if integer <= max_n:
                crossings.append({
                    "N": integer,
                    "R": order,
                    "gap": order - integer,
                    "lambda": (rho / order) ** 2,
                    "rho": rho,
                    "zero_index": zero_index,
                })
    return sorted(crossings, key=lambda crossing: crossing["R"])


if __name__ == "__main__":
    result = scan()
    good = [crossing for crossing in result if crossing["gap"] < 0.1]
    selected = min(good, key=lambda crossing: crossing["N"])
    print(f"scanned {len(result)} crossings")
    print("smallest crossing with R-N < 0.1:")
    print(selected)
    print("all such crossings with N < 50:")
    for crossing in good:
        if crossing["N"] < 50:
            print(crossing)
