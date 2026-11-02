
{ pkgs ? import <nixpkgs> {} }:

let
  bun = pkgs.stdenvNoCC.mkDerivation {
    pname = "bun";
    version = "1.4.0";

    src = pkgs.fetchurl {
      url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-x64.zip";
      sha256 = "0lp45zljagwcv1l2jv7mi3a1j6hsrsr838m0mikvbj1sp1gzn0rd";
    };

    sourceRoot = "bun-linux-x64";
    nativeBuildInputs = with pkgs; [
      autoPatchelfHook
      unzip
    ];
    buildInputs = [ pkgs.openssl ];

    dontConfigure = true;
    dontBuild = true;

    installPhase = ''
      runHook preInstall
      install -Dm755 bun "$out/bin/bun"
      ln -s "$out/bin/bun" "$out/bin/bunx"
      runHook postInstall
    '';
  };
  node = pkgs.stdenvNoCC.mkDerivation {
    pname = "nodejs";
    version = "24.19.0";
    src = pkgs.fetchurl {
      url = "https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz";
      sha256 = "14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647";
    };
    sourceRoot = "node-v24.19.0-linux-x64";
    nativeBuildInputs = [ pkgs.autoPatchelfHook ];
    buildInputs = [ pkgs.stdenv.cc.cc.lib ];
    dontConfigure = true;
    dontBuild = true;
    installPhase = ''
      mkdir -p "$out"
      cp -r bin include lib share "$out/"
    '';
  };
in
pkgs.mkShell {
  packages = [ bun node ];

  shellHook = ''
    echo "sewadah frontend shell — $(bun --version)"
  '';
}

