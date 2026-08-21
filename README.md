# Half-cylinder bifurcation laboratory

A focused, browser-based numerical visualization of the Schiffer problem near the boundary of an infinite half-cylinder.

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

## Run locally

There is no build step. Open `index.html`, or serve the directory with any static server. The optional 3D view loads a pinned Three.js ES module from jsDelivr on demand.

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## License

MIT
