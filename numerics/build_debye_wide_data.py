"""Build exact large-radius Bessel profiles for the browser Debye laboratory.

The laboratory keeps lambda fixed and moves the cone rim near the running
example, from r0=26 to r0=30.
This is deliberately separate from the nonlinear N=28 continuation, which
keeps rho fixed and only moves R by 0.026.  Each profile is sampled on the
fixed physical collar [r0 - 5, r0].
"""

import json
import math
from pathlib import Path

import numpy as np
from scipy import special


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "debye-data.js"
LAMBDA = 2.4
R_MIN = 26
R_MAX = 30
R_REFERENCE = 28
R_STEP = 0.05
DEPTH = 5.0
X_SAMPLES = 101


def rounded(value):
    if isinstance(value, float):
        return float(f"{value:.10g}")
    if isinstance(value, list):
        return [rounded(item) for item in value]
    if isinstance(value, dict):
        return {key: rounded(item) for key, item in value.items()}
    return value


def main():
    radii = np.arange(R_MIN, R_MAX + R_STEP / 2, R_STEP, dtype=float)
    x_grid = np.linspace(-DEPTH, 0.0, X_SAMPLES)
    root_lambda = math.sqrt(LAMBDA)
    omega = math.sqrt(LAMBDA - 1.0)
    profiles = {"1": [], "2": [], "3": []}
    rim_value = []
    rim_derivative = []

    for radius in radii:
        argument = root_lambda * (radius + x_grid)
        for mode in (1, 2, 3):
            order = mode * radius
            values = special.jv(order, argument)
            value_at_rim = special.jv(order, root_lambda * radius)
            derivative_at_rim = root_lambda * special.jvp(
                order, root_lambda * radius, 1
            )

            if mode == 1:
                # Normalize the oscillatory channel by its cylinder Cauchy
                # amplitude.  This stays regular as the rim crosses a zero.
                amplitude = math.hypot(value_at_rim, derivative_at_rim / omega)
                normalized = values / amplitude
                rim_value.append(value_at_rim / amplitude)
                rim_derivative.append(derivative_at_rim / amplitude)
            else:
                # The evanescent channels are positive in this regime.  Rim
                # normalization makes the limiting exponential equal to one
                # at x=0 and avoids the tiny absolute scale of large-order J.
                normalized = values / value_at_rim

            if not np.all(np.isfinite(normalized)):
                raise RuntimeError(f"non-finite mode {mode} profile at r0={radius}")
            profiles[str(mode)].append(normalized.tolist())

    phase_rate = math.sqrt(LAMBDA - 1.0) - math.acos(LAMBDA ** -0.5)
    payload = {
        "source": "SciPy evaluation of J_(k r0)(sqrt(lambda) r) on a fixed rim collar",
        "lambda": LAMBDA,
        "rMin": R_MIN,
        "rMax": R_MAX,
        "rReference": R_REFERENCE,
        "rStep": R_STEP,
        "depth": DEPTH,
        "xGrid": x_grid.tolist(),
        "radii": radii.tolist(),
        "phaseRate": phase_rate,
        "profiles": profiles,
        "rimValue1": rim_value,
        "rimDerivative1": rim_derivative,
    }
    OUTPUT_PATH.write_text(
        "window.DEBYE_WIDE_DATA="
        + json.dumps(rounded(payload), separators=(",", ":"))
        + ";\n"
    )
    print(f"wrote {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
