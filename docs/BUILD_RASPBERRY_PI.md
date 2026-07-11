# Building on Raspberry Pi

WebKitGTK/GTK native bindings make cross-compiling for ARM Linux from another
machine unreliable — building directly on the Pi is the most reliable path.

## Prerequisites

- **64-bit Raspberry Pi OS** (Bookworm or newer), on a Pi 3/4/5. 32-bit is not
  recommended — Tauri/WebKitGTK support is far better on aarch64.
- At least 2GB RAM. If your Pi has less (or you're on a Pi Zero 2 W), add
  swap first or the Rust compile will likely OOM:
  ```bash
  sudo dphys-swapfile swapoff
  sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
  sudo dphys-swapfile setup
  sudo dphys-swapfile swapon
  ```

## 1. System dependencies

```bash
sudo apt update
sudo apt install -y build-essential curl wget file \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf \
  gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav
```

## 2. Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

## 3. Node.js (20+)

Raspberry Pi OS's apt repo often ships an outdated Node version — use
NodeSource instead:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 4. Clone and build

```bash
git clone https://github.com/sabsimilian/CoverArtDisplay.git
cd CoverArtDisplay
npm ci
npm run tauri build
```

The `.deb` and the raw binary land in `src-tauri/target/release/bundle/`.

## Notes

- **This will be slow.** A full Rust release build (Tauri + all its deps)
  on a Pi 4 is commonly 30–60+ minutes, vs. ~1.5 minutes on a desktop x86_64
  machine — this is normal, not a hang.
- **Performance after building is the bigger unknown, not the build itself.**
  This app leans on `backdrop-filter: blur()` in a few places (the playback
  controls hover overlay, the cover-image background blur) and CSS
  transitions/crossfades throughout. WebKitGTK's compositor on Pi hardware
  may not handle those as smoothly as a desktop GPU — worth testing on the
  actual target Pi model before assuming it's release-ready, independent of
  whether the build itself succeeds.
- If `cargo build` gets killed with no clear error, it's almost always the
  OOM killer — check `dmesg | tail` and add/increase swap (see above).
