"""Convert the solved cone branch into the dependency-free browser dataset."""

import json
from pathlib import Path

import numpy as np
from scipy import special


ROOT = Path(__file__).resolve().parents[1]
BRANCH_PATH = Path(__file__).resolve().with_name("branch-data.json")
OUTPUT_PATH = ROOT / "cone-data.js"


def radial_profiles(order_parameter, rho, mode_count, grid):
    wave_number = rho / order_parameter
    profiles = []
    for mode in range(mode_count + 1):
        order = mode * order_parameter
        if mode == 0:
            values = special.jv(0, rho * grid) / special.jv(0, rho)
        elif mode == 1:
            scale = wave_number * special.jvp(order, rho, 1)
            values = special.jv(order, rho * grid) / scale
        else:
            values = special.jv(order, rho * grid) / special.jv(order, rho)
        profiles.append(values.tolist())
    return profiles


def critical_profile(order_parameter, rho, grid):
    """Tip-regular k=1 profile normalized to have unit rim derivative."""
    wave_number = rho / order_parameter
    scale = wave_number * special.jvp(order_parameter, rho, 1)
    return special.jv(order_parameter, rho * grid) / scale


def rounded(value):
    if isinstance(value, float):
        return float(f"{value:.11g}")
    if isinstance(value, list):
        return [rounded(item) for item in value]
    if isinstance(value, dict):
        return {key: rounded(item) for key, item in value.items()}
    return value


def main():
    branch = json.loads(BRANCH_PATH.read_text())
    landing = branch["landing"]
    mode_count = branch["modes"]
    initial = {
        "s": 0.0,
        "R": branch["RStar"],
        "lambda": branch["lambdaStar"],
        "h": [0.0] * (mode_count + 1),
        "a": [1.0] + [0.0] * mode_count,
        "dirichlet_rms": 0.0,
        "neumann_rms": 0.0,
        "max_residual": 0.0,
    }
    keys = ["s", "R", "lambda", "h", "a", "dirichlet_rms", "neumann_rms", "max_residual"]
    records = [initial]
    records.extend(record for record in branch["records"] if record["s"] < landing["s"] - 1e-9)
    records.append(landing)
    records = [{key: record[key] for key in keys} for record in records]

    # A 1.03 / 309 step puts q = 1 exactly at index 300. This matters at the
    # crossing, where the critical profile has an exact rim zero.
    radial_grid = np.linspace(0, 1.03, 310)
    for index, record in enumerate(records):
        profile = critical_profile(record["R"], branch["rho"], radial_grid)
        record["criticalProfile"] = profile.tolist()
        record["criticalRim"] = 0.0 if index == 0 else float(profile[300])
    payload = {
        "source": "Cao-Labora–de Dios Pont cone equations; offline Fourier–Bessel collocation",
        "targetN": branch["targetN"],
        "RStar": branch["RStar"],
        "rho": branch["rho"],
        "lambdaStar": branch["lambdaStar"],
        "Rpp": branch["Rpp"],
        "modes": mode_count,
        "trainingSamples": branch["samples"],
        "validationSamples": 512,
        "landingS": landing["s"],
        "records": records,
        "profileGrid": radial_grid.tolist(),
        "profiles": {
            "crossing": radial_profiles(branch["RStar"], branch["rho"], mode_count, radial_grid),
            "landing": radial_profiles(branch["targetN"], branch["rho"], mode_count, radial_grid),
        },
        "search": {
            "lambdaWindow": [1, 4],
            "maxN": 99,
            "crossingsScanned": 389,
            "goodGap": 0.1,
            "selected": {"N": 28, "R": branch["RStar"], "gap": branch["RStar"] - 28, "zero": "j₁,₁₆"},
            "nextCloser": {"N": 42, "R": 42.001977270527, "gap": 0.001977270527, "zero": "j₁,₁₇"},
        },
    }
    OUTPUT_PATH.write_text("window.CONE_NUMERICS=" + json.dumps(rounded(payload), separators=(",", ":")) + ";\n")
    print(f"wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
