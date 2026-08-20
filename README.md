# Half-cylinder bifurcation laboratory

A focused, browser-based numerical visualization of the Schiffer problem near the boundary of an infinite half-cylinder.

The domain is

```text
Ωs = { (x, θ) : x ≤ h_s(θ) },   h_s(θ) = s cos(θ − φ),   θ ∈ S¹.
```

At `s = 0`, the heat-map domain is a rectangle representing a collar of the half-cylinder. Moving `s` displaces the right-hand free boundary in the critical first Fourier mode.

## Numerical model

The field is recomputed in the browser whenever `λ`, `s`, `φ`, or the truncation order changes. It uses

```text
u₀(d) = cos(√λ d),   d = h_s(θ) − x,
```

together with an oscillatory critical corrector and the exponentially decaying higher modes

```text
d² exp(−√(k² − λ)d) cos(kθ),
d² exp(−√(k² − λ)d) sin(kθ),    k ≥ 2.
```

Their coefficients are chosen by a ridge-regularized least-squares solve minimizing the sampled residual of `(Δ + λ)u = 0` on the current variable domain. The factor `d²` makes `u = 1` and `∂νu = 0` exact at the displayed boundary.

This is a genuine truncated numerical collar model, not a claim that the prescribed boundary is an exact global free-boundary solution.

## Run locally

There is no build step or runtime dependency. Open `index.html`, or serve the directory with any static server.

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## License

MIT
