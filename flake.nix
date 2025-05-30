{
  description = "TeeworldsCN Admin Application";

  inputs.nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";

  outputs =
    {
      self,
      nixpkgs,
    }:
    let
      mkTwcnAdmin =
        package:
        let
          pname = package.pname;
          name = package.name;
          title = package.title;
          system = package.system;
          description = package.description;
          version = package.version;

          src = ./.;

          pkgs = import nixpkgs { inherit system; };

          desktopItem = pkgs.makeDesktopItem {
            desktopName = title;
            comment = description;
            name = pname;
            exec = "${pname} %F";
            icon = pname;
            terminal = false;
            categories = [ "Network" ];
            mimeTypes = [ ];
          };

        in
        pkgs.stdenv.mkDerivation {
          inherit pname;
          inherit version;
          inherit src;

          nativeBuildInputs = with pkgs; [
            nodejs
            makeWrapper
            imagemagick
          ];

          buildInputs = with pkgs; [
            nwjs
          ];

          phases = [
            "buildPhase"
            "installPhase"
          ];

          buildPhase = ''
            runHook preBuild
            cp -r ${src}/* .

            # Make src directory writable
            chmod -R u+w src

            # Create a simple node_modules with auto-launch stub
            # Since we're in a sandboxed environment, we'll provide a stub implementation
            mkdir -p src/node_modules/auto-launch
            echo '{"name":"auto-launch","version":"5.0.6","main":"index.js"}' > src/node_modules/auto-launch/package.json
            cat > src/node_modules/auto-launch/index.js << 'EOF'
// Stub implementation for auto-launch in Nix environment
class AutoLaunch {
  constructor(options) {
    this.name = options.name;
    this._isStub = true; // Flag to indicate this is a stub implementation
  }

  async isEnabled() {
    return false;
  }

  async enable() {
    console.log('Auto-launch enable not available in Nix build');
    return false;
  }

  async disable() {
    console.log('Auto-launch disable not available in Nix build');
    return false;
  }

  // Method to check if this is a stub implementation
  isStub() {
    return this._isStub === true;
  }
}

module.exports = AutoLaunch;
EOF

            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall

            mkdir -p $out/bin $out/share/twcn-admin

            # Copy the src directory directly as the application
            cp -r src/* $out/share/twcn-admin/

            # Install icon in multiple sizes
            if [ -f "src/icon.png" ]; then
              for size in 16 32 48 64 128 256; do
                mkdir -p $out/share/icons/hicolor/"$size"x"$size"/apps
                ${pkgs.imagemagick}/bin/convert src/icon.png -resize "$size"x"$size" \
                  $out/share/icons/hicolor/"$size"x"$size"/apps/${pname}.png
              done
            else
              echo "Warning: No icon found at src/icon.png"
            fi

            install -Dm644 ${desktopItem}/share/applications/${pname}.desktop -t $out/share/applications

            # Create wrapper script that runs NW.js with the src directory
            makeWrapper ${pkgs.nwjs}/bin/nw $out/bin/${pname} --add-flags $out/share/twcn-admin

            runHook postInstall
          '';
        };

      supportedSystems = [ "x86_64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      packages = forAllSystems (system: {
        default = mkTwcnAdmin {
          name = "twcn-admin";
          pname = "twcn-admin";
          title = "TeeworldsCN Admin";
          description = "TeeworldsCN 管理系统";
          inherit system;
          version = "1.0.0";
        };
      });

      # NixOS module for system-wide configuration
      nixosModules.default = { config, lib, pkgs, ... }:
        with lib;
        let
          cfg = config.programs.twcn-admin;
        in
        {
          options.programs.twcn-admin = {
            enable = mkEnableOption "TeeworldsCN Admin application";

            package = mkOption {
              type = types.package;
              default = self.packages.${pkgs.system}.default;
              description = "The TeeworldsCN Admin package to use";
            };

            autoStart = mkOption {
              type = types.bool;
              default = false;
              description = "Whether to automatically start TeeworldsCN Admin on user login";
            };

            users = mkOption {
              type = types.listOf types.str;
              default = [ ];
              description = "List of users for whom to enable auto-start";
              example = [ "alice" "bob" ];
            };
          };

          config = mkIf cfg.enable {
            environment.systemPackages = [ cfg.package ];

            # Create systemd user service for auto-start
            systemd.user.services.twcn-admin = mkIf (cfg.autoStart && cfg.users != [ ]) {
              description = "TeeworldsCN Admin";
              wantedBy = [ "graphical-session.target" ];
              after = [ "graphical-session.target" ];
              serviceConfig = {
                Type = "simple";
                ExecStart = "${cfg.package}/bin/twcn-admin";
              };
            };
          };
        };

      # Home Manager module for per-user configuration
      homeManagerModules.default = { config, lib, pkgs, ... }:
        with lib;
        let
          cfg = config.programs.twcn-admin;
        in
        {
          options.programs.twcn-admin = {
            enable = mkEnableOption "TeeworldsCN Admin application";

            package = mkOption {
              type = types.package;
              default = self.packages.${pkgs.system}.default;
              description = "The TeeworldsCN Admin package to use";
            };

            autoStart = mkOption {
              type = types.bool;
              default = false;
              description = "Whether to automatically start TeeworldsCN Admin on login";
            };
          };

          config = mkIf cfg.enable {
            home.packages = [ cfg.package ];

            # Create systemd user service for auto-start
            systemd.user.services.twcn-admin = mkIf cfg.autoStart {
              Unit = {
                Description = "TeeworldsCN Admin";
                After = [ "graphical-session.target" ];
              };
              Service = {
                Type = "simple";
                ExecStart = "${cfg.package}/bin/twcn-admin";
                Restart = "no";
              };
              Install = {
                WantedBy = [ "graphical-session.target" ];
              };
            };
          };
        };

      # Development shell for building the application
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs
              nwjs
              imagemagick
            ];

            shellHook = ''
              echo "TeeworldsCN Admin Development Environment"
              echo "Available commands:"
              echo "  npm run build        - Build for production"
              echo "  npm run build:dev    - Build for development"
              echo "  npm run run:dev      - Run in development mode"
              echo "  nix build            - Build with Nix"
            '';
          };
        }
      );
    };
}
