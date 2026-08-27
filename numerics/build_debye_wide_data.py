"""Build exact large-radius Bessel profiles for the browser Debye laboratory.

For each real rim radius R between 26 and 30, continue the fourth positive
zero rho_R of J_R'.  The spectral scale q_R=rho_R/R therefore makes the k=1
profile J_R(q_R r) a genuine Neumann eigenfunction at r=R.  Each profile is
sampled on the fixed physical collar [R - 5, R].

The k=0 channel is phase-normalized; the k>=1 channels are normalized by
their rim value.  This family is deliberately separate from the nonlinear
N=28 continuation, which keeps rho fixed and moves R by only 0.026.
"""

import json
import math
from pathlib import Path

import numpy as np
from scipy import optimize, special


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "debye-data.js"
R_MIN = 26
R_MAX = 30
R_REFERENCE = 28
R_STEP = 0.05
NEUMANN_ROOT_INDEX = 4
DEPTH = 5.0
X_SAMPLES = 101
GLOBAL_Q_SAMPLES = 181
MODES = (0, 1, 2, 3)


def rounded(value):
    if isinstance(value, float):
        return float(f"{value:.12g}")
    if isinstance(value, list):
        return [rounded(item) for item in value]
    if isinstance(value, dict):
        return {key: rounded(item) for key, item in value.items()}
    return value


def continue_neumann_roots(radii):
    """Continue one simple zero of J_order' through the real-order interval."""
    roots = []
    previous_order = float(radii[0])
    previous_root = float(
        special.jnp_zeros(int(round(previous_order)), NEUMANN_ROOT_INDEX)[-1]
    )
    for index, order in enumerate(radii):
        order = float(order)
        if index:
            predictor = previous_root * order / previous_order
            previous_root = float(
                optimize.newton(
                    lambda argument: special.jvp(order, argument, 1),
                    predictor,
                    fprime=lambda argument: special.jvp(order, argument, 2),
                    tol=1e-13,
                    maxiter=40,
                )
            )
        residual = abs(special.jvp(order, previous_root, 1))
        if not math.isfinite(previous_root) or residual > 1e-11:
            raise RuntimeError(
                f"failed to continue J_{{{order}}}' zero: "
                f"rho={previous_root}, residual={residual}"
            )
        roots.append(previous_root)
        previous_order = order
    return np.asarray(roots)


def main():
    radii = np.arange(R_MIN, R_MAX + R_STEP / 2, R_STEP, dtype=float)
    rho_values = continue_neumann_roots(radii)
    q_values = rho_values / radii
    lambda_values = q_values ** 2
    x_grid = np.linspace(-DEPTH, 0.0, X_SAMPLES)
    q_grid = np.linspace(0.0, 1.0, GLOBAL_Q_SAMPLES)
    profiles = {str(mode): [] for mode in MODES}
    rim_slopes = {"0": []}

    for radius, rho, spectral_scale in zip(radii, rho_values, q_values):
        argument = spectral_scale * (radius + x_grid)
        for mode in MODES:
            order = mode * radius
            values = special.jv(order, argument)
            value_at_rim = special.jv(order, rho)

            if mode == 0:
                # A phase normalization is stable even when the rim happens
                # to lie near a zero of J_0.  It makes the corresponding
                # cylinder sine-cosine coefficient vector have unit norm.
                normalization = math.hypot(
                    value_at_rim, special.jvp(0, rho, 1)
                )
            else:
                normalization = value_at_rim

            # For k=1, J_R'(rho_R)=0 gives exact Neumann data.  The k>=2
            # channels are positive here and become boundary-normalized
            # exponentials.  The phase normalization above handles k=0.
            normalized = values / normalization

            if not np.all(np.isfinite(normalized)):
                raise RuntimeError(f"non-finite mode {mode} profile at r0={radius}")
            profiles[str(mode)].append(normalized.tolist())
            if mode == 0:
                # The k=0 cylinder channel is oscillatory.  Its comparison is
                # the sine-cosine combination with the same normalized Cauchy
                # data at the rim, not a falsely imposed Neumann cosine.
                normalized_slope = (
                    spectral_scale * special.jvp(0, rho, 1) / normalization
                )
                if not math.isfinite(normalized_slope):
                    raise RuntimeError(
                        f"non-finite mode 0 rim slope at r0={radius}"
                    )
                rim_slopes["0"].append(float(normalized_slope))

    # Whole-disk profiles are needed only at integer fold orders.  They use
    # exactly the same normalization as the collar samples, so a marked
    # sector in the global picture agrees with its magnification.
    global_profiles = {}
    for fold_order in range(R_MIN, R_MAX + 1):
        row = int(round((fold_order - R_MIN) / R_STEP))
        spectral_scale = q_values[row]
        rho = rho_values[row]
        fold_profiles = {}
        for mode in MODES:
            order = mode * fold_order
            values = special.jv(order, spectral_scale * fold_order * q_grid)
            value_at_rim = special.jv(order, rho)
            normalization = (
                math.hypot(value_at_rim, special.jvp(0, rho, 1))
                if mode == 0
                else value_at_rim
            )
            normalized = values / normalization
            if not np.all(np.isfinite(normalized)):
                raise RuntimeError(
                    f"non-finite global mode {mode} profile at N={fold_order}"
                )
            fold_profiles[str(mode)] = normalized.tolist()
        global_profiles[str(fold_order)] = fold_profiles

    payload = {
        "source": "SciPy evaluation of J_(kR)(q_R r) for k=0,1,2,3, with k=0 phase-normalized and k>=1 rim-normalized, and with q_R R the fourth positive zero of J_R', on a fixed rim collar and whole integer-order disk",
        "rMin": R_MIN,
        "rMax": R_MAX,
        "rReference": R_REFERENCE,
        "rStep": R_STEP,
        "neumannRootIndex": NEUMANN_ROOT_INDEX,
        "depth": DEPTH,
        "xGrid": x_grid.tolist(),
        "qGrid": q_grid.tolist(),
        "radii": radii.tolist(),
        "rhoValues": rho_values.tolist(),
        "lambdaValues": lambda_values.tolist(),
        "profiles": profiles,
        "rimSlopes": rim_slopes,
        "globalProfiles": global_profiles,
    }
    OUTPUT_PATH.write_text(
        "window.DEBYE_WIDE_DATA="
        + json.dumps(rounded(payload), separators=(",", ":"))
        + ";\n"
    )
    print(f"wrote {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
