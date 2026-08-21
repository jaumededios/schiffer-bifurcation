#!/usr/bin/env python3
"""Build the compact browser dataset for the near-integer crossing plot.

The source CSV is the saved exhaustive Bessel search from the Schiffer
workspace.  Only columns used by the browser interaction are retained.  The
fractional part and lambda=rho^2/R^2 are derived at runtime, so they do not need
to be duplicated 10,000 times in the generated JavaScript.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from decimal import Decimal, getcontext
from pathlib import Path
from typing import Any


REPO = Path(__file__).resolve().parents[1]
SCHIFFER_REPO = REPO.parent / "Schiffer"
DEFAULT_INPUT = (
    SCHIFFER_REPO
    / "Example Search"
    / "Data"
    / "bifurcation_points_lambda_2_3_first_10000.csv"
)
DEFAULT_SUMMARY = DEFAULT_INPUT.with_name(
    "bifurcation_points_lambda_2_3_first_10000_summary.json"
)
DEFAULT_N28 = (
    SCHIFFER_REPO
    / "N28 numerics (succesful)"
    / "data"
    / "bifurcation.json"
)
DEFAULT_OUTPUT = REPO / "abundance-data.js"

EXPECTED_FIELDS = {
    "rank",
    "n",
    "local_index",
    "rho",
    "R",
    "lambda_value",
    "residual_abs",
    "window_margin_abs",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate abundance-data.js from the exhaustive crossing CSV."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--summary", type=Path, default=DEFAULT_SUMMARY)
    parser.add_argument("--n28", type=Path, default=DEFAULT_N28)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--digits",
        type=int,
        default=9,
        help="Decimal places retained for R and rho (default: 9).",
    )
    return parser.parse_args()


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        fields = set(reader.fieldnames or [])
        if fields != EXPECTED_FIELDS:
            missing = sorted(EXPECTED_FIELDS - fields)
            extra = sorted(fields - EXPECTED_FIELDS)
            raise SystemExit(f"Unexpected CSV schema; missing={missing}, extra={extra}")
        rows = list(reader)
    if not rows:
        raise SystemExit("Input CSV is empty.")
    return rows


def validate_rows(rows: list[dict[str, str]]) -> None:
    previous_r = -math.inf
    for expected_rank, row in enumerate(rows, start=1):
        rank = int(row["rank"])
        n = int(row["n"])
        local_index = int(row["local_index"])
        rho = float(row["rho"])
        radius = float(row["R"])
        lambda_value = float(row["lambda_value"])
        residual = float(row["residual_abs"])

        if rank != expected_rank:
            raise SystemExit(f"Ranks are not consecutive at row {expected_rank}.")
        if n < 1 or local_index < 1:
            raise SystemExit(f"Non-positive index at row {expected_rank}.")
        if not (radius > previous_r):
            raise SystemExit(f"R is not strictly increasing at row {expected_rank}.")
        if not (2.0 <= lambda_value <= 3.0):
            raise SystemExit(f"lambda outside [2,3] at row {expected_rank}.")
        if residual < 0.0 or not all(
            math.isfinite(value) for value in (rho, radius, lambda_value, residual)
        ):
            raise SystemExit(f"Invalid numeric value at row {expected_rank}.")
        recomputed = (rho / radius) ** 2
        if not math.isclose(recomputed, lambda_value, rel_tol=2e-13, abs_tol=2e-13):
            raise SystemExit(f"lambda identity failed at row {expected_rank}.")
        previous_r = radius


def rounded_column(rows: list[dict[str, str]], name: str, digits: int) -> list[float]:
    return [round(float(row[name]), digits) for row in rows]


def relative_source_label(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(SCHIFFER_REPO.resolve()))
    except ValueError:
        return str(path)


def build_payload(
    rows: list[dict[str, str]],
    source_path: Path,
    summary_path: Path,
    n28_path: Path,
    digits: int,
) -> dict[str, Any]:
    with summary_path.open() as handle:
        summary = json.load(handle)
    with n28_path.open() as handle:
        n28 = json.load(handle)

    getcontext().prec = 60
    n28_r = Decimal(n28["N_star"])
    n28_rho = Decimal(n28["z_star"])
    n28_ratio = (n28_rho / n28_r) ** 2
    n28_gap = n28_r - int(n28_r)

    radii = rounded_column(rows, "R", digits)
    rhos = rounded_column(rows, "rho", digits)
    neumann_indices = [int(row["n"]) for row in rows]
    window_indices = [int(row["local_index"]) for row in rows]

    source_hash = hashlib.sha256(source_path.read_bytes()).hexdigest()
    maximum_rounding_error = 0.5 * 10 ** (-digits)
    payload: dict[str, Any] = {
        "meta": {
            "schemaVersion": 1,
            "pointCount": len(rows),
            "source": relative_source_label(source_path),
            "sourceSha256": source_hash,
            "search": {
                "equations": ["J_1(rho) = 0", "J_R(rho) = 0"],
                "ratioDefinition": "lambda = rho^2 / R^2",
                "lambdaWindow": [2, 3],
                "ordering": "R ascending",
                "retained": "first 10000 crossings after sorting by R",
                "scanStep": 0.05,
                "polishDecimalDigits": 60,
                "exhaustiveThroughR": summary["threshold_R"],
                "nextUnprocessedLowerBoundR": summary["next_lower_bound_R"],
                "nMaxProcessed": summary["n_max_processed"],
                "foundBeforeTruncation": summary["total_found_before_truncation"],
                "maxPolishResidualAbs": summary["max_polish_residual_abs"],
            },
            "coverage": {
                "rMin": float(rows[0]["R"]),
                "rMax": float(rows[-1]["R"]),
                "integerPartMin": math.floor(float(rows[0]["R"])),
                "integerPartMax": math.floor(float(rows[-1]["R"])),
            },
            "recordFields": [
                {
                    "column": "R",
                    "meaning": "real Bessel order at the crossing",
                    "decimalPlaces": digits,
                },
                {
                    "column": "rho",
                    "meaning": "shared positive zero j_(1,n) = j_(R,m)",
                    "decimalPlaces": digits,
                },
                {
                    "column": "n",
                    "meaning": "positive-zero index in rho = j_(1,n)",
                },
                {
                    "column": "localIndex",
                    "meaning": "root position for this n within the lambda window, sorted by R",
                },
            ],
            "derivedFields": {
                "integerPart": "floor(R)",
                "fractionalPart": "R - floor(R)",
                "lambda": "(rho / R)^2",
            },
            "rounding": {
                "maximumAbsoluteError": maximum_rounding_error,
                "note": "Display copy only; the source CSV retains 30 significant digits.",
            },
            "reference": {
                "label": "N = 28 running example",
                "source": relative_source_label(n28_path),
                "R": float(n28_r),
                "RExact": str(n28_r),
                "rho": float(n28_rho),
                "rhoExact": str(n28_rho),
                "fractionalPart": float(n28_gap),
                "lambda": float(n28_ratio),
                "fixedOrderZeroIndex": int(n28["k_neum"]),
                "orderRZeroIndex": int(n28["ell_dir"]),
                "includedInExhaustiveColumns": False,
                "exclusionReason": "Its lambda is above the exhaustive search window [2,3].",
            },
        },
        "columns": {
            "R": radii,
            "rho": rhos,
            "n": neumann_indices,
            "localIndex": window_indices,
        },
    }
    return payload


def write_javascript(payload: dict[str, Any], output_path: Path) -> None:
    compact = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    header = (
        "// Generated by numerics/build_abundance_data.py; do not edit by hand.\n"
        "// Real exhaustive Bessel-crossing data, compacted for browser use.\n"
    )
    javascript = (
        f"{header}(function(global){{\n"
        '  "use strict";\n'
        f"  const payload={compact};\n"
        "  Object.freeze(payload.meta);\n"
        "  Object.keys(payload.columns).forEach(function(key){Object.freeze(payload.columns[key]);});\n"
        "  Object.freeze(payload.columns);\n"
        "  global.SCHIFFER_ABUNDANCE_DATA=Object.freeze(payload);\n"
        '})(typeof window!=="undefined"?window:globalThis);\n'
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(javascript)


def main() -> None:
    args = parse_args()
    if not (3 <= args.digits <= 15):
        raise SystemExit("--digits must lie between 3 and 15.")
    rows = read_rows(args.input)
    validate_rows(rows)
    payload = build_payload(rows, args.input, args.summary, args.n28, args.digits)
    write_javascript(payload, args.output)
    print(
        f"Wrote {len(rows):,} crossings to {args.output} "
        f"({args.output.stat().st_size:,} bytes)."
    )


if __name__ == "__main__":
    main()
