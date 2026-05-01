{
  description = "agency website — Astro static site, Nix-reproducible build";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      pkgsFor = system: import nixpkgs { inherit system; };
    in
    {
      # Static site → $out/ is the dist/ directory produced by `pnpm build`,
      # ready to be served as a static site (GitHub Pages, Cloudflare Pages, etc.).
      packages = forAllSystems (system:
        let pkgs = pkgsFor system; in
        {
          default = pkgs.stdenv.mkDerivation rec {
            pname = "agency-website";
            version = "0.1.0";

            # Restrict the source set so unrelated repo files don't churn the
            # input hash on every build.
            src = pkgs.lib.fileset.toSource {
              root = ./.;
              fileset = pkgs.lib.fileset.unions [
                ./package.json
                ./pnpm-lock.yaml
                ./tsconfig.json
                ./astro.config.mjs
                ./src
                ./public
              ];
            };

            # fetchPnpmDeps hash is platform-independent. Regenerate when
            # pnpm-lock.yaml changes — Nix prints the expected hash on
            # mismatch; paste it back here.
            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit pname version src;
              hash = "sha256-6ki82ytirluU7S81G0oDhTV+ekDESxpD+5Sg3Bbpklc=";
              fetcherVersion = 3;
            };

            nativeBuildInputs = [
              pkgs.nodejs
              pkgs.pnpm
              pkgs.pnpmConfigHook
            ];

            # Astro build is pure JS — skip fixupPhase (strip/patchShebangs
            # would traverse node_modules for no benefit).
            dontFixup = true;

            buildPhase = ''
              runHook preBuild
              pnpm build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              cp -r dist $out
              runHook postInstall
            '';
          };
        });

      # Dev shell with the toolchain just/website expects.
      devShells = forAllSystems (system:
        let pkgs = pkgsFor system; in
        {
          default = pkgs.mkShell {
            packages = [ pkgs.nodejs pkgs.pnpm pkgs.just ];
          };
        });
    };
}
