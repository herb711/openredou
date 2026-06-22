# Tauri Icons

Here's the process I've been using to create icons:

- Save source image as `app-icon.png` in `packages/desktop`
- `cd` to `packages/desktop`
- Run `bun tauri icon -o src-tauri/icons/{environment}`
- Generate `icon.icns` from transparent PNG frames and place it in the appropriate icons folder

Avoid icon generator presets that add a macOS Big Sur-style rounded square background. Those presets flatten the alpha channel and
reintroduce a white tile around the app mark in Finder, DMG installer windows, and the macOS title bar.

For unpackaged Electron on macOS, `app.dock.setIcon()` should use a PNG. Keep `dock.png` in each channel folder synced with the
extracted `icon_128x128@2x.png` from that channel's `icon.icns` so the dev Dock icon matches the packaged app inset.
