# Schiffer / Berenstein — interactive visualization

A visual, browser-based companion to the cone bifurcation and spectral-density mechanism in the Schiffer construction.

The site contains three linked experiments:

- a morphing cone/cylinder with live spectral ratio and branch-amplitude controls;
- Schiffer and Berenstein viewing modes;
- a live phase-coincidence plot over fractional order `N`, with a boundary zoom near integer orders.

Everything is plain HTML, CSS, and JavaScript. There is no build step and no runtime dependency.

## Run locally

Open `index.html` directly, or serve this directory:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Mathematical status

This is an intuition-first visual model, not a numerical certificate for exact Bessel zeros. The coincidence engine evaluates the leading phase laws used by the proof:

```text
j_(1,n) ≈ π(n + 1/4)
N f(j_(N,m)/N) ≈ π(m - 1/4)
f(c) = √(c² - 1) - acos(1/c)
```

The geometry uses the branch heuristic `R(s) ≈ R₀ − Γ(λ)s²/2`.

## License

MIT
