# Schiffer visual proof story

A browser-based narrative and numerical visualization of the Schiffer construction: why direct disk bifurcation is obstructed, why the half-cylinder is flexible, how a long flat cone reproduces the cylinder near its rim, how real Bessel order replaces cylinder phase, and how a nonlinear branch lands at integer symmetry order.

## Narrative structure

The website is ordered as one argument rather than a gallery of simulations:

1. The normalized overdetermined problem and its linear spectral-coincidence test.
2. The disk obstruction: `J₁(ρ)=0` and `J_ℓ(ρ)=0` cannot share a positive zero for integer `ℓ≥2` by the Bourget–Siegel theorem; `ℓ=1` is translation.
3. The flexible cylinder and sphere analogues.
4. The quotient move from one `N`-fold disk sector to a length-`N` cone and its nearly cylindrical rim.
5. The live half-cylinder free-boundary calculation.
6. Direct Bessel-versus-cylinder radial comparisons.
7. The quadratic order drift and its conversion into Debye phase drift.
8. The numerical `R*=28.026397… → N=28` cone continuation and integer landing.
9. A global-to-local one-wavelength zoom of the same solution.
10. A real-data modulo-one plot of 10,000 additional crossings.

The opening geometry animation is explicitly schematic. Its final wiggly outline uses the continued `N=28` boundary coefficients. The order/phase plot, cone views, nested zoom, and radial comparisons use the stored numerical datasets described below.

The domain is

```text
Ωs = { (x, θ) : x ≤ h_s(θ) },
h_s(θ) = s cos(θ − φ) + h₂ cos(2(θ − φ)) + h₃ cos(3(θ − φ)),   θ ∈ S¹.
```

At `s = 0`, the heat-map domain is a rectangle representing a collar of the half-cylinder. The first wall coefficient is fixed as the amplitude gauge `h₁ = s`; the mean axial translation is fixed to zero. For every selected `(λ,s)`, the browser solves for `h₂` and `h₃` together with the field coefficients.

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

They decay as `x → −∞`, and their interior PDE residual is analytically zero. The field and wall coefficients are chosen together by a damped Gauss–Newton least-squares solve against the two free-boundary equations

```text
u(h_s(θ), θ) = 1,
∇u(h_s(θ), θ) · (1, −h_s'(θ)) / √(1 + h_s'(θ)²) = 0.
```

Each nonlinear step uses the analytic Jacobian with respect to every field coefficient and the two wall coefficients; its least-squares subproblem uses a column-scaled Householder QR factorization rather than normal equations. A final QR solve polishes the field at the recovered wall. Training uses at least 256 angular samples and up to 16 angular field modes. Exponential basis functions are rescaled by constants to avoid overflow without changing the approximation space. The displayed Dirichlet and Neumann defects are evaluated independently on at least 512 shifted samples in the normalized metric

```text
‖f‖² = (2π)⁻¹ ∫₋π^π |f(θ)|² dθ.
```

This is now a truncated free-boundary calculation rather than a prescribed-cosine-wall fit. It still solves only two higher wall harmonics, and `λ` and `s` remain independent controls, so the result need not lie on the exact one-dimensional branch and its boundary defect need not vanish.

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

The accompanying explanation keeps the radial degree-of-freedom comparison explicit. On the cylinder, an oscillatory radial equation has the two-dimensional space `span{cos(ωx), sin(ωx)}`, whose coefficient ratio is a phase. On the cone, tip regularity keeps `J_{kR}` and rejects singular `Y_{kR}`; `I/K` instead belong to the sign-flipped equation.

The browser makes the moral local comparison directly. For the critical `k = 1` profile, set `r = R + x` and write

```text
B_R(x) = normalized J_R(√λ(R + x)).
```

On every fixed collar, its equation approaches `C″ + (λ − 1)C = 0` as `R → ∞`. Debye makes the phase correspondence explicit:

```text
J_R(√λ(R + x)) ≈ A_R(x) cos(ωx + ξ(R)),
ξ(R) = √(ρ² − R²) − R acos(R/ρ) − π/4,
ξ′(R) = −acos(R/ρ),                     ω = √(λ − 1).
```

The derivative is nonzero, so near the crossing `R` and the phase of the local cylinder wave are equivalent scalar parameters. The exact Bessel zero at `R*` anchors the comparison at a pure sine. Moving from `R* = 28.026397…` to `N = 28` gives a Debye phase shift of `1.4971°`; the phase extracted independently from the exact rim Cauchy data is `1.4978°`. The displayed dashed wave uses the Debye phase, while the solid trace uses the numerically evaluated Bessel profile. This comparison is presented as geometric intuition, not as a quoted step of the paper's proof.

There are two local orders of variation here. Debye gives `Δξ(R) = −β*(R − R*) + O((R − R*)²)`, where `β* = acos(R*/ρ)`. The bifurcating branch is even in its signed amplitude, `R(s) − R* = c₂s² + O(s⁴)`. Consequently the phase displayed against the branch slider is quadratic: `Δξ(s) = −β*c₂s² + O(s⁴)`. The web dataset stores an independently evaluated critical Bessel profile at every solved branch record so the solid curve and exact Cauchy phase come from the numerical `R(s)` data.

## Debye approximation laboratory

The radial laboratory isolates the local dictionary itself. In the rim coordinate `x = r − R ≤ 0`, the cylinder radial equation for angular mode `k` is

```text
fₖ″ + (λ − k²)fₖ = 0.
```

Thus `k = 0,1` have sine/cosine radial bases for `λ ∈ (1,4)`, while every `k ≥ 2` has a bounded half-cylinder branch `exp(αₖx)`, `αₖ = √(k²−λ)`. On the cone the corresponding tip-regular separated eigenfunctions are

```text
J_{kR}(√λ r) {cos(kψ), sin(kψ)}.
```

The singular `Y_{kR}` profile is rejected at the tip. Modified Bessel functions solve the equation with the opposite spectral sign and are not additional radial solutions of this Helmholtz problem.

Three live panels compare these descriptions over `x ∈ [−d,0]`:

1. `k = 1`: the exact derivative-normalized `J_R` profile against the anchored Debye sine/cosine combination;
2. `k = 2`: the rim-normalized `J_{2R}` profile against `exp(√(4−λ)x)`;
3. `k = 3`: the rim-normalized `J_{3R}` profile against `exp(√(9−λ)x)`.

The evanescent plots use `log₁₀|f/f(0)|`, making several orders of decay visible. The collar-depth control is also a convergence test: as `d` decreases, curvature terms are suppressed and the exact Bessel profiles approach the constant-coefficient cylinder modes.

This laboratory deliberately moves linearly in `R`, using `λ(R) = (ρ/R)²`, rather than following the nonlinear branch parameter. The critical curve interpolates the dense Bessel profiles evaluated at the solved branch orders; the two evanescent curves interpolate evaluated endpoint tables on the short interval `R ∈ [28, 28.026397…]`. The cylinder functions and Debye phase are evaluated in JavaScript. It therefore displays the near-linear local correspondence

```text
Δξ = ξ(R) − ξ(R*) ≈ ξ′(R*)(R − R*),
```

while the neighboring branch-based panel displays the same change as quadratic in `s`.

## Quadratic drift and the phase chain rule

The story panel between the radial comparison and the integer landing uses the large-cone curvature law

```text
Γ(λ) = √((λ−1)(4−λ)) / (4 acos(λ⁻¹ᐟ²)),
R″(0) = −Γ(λ) + O(R⁻¹) < 0.
```

It overlays the stored `N=28` continuation records with the base quadratic law from `Rpp`. The corresponding Debye phase obeys

```text
Δξ(s) = ½ ξ′(R*)R″(0)s² + O(s⁴),
ξ′(R) = −acos(R/ρ).
```

Thus phase is locally linear in real order `R`, although both quantities change quadratically along the signed branch parameter `s`.

## Abundance of near-integer crossings

The last canvas uses the saved exhaustive search

```text
Example Search/Data/bifurcation_points_lambda_2_3_first_10000.csv
```

from the companion Schiffer workspace. Its 10,000 records solve

```text
J₁(ρ) = 0,   J_R(ρ) = 0,   2 ≤ ρ²/R² ≤ 3,
```

and are plotted as `(R, R−floor(R))`. The search contains 1,023 crossings within `0.1` above an integer, 111 within `0.01`, and 12 within `0.001`; the smallest recorded gap is about `6.35×10⁻⁵`. These finite statistics illustrate abundance. The proof itself uses simultaneous two-frequency Debye phase alignment and a Kronecker-torus argument, rather than inferring density from the scatter plot.

The `N=28` example is overlaid as a separate real reference point. It is not included in those statistics because its ratio `λ≈3.317011` lies outside the exhaustive dataset's `[2,3]` window. `abundance-data.js` stores rounded display columns and source metadata; the original CSV retains the high-precision values.

## Reproduce the numerical data

The numerical sources live in `numerics/` and require Python 3.12, NumPy, and SciPy.

```sh
python3 -m venv .venv
.venv/bin/pip install -r numerics/requirements.txt
.venv/bin/python numerics/scan_crossings.py
.venv/bin/python numerics/continue_cone_branch.py
.venv/bin/python numerics/build_web_data.py
.venv/bin/python numerics/build_abundance_data.py \
  --input /path/to/Schiffer/Example\ Search/Data/bifurcation_points_lambda_2_3_first_10000.csv \
  --summary /path/to/Schiffer/Example\ Search/Data/bifurcation_points_lambda_2_3_first_10000_summary.json \
  --n28 /path/to/Schiffer/N28\ numerics\ \(succesful\)/data/bifurcation.json
```

The crossing scan reproduces the sub-100 running example. The continuation writes an ignored `numerics/branch-data.json`, `build_web_data.py` rebuilds `cone-data.js`, and `build_abundance_data.py` validates and compacts the external exhaustive CSV into `abundance-data.js`.

## Run locally

There is no website build step. Open `index.html`, or serve the directory with any static server. The optional 3D views load a pinned Three.js ES module from jsDelivr on demand.

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## License

MIT
