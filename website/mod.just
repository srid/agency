# agency website — Astro static site, Nix-reproducible build.
#
# Imported from the root justfile as `mod website`. The website has its
# own flake at website/flake.nix; recipes use `nix develop` against it.
#
# In just's module system `justfile_directory()` returns the root justfile's
# dir, not this module's. Use `source_directory()` for paths relative to here.

here := source_directory()
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop ' + here + ' --accept-flake-config -c' }

# List available recipes
default:
    @just --list website

# Install pnpm deps (standalone, not part of any workspace)
install:
    cd {{ here }} && {{ nix_shell }} pnpm install --ignore-workspace

# Live preview with HMR (astro dev) → http://127.0.0.1:4321
dev: install
    cd {{ here }} && {{ nix_shell }} pnpm dev

# Type-check .astro files and TypeScript
check: install
    cd {{ here }} && {{ nix_shell }} pnpm check

# Build the static site via pnpm (fast, local) — emits ./dist
build: install
    cd {{ here }} && {{ nix_shell }} pnpm build

# Build the static site via Nix (reproducible) — prints the store path
nix-build:
    nix build {{ here }}#default --print-out-paths

# Serve the Nix-built site locally to inspect the deploy artefact
preview:
    #!/usr/bin/env bash
    set -euo pipefail
    out=$(nix build {{ here }}#default --print-out-paths --no-link)
    echo "Serving $out on http://127.0.0.1:4321"
    cd {{ here }} && {{ nix_shell }} pnpm exec astro preview --port 4321
