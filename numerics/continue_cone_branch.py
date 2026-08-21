import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy import optimize, special

R_STAR = 28.026397413333317
RHO = 51.043535183571514
LAMBDA_STAR = (RHO / R_STAR) ** 2
TARGET_N = 28
K = 13
SAMPLES = 8 * (K + 1)
THETA = (np.arange(SAMPLES) + 0.37) * 2 * math.pi / SAMPLES
COS = np.array([[math.cos(k * t) for t in THETA] for k in range(K + 1)])
SIN = np.array([[math.sin(k * t) for t in THETA] for k in range(K + 1)])


def order_zero_slope(order):
    step = 1e-5
    d_order = (special.jv(order + step, RHO) - special.jv(order - step, RHO)) / (2 * step)
    return -d_order / special.jvp(order, RHO, 1)


ZERO_SLOPE = order_zero_slope(R_STAR)
RATIO_2 = special.jvp(2 * R_STAR, RHO, 1) / special.jv(2 * R_STAR, RHO)
RPP = -math.sqrt(LAMBDA_STAR) / (4 * R_STAR * ZERO_SLOPE) * (2 + RHO * RATIO_2)
E_PRIME = math.sqrt(LAMBDA_STAR) * RATIO_2


def unpack(z, s):
    R = z[0]
    h = np.zeros(K + 1)
    h[0] = z[1]
    h[1] = s
    h[2:] = z[2 : K + 1]
    a = z[K + 1 : 2 * K + 2]
    return R, h, a


def pack(R, h, a):
    return np.r_[R, h[0], h[2:], a]


def basis_at(R, radii):
    sample_count = len(radii)
    q = RHO / R
    values = np.empty((K + 1, sample_count))
    radial = np.empty_like(values)
    values[0] = special.jv(0, q * radii) / special.jv(0, RHO)
    radial[0] = q * special.jvp(0, q * radii, 1) / special.jv(0, RHO)
    for k in range(1, K + 1):
        order = k * R
        if k == 1:
            scale = q * special.jvp(order, RHO, 1)
        else:
            scale = special.jv(order, RHO)
        values[k] = special.jv(order, q * radii) / scale
        radial[k] = q * special.jvp(order, q * radii, 1) / scale
    return values, radial


def point_residual_grid(z, s, theta, cosine, sine):
    R, h, a = unpack(z, s)
    graph = h @ cosine
    graph_prime = -(np.arange(K + 1) * h) @ sine
    radii = R - graph
    if R < 20 or np.min(radii) < 20:
        return np.full(2 * SAMPLES, 1e3 + abs(R - 28))
    values, radial = basis_at(R, radii)
    u = (a[:, None] * values * cosine).sum(axis=0)
    ur = (a[:, None] * radial * cosine).sum(axis=0)
    upsi = (a[:, None] * values * (-np.arange(K + 1)[:, None] * sine)).sum(axis=0)
    normal = ur + (R * R / (radii * radii)) * graph_prime * upsi
    return np.r_[u - 1, normal]


def point_residual(z, s):
    return point_residual_grid(z, s, THETA, COS, SIN)


def initial_jet(s):
    R = R_STAR + 0.5 * RPP * s * s
    h = np.zeros(K + 1)
    h[0] = s * s / (4 * R_STAR)
    h[1] = s
    h[2] = s * s * (1 / (4 * R_STAR) + E_PRIME / 4)
    a = np.zeros(K + 1)
    a[0] = 1 - LAMBDA_STAR * s * s / 4
    a[1] = -LAMBDA_STAR * s
    a[2] = -LAMBDA_STAR * s * s / 4
    return pack(R, h, a)


def solve_at(s, guess):
    scale = np.ones_like(guess)
    scale[0] = 0.1
    result = optimize.least_squares(
        lambda z: point_residual(z, s), guess,
        x_scale=scale, ftol=2e-13, xtol=2e-13, gtol=2e-13,
        max_nfev=1800, verbose=0,
    )
    R, h, a = unpack(result.x, s)
    residual = point_residual(result.x, s)
    validation_count = 512
    validation_theta = (np.arange(validation_count) + 0.173) * 2 * math.pi / validation_count
    validation_cos = np.array([[math.cos(k * t) for t in validation_theta] for k in range(K + 1)])
    validation_sin = np.array([[math.sin(k * t) for t in validation_theta] for k in range(K + 1)])
    validation = point_residual_grid(result.x, s, validation_theta, validation_cos, validation_sin)
    return result.x, {
        's': float(s), 'R': float(R), 'lambda': float((RHO / R) ** 2),
        'h': h.tolist(), 'a': a.tolist(),
        'dirichlet_rms': float(np.sqrt(np.mean(validation[:validation_count] ** 2))),
        'neumann_rms': float(np.sqrt(np.mean(validation[validation_count:] ** 2))),
        'max_residual': float(np.max(np.abs(validation))),
        'cost': float(result.cost), 'optimality': float(result.optimality),
        'success': bool(result.success), 'nfev': int(result.nfev),
    }


def main():
    records = []
    s_values = np.arange(0.01, 0.801, 0.01)
    guess = initial_jet(s_values[0])
    previous = None
    for s in s_values:
        if previous is None:
            guess = initial_jet(s)
        z, rec = solve_at(float(s), guess)
        records.append(rec)
        print(f"s={s:.3f} R={rec['R']:.10f} D={rec['dirichlet_rms']:.2e} N={rec['neumann_rms']:.2e} max={rec['max_residual']:.2e} n={rec['nfev']}")
        if not rec['success'] or rec['max_residual'] > 5e-3:
            print('continuation lost precision', file=sys.stderr)
            break
        if rec['R'] <= TARGET_N:
            break
        previous = guess
        guess = z

    if len(records) >= 2 and records[-1]['R'] <= TARGET_N:
        lo_rec, hi_rec = records[-2], records[-1]
        slo, shi = lo_rec['s'], hi_rec['s']
        zlo = pack(lo_rec['R'], np.array(lo_rec['h']), np.array(lo_rec['a']))
        zhi = pack(hi_rec['R'], np.array(hi_rec['h']), np.array(hi_rec['a']))
        for _ in range(22):
            smid = (slo + shi) / 2
            weight = (smid - slo) / (shi - slo)
            guess = (1 - weight) * zlo + weight * zhi
            zmid, mid = solve_at(smid, guess)
            if mid['R'] > TARGET_N:
                slo, zlo, lo_rec = smid, zmid, mid
            else:
                shi, zhi, hi_rec = smid, zmid, mid
        _, landing = solve_at((slo + shi) / 2, (zlo + zhi) / 2)
        records.append(landing)
    else:
        landing = records[-1]

    payload = {
        'method': 'even Fourier collocation of the exact cone Helmholtz and free-boundary equations',
        'targetN': TARGET_N, 'rho': RHO, 'RStar': R_STAR,
        'lambdaStar': LAMBDA_STAR, 'Rpp': RPP, 'modes': K,
        'samples': SAMPLES, 'records': records, 'landing': landing,
    }
    output_path = Path(__file__).resolve().with_name('branch-data.json')
    with output_path.open('w') as handle:
        json.dump(payload, handle, separators=(',', ':'))
    print('\nLANDING')
    print(json.dumps(landing, indent=2))


if __name__ == '__main__':
    main()
