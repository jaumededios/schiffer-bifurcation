# A counterexample to Schiffer's conjecture

Let `Ω⊂ℝ²` be a smooth bounded domain and suppose a nonconstant eigenfunction satisfies `−Δu=λu` in `Ω`, with both `u=constant` and `∂νu=0` on `∂Ω`. Schiffer's conjecture says that this overdetermined boundary behavior should force `Ω` to be a disk. This browser-based narrative explains why the disk is locally rigid, why the analogous problem is flexible on the half-cylinder and sphere, and how that flexibility can be transferred back to the plane using long cones and an integer symmetry landing.

## Three editions

- `/` is the visual-first interactive exposition.
- `/tufte/` is the same interactive exposition recast in Tufte's reading
  grammar: a stable text measure, genuine margin notes and figures, framed
  mathematical statements, and right-hand apparatus rails. Add
  `?layout-check=1` while developing to run its responsive layout contract;
  the page reports margin intrusion, overflow, misplaced controls, or a canvas
  whose bitmap aspect ratio disagrees with its CSS box in the browser console.
- `/paper/` is a proof-guided edition of the same argument and numerical figures. It adds a reading route, theorem statements, references, and progressively expandable proofs. In particular, the half-cylinder proof first displays the separated linearized blocks and their uniform lower bounds on `2≤λ≤3`; a nested panel then gives the Banach-space implicit-function argument. The cone proof uses the same structure for the uniform Lyapunov–Schmidt reduction.

The paper edition uses the relevance, findability, understandability, and usability principles summarized by [GaZmagik/iso-24495](https://github.com/GaZmagik/iso-24495). That repository is an unofficial interpretation of the ISO plain-language standards, so the site makes no ISO-conformance claim.

### Tufte layout language

The Tufte edition keeps content semantics separate from page geometry:

- every article-level `details` element is a reading-measure disclosure by
  default; only apparatus-local `.secondary-controls` opt out;
- Tufte's native `label.margin-toggle + input.margin-toggle + .marginnote`
  pattern is the complete margin-note API;
- `.math-statement` articles provide one grammar for definitions, problems,
  conjectures, propositions, lemmas, corollaries, and theorems;
- `.interactive-plate` means an apparatus with direct `section` and `aside`
  children; the stylesheet chooses their desktop and mobile placement.
- `.figure-band` groups a full-width visual, small multiple, or derivation;
  individual figure names never enter the page-measure selectors.

The widths for these components live only in the measure tokens at the top of
`tufte/tufte-port.css`; their instances need no per-item width classes or
layout-test attributes. With `?layout-check=1`, `tufte/layout-contract.js`
discovers the structures from their semantics and checks the contracts
automatically.

## Narrative structure

The website is ordered as one argument rather than a gallery of simulations:

1. The normalized overdetermined problem and its linear spectral-coincidence test.
2. The disk obstruction: `J₁(ρ)=0` and `J_ℓ(ρ)=0` cannot share a positive zero for integer `ℓ≥2` by the Bourget–Siegel theorem; `ℓ=1` is translation.
3. The flexible cylinder and sphere analogues.
4. The quotient move from one `N`-fold disk sector to a length-`N` cone and its nearly cylindrical rim.
5. The live half-cylinder free-boundary calculation.
6. Direct Bessel-versus-cylinder radial comparisons.
7. The quadratic order drift and its conversion into Debye phase drift.
8. The numerical `R*=28.026397… → N=28` continuation, integer landing, and global-to-local one-wavelength zoom in one laboratory.
9. A modulo-one plot of the computed crossings through `N=200`, followed by the two-phase existence mechanism.

The opening seven-stage geometry animation is explicitly schematic until its final boundary: it divides the actual 28-fold pattern, selects one sector, continuously folds its two radial sides into a single quotient seam, sends the cone tip to infinity, perturbs the resulting half-cylinder, and restores the cone. At integer order the motion is reversed rather than cross-faded: the seam is cut, the wiggly cone opens into one planar sector, and 28 identical sectors rotate into place. Its final wiggly outline uses the continued `N=28` boundary coefficients. The order/phase plot and nested zoom use the nonlinear branch data. The radial basis comparison is a separate fixed-`λ` Bessel dataset described below.

## Uniform half-cylinder branch

The limiting object used throughout the story is the genuine one-ended cylinder

```text
Ω_{λ,s} = { (x,θ) ∈ ℝ × S¹ : x < h_{λ,s}(θ) }.
```

For every compact `K ⊂ (1,4)`, the local construction gives one `ε_K > 0` valid for all `λ ∈ K` and `|s| < ε_K`, with

```text
(Δ+λ)u_{λ,s} = 0             in Ω_{λ,s},
u_{λ,s} = 1,  ∂νu_{λ,s} = 0  on ∂Ω_{λ,s},

h_{λ,s}(θ) = s cos θ + O_K(s²),
u_{λ,s}(x,θ) = cos(√λ x)
  + s λ/√(λ−1) sin(√(λ−1)x) cos θ + O_K(s²).
```

The remainders are uniform on each fixed boundary collar. Fall–Minlend–Weth state their published result for compact domains in the flat cylinder; the half-infinite formulation above follows from the same separated-mode, weighted-space, and local bifurcation tools. It is the formulation that directly models the limit of the long cone.

The domain is

```text
Ωs = { (x, θ) : x ≤ h_s(θ) },
h_s(θ) = s cos(θ − φ) + h₂ cos(2(θ − φ)) + h₃ cos(3(θ − φ)),   θ ∈ S¹.
```

At `s = 0`, the heat-map domain is a rectangle representing a collar of the half-cylinder. The first wall coefficient is fixed as the amplitude gauge `h₁ = s`; the mean axial translation is fixed to zero. For every selected `(λ,s)`, the browser solves for `h₂` and `h₃` together with the field coefficients.

## Browser numerical model

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

The default 3D view embeds the half-cylinder samples as

```text
(x, θ) ↦ (x, R cos θ, R sin θ),
```

so the moving free boundary becomes the wavy open rim of a rotatable cylinder. The **Unwrapped** view displays the same field in `(x, θ)` coordinates. Both views use the same solved field and update from the same controls.

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

The visible interface keeps the landing and zoom together in one laboratory: the left panel assembles all 28 copies, while the main panel unwraps the seam-centered wavelength. The older standalone cone-view laboratory is not part of the visible story.

## One-wavelength nested zoom

The third laboratory puts the angular-mode comparison into one global-to-local picture. On the left, 28 copies of the relaxed quotient are assembled into the full wiggly object. A cyan box centered on the assembly seam selects one angular wavelength,

```text
Δφ = 2π/R,       rim arc length = R Δφ = 2π.
```

The large panel unwraps that exact physical patch into `(x, ψ)` coordinates. Its vertical extent is one quotient period `ψ ∈ [−π,π]`; its horizontal extent is a fixed five-unit radial collar. This is why the zoom has the same rectangular geometry as the flat half-cylinder. The true non-integer gap passes through the center of the zoom. Its position and crop scale are deliberately fixed; only the bifurcation branch remains interactive.

Every scale is evaluated from the same interpolated nonlinear branch record, Fourier–Bessel field, and free boundary. The angular gap is not invented or visually substituted: it is

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

The derivative is nonzero, so near the crossing `R` and the phase of the local cylinder wave are equivalent scalar parameters. The exact Bessel zero at `R*` anchors the comparison at a pure sine. Moving from `R* = 28.026397…` to `N = 28` gives a Debye phase shift of `1.4971°`; the phase extracted independently from the exact rim Cauchy data is `1.4978°`. Both traces are solid: the exact Bessel curve is cyan and its phase-matched cylinder curve is orange.

There are two local orders of variation here. Debye gives `Δξ(R) = −β*(R − R*) + O((R − R*)²)`, where `β* = acos(R*/ρ)`. The bifurcating branch is even in its signed amplitude, `R(s) − R* = c₂s² + O(s⁴)`. Consequently the phase displayed against the branch slider is quadratic: `Δξ(s) = −β*c₂s² + O(s⁴)`. The web dataset stores an independently evaluated critical Bessel profile at every solved branch record so the solid curve and exact Cauchy phase come from the numerical `R(s)` data.

## Fixed-λ Bessel basis laboratory

The radial laboratory is deliberately separate from the nonlinear branch. It fixes `λ=2.4`, varies the cone rim radius over `26≤r₀≤30`, and uses the coordinate `x=r−r₀` on `[r₀−5,r₀]`. The cylinder radial equation is

```text
fₖ″ + (λ − k²)fₖ = 0,
```

while the tip-regular cone basis is

```text
J_{kr₀}(√λ r) {cos(kψ), sin(kψ)}.
```

The singular `Y_{kr₀}` profile is rejected at the tip; modified Bessel functions solve the sign-flipped equation. Three live panels compare:

1. `k=1`: the exact `J_{r₀}` profile with the unique cylinder sine/cosine combination having the same rim value and derivative;
2. `k=2`: the rim-normalized `J_{2r₀}` profile with `exp(√(4−λ)x)`;
3. `k=3`: the rim-normalized `J_{3r₀}` profile with `exp(√(9−λ)x)`.

Every vertical axis is linear, making the last two curves visibly exponential. Both comparison traces are solid. A fixed cosine is not the correct `k=1` comparison: the Bessel rim Cauchy data change with `r₀`, so the matching cylinder coefficients rotate in the fixed basis `cos(ωx), sin(ωx)`.

At fixed `λ`, Debye gives

```text
ξ_λ(r₀) = r₀[√(λ−1) − acos(λ⁻¹ᐟ²)] − π/4 + O(r₀⁻¹).
```

Thus `26≤r₀≤30` moves the local wave by about `72°`. Exact Bessel profiles are evaluated offline by `numerics/build_debye_wide_data.py`, stored in `debye-data.js`, and interpolated in the browser.

## Quadratic drift and the phase chain rule

The story panel derives rather than merely states the radius curvature. The quadratic second harmonic is

```text
W₂(t) = −(ρ²/4) J_{2R*}(ρt)/J_{2R*}(ρ),
S₂ = W₂′(1) = −(ρ³/4) J′_{2R*}(ρ)/J_{2R*}(ρ).
```

Cubic first-harmonic solvability gives the exact identity

```text
R″(0) = −√λ*/(4R*d*) [2 + ρ J′_{2R*}(ρ)/J_{2R*}(ρ)],
d* = ∂ν j_{ν,m}|_{ν=R*} > 0.
```

Its large-cone limit is

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

The visible boundary wave is a separate first-order effect:

```text
r_boundary(ψ;s) = R(s) − s cos ψ + O(s²).
```

Opposite rim points move linearly in `s`, while the angular average eliminates the cosine and leaves the quadratic mean-radius drift.

## Crossings through N=200 and the near-integer mechanism

The last canvas filters the saved common-zero data to `N≤200` and plots `(R,{R})` with a logarithmic horizontal `R`-axis. The underlying source remains

```text
Example Search/Data/bifurcation_points_lambda_2_3_first_10000.csv
```

from the companion Schiffer workspace. Its records solve

```text
J₁(ρ) = 0,   J_R(ρ) = 0,   2 ≤ ρ²/R² ≤ 3,
```

The `N=28` example is overlaid as a separate real reference point. The mathematical explanation uses the McMahon phase for `j_{1,n}` and the Debye phase for `j_{N,m}`. Kronecker's theorem aligns both phases simultaneously; monotonicity of `ν↦j_{ν,m}` then converts the small zero gap into a crossing `N<R<N+δ`. The dots illustrate this mechanism but are not used as evidence for equidistribution.

Below the plot, five examples summarize the scale range of the full 10,000-row search. Define the scale-free approximation exponent

```text
q(R) = −log{R}/log R,      equivalently {R} = R^(−q(R)).
```

The interval `20≤R<842` is divided into five equal logarithmic bands, and the table reports the largest `q(R)` in each band. This stratification prevents a dense high-order cluster from supplying every example. The resulting orders are approximately `34.066215`, `47.007880`, `152.000973`, `324.001339`, and `764.000064`. The separate `N=28` example is excluded because its `λ≈3.317` lies outside the exhaustive search window `[2,3]`.

## Reproduce the numerical data

The numerical sources live in `numerics/` and require Python 3.12, NumPy, and SciPy.

```sh
python3 -m venv .venv
.venv/bin/pip install -r numerics/requirements.txt
.venv/bin/python numerics/scan_crossings.py
.venv/bin/python numerics/continue_cone_branch.py
.venv/bin/python numerics/build_web_data.py
.venv/bin/python numerics/build_debye_wide_data.py
.venv/bin/python numerics/build_abundance_data.py \
  --input /path/to/Schiffer/Example\ Search/Data/bifurcation_points_lambda_2_3_first_10000.csv \
  --summary /path/to/Schiffer/Example\ Search/Data/bifurcation_points_lambda_2_3_first_10000_summary.json \
  --n28 /path/to/Schiffer/N28\ numerics\ \(succesful\)/data/bifurcation.json
```

The crossing scan reproduces the sub-100 running example. The continuation writes an ignored `numerics/branch-data.json`; `build_web_data.py` rebuilds `cone-data.js`; `build_debye_wide_data.py` evaluates the fixed-`λ`, `26≤r₀≤30` basis table; and `build_abundance_data.py` validates and compacts the external exhaustive CSV into `abundance-data.js`.

## Run locally

There is no website build step. Open `index.html`, or serve the directory with any static server. The optional 3D views load a pinned Three.js ES module from jsDelivr on demand.

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## License

MIT
