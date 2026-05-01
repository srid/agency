# agency website

Single-page landing for [agency](https://github.com/srid/agency). Astro + Tailwind v4, deployed via GitHub Pages.

## Develop

```sh
just website::dev          # HMR on http://127.0.0.1:4321
just website::nix-build    # reproducible Nix build → /nix/store/...
```

The page itself is `src/pages/index.astro`; styles live in `src/styles/global.css`. There is no blog, no content collection — content drift between this page and the root `README.md` is enforced by `.agency/do.md`.

## Deploy

`.github/workflows/pages.yml` runs `nix build path:./website#default` on every push to `master` that touches `website/**` and publishes the result to GitHub Pages.

## Update deps

Bumping `pnpm-lock.yaml` changes the `fetchPnpmDeps` hash in `flake.nix`. On mismatch, Nix prints the expected hash; paste it back in.
