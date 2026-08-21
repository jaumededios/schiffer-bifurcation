# Schiffer bifurcation laboratory

A browser-based numerical visualization of the Schiffer problem, from the infinite half-cylinder collar to a finite cone branch that lands at an integer symmetry order.

The domain is

```text
Ωs = { (x, θ) : x ≤ h_s(θ) },   h_s(θ) = s cos(θ − φ),   θ ∈ S¹.
```

At `s = 0`, the heat-map domain is a rectangle representing a collar of the half-cylinder. Moving `s` displaces the right-hand free boundary in the critical first Fourier mode.

## Numerical model

The field is recomputed in the browser whenever `λ`, `s`, `φ`, or the truncation order changes. Every retained term is an exact separated solution of

```text
(Δ + λ)u = 0.
```

The `k = 0` and `k = 1` radial factors are oscillatory. For `k ≥ 2`, the bounded half-cylinder modes are

```text
exp(√(k² − λ)x) cos(kθ),
exp(√(k² − λ)x) sin(kθ).
```

They decay as `x → −∞`, and their interior PDE residual is analytically zero. The coefficients are chosen by ridge-regularized least squares against the two free-boundary equations

```text
u(h_s(θ), θ) = 1,
∇u(h_s(θ), θ) · (1, −h_s'(θ)) / √(1 + h_s'(θ)²) = 0.
```

The solve uses a column-scaled Householder QR factorization rather than normal equations, with at least 256 angular samples and up to 16 angular modes. Exponential basis functions are also rescaled by constants to avoid overflow without changing the approximation space. The displayed Dirichlet and Neumann defects are evaluated independently on at least 512 shifted samples in the normalized metric

```text
‖f‖² = (2π)⁻¹ ∫₋π^π |f(θ)|² dθ.
```

Since `λ` and `s` are independent controls, most selected pairs are off the true one-dimensional solution branch and need not have zero boundary defect.

## Views

The flat view displays the field in the unwrapped coordinates `(x, θ)`. The 3D view embeds the same samples as

```text
(x, θ) ↦ (x, R cos θ, R sin θ),
```

so the moving free boundary becomes the wavy open rim of a rotatable cylinder. Both views use the same solved field and update from the same controls.

## Finite-cone continuation

The second laboratory follows the relaxed cone construction in Gonzalo Cao-Labora and Jaume de Dios Pont, [*Counterexamples to Schiffer's Conjecture*](https://arxiv.org/abs/2608.05114). In quotient coordinates `(r, ψ)`, the metric and Helmholtz operator are

```text
g_R = dr² + (r²/R²)dψ²,
Δ_R + λ = ∂²_r + r⁻¹∂_r + R²r⁻²∂²_ψ + λ.
```

An order scan solves

```text
J₁(ρ*) = 0,
J_R*(ρ*) = 0,
1 < (ρ*/R*)² < 4,
```

for candidate crossings with `N = floor(R*) < 100`. The smallest candidate whose fractional gap is below `0.1` is

```text
N = 28,
R* = 28.0263974133,
ρ* = j₁,₁₆ = 51.0435351836,
λ* = 3.3170112038.
```

This reproduces the `N = 28` numerical example in Figure 1 of the paper.

The nonlinear continuation expands the free boundary and regular cone field as

```text
r_boundary(ψ) = R - Σ h_k cos(kψ),
u(r, ψ) = Σ a_k F_k(r; R, ρ*) cos(kψ),
```

where every `F_k` is a normalized Bessel function of order `kR`. Thirteen even modes are fitted against `u = 1` and the exact metric-normal derivative on 112 collocation angles. The branch reaches

```text
R = 28 at s = 0.3593388236,
Dirichlet validation RMS = 1.24e-6,
Neumann validation RMS = 1.06e-6,
```

on a separate grid of 512 shifted angles. Since every retained Fourier-Bessel mode solves the cone Helmholtz equation analytically, truncation affects the moving-boundary equations rather than the interior PDE.

The browser interpolates the solved branch records and endpoint radial Bessel tables stored in `cone-data.js`. This keeps all interaction local and fast; it does not replace the continuation with a hand-drawn morph.

The cone laboratory has three linked views:

1. **Rim slice:** the last five radial units unwrapped as `(x, ψ)`, making the `R ≈ 28` cone look like the flat cylinder collar.
2. **3D cone:** the intrinsic metric embedded as a long, narrow cone. The depth slider moves continuously from the nearly cylindrical rim to the tip.
3. **Unfolded ×28:** twenty-eight sectors of angle `2π/R`. At `R*` the true angular seam is `0.339°`; at `R = 28` it closes exactly. A `×50` inset makes the initial gap legible without falsifying the main geometry.

## One-wavelength nested zoom

The third laboratory puts the angular-mode comparison into one global-to-local picture. On the left, 28 copies of the relaxed quotient are assembled into the full wiggly object. A cyan box centered on the assembly seam selects one angular wavelength,

```text
Δφ = 2π/R,       rim arc length = R Δφ = 2π.
```

The large panel unwraps that exact physical patch into `(x, ψ)` coordinates. Its vertical extent is one quotient period `ψ ∈ [−π,π]`; its horizontal extent is a fixed five-unit radial collar. This is why the zoom has the same rectangular geometry as the flat half-cylinder. The true non-integer gap passes through the center of the zoom. Its position and crop scale are deliberately fixed; only the bifurcation branch remains interactive.

Every scale is evaluated from the same interpolated nonlinear branch record, Fourier–Bessel field, and free boundary used by the cone laboratory. The angular gap is not invented or visually substituted: it is

```text
gap angle = 2π(1 − 28/R),
gap arc length at the rim = 2π(R − 28).
```

The accompanying explanation keeps the radial degree-of-freedom comparison explicit. On the cylinder, an oscillatory radial equation has the two-dimensional space `span{cos(ωx), sin(ωx)}`, whose coefficient ratio is a phase. On the cone, tip regularity keeps `J_{kR}` and rejects singular `Y_{kR}`; `I/K` instead belong to the sign-flipped equation. Varying real `R` changes the phase of the single regular Bessel profile and supplies the relaxed scalar direction used by the bifurcation.

## Reproduce the cone data

The numerical sources live in `numerics/` and require Python 3.12, NumPy, and SciPy.

```sh
python3 -m venv .venv
.venv/bin/pip install -r numerics/requirements.txt
.venv/bin/python numerics/scan_crossings.py
.venv/bin/python numerics/continue_cone_branch.py
.venv/bin/python numerics/build_web_data.py
```

The first command reproduces the sub-100 crossing scan. The continuation writes an ignored `numerics/branch-data.json`; the final command deterministically rebuilds the checked-in browser dataset.

## Run locally

There is no website build step. Open `index.html`, or serve the directory with any static server. The optional 3D views load a pinned Three.js ES module from jsDelivr on demand.

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## License

MIT
