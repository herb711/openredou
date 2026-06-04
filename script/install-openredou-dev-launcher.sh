#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
launcher_script="$repo_root/script/openredou-dev-linux.sh"
bin_dir="$HOME/.local/bin"
app_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
desktop_dir="${XDG_DESKTOP_DIR:-}"

if [ -z "$desktop_dir" ] && command -v xdg-user-dir >/dev/null 2>&1; then
  desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
fi

desktop_dir="${desktop_dir:-$HOME/Desktop}"

install -d "$bin_dir" "$app_dir"
chmod +x "$launcher_script"

printf '#!/usr/bin/env bash\nexec /usr/bin/env bash %q\n' "$launcher_script" > "$bin_dir/openredou-dev"
chmod +x "$bin_dir/openredou-dev"

cat > "$app_dir/openredou-dev.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=OpenRedou Dev
Comment=Run OpenRedou Desktop from source
Exec=$bin_dir/openredou-dev
Icon=$repo_root/packages/desktop/resources/icons/icon.png
Path=$repo_root
Terminal=true
Categories=Development;
StartupNotify=true
EOF

chmod +x "$app_dir/openredou-dev.desktop"

if [ -d "$desktop_dir" ]; then
  cp "$app_dir/openredou-dev.desktop" "$desktop_dir/OpenRedou Dev.desktop"
  chmod +x "$desktop_dir/OpenRedou Dev.desktop"
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$app_dir" >/dev/null 2>&1 || true
fi

echo "Installed OpenRedou Dev launcher:"
echo "  $app_dir/openredou-dev.desktop"

if [ -d "$desktop_dir" ]; then
  echo "  $desktop_dir/OpenRedou Dev.desktop"
fi
