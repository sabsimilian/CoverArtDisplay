# Raspberry Pi kiosk setup

Turns a Pi and a screen into a dedicated, always-on cover art display: it boots
straight into the app fullscreen, in portrait if you like, with no desktop
environment, and reopens the app if it ever exits. No mouse or keyboard needs to
stay attached.

This uses the prebuilt `*_arm64.deb` from the Releases page. There's nothing to
compile. To build from source instead, see [BUILD_RASPBERRY_PI.md](BUILD_RASPBERRY_PI.md).

**Tested on:** Pi Zero 2 W (512 MB) · Debian 13 "trixie" Lite, arm64 · app v0.1.0 ·
Waveshare Zero-DISP-7A 7" 1024×600 screen, in portrait. With the Fit style and
the Cover Image background both on (so the blur effects are running), about
200 MB of RAM stays free.

## 1. Install

Start from **Raspberry Pi OS Lite (64-bit)**. You don't need a desktop, and
leaving it out saves a lot of RAM.

```bash
curl -fLO https://github.com/sabsimilian/CoverArtDisplay/releases/download/v0.1.0/Spotify.Cover.Art_0.1.0_arm64.deb
sudo apt update
sudo apt install -y cage wlr-randr ./Spotify.Cover.Art_0.1.0_arm64.deb
```

[`cage`](https://github.com/cage-kiosk/cage) is a tiny Wayland compositor that
runs a single app fullscreen. `wlr-randr` sets resolution and rotation under it.

> apt may print `Download is performed unsandboxed as root ... couldn't be
> accessed by user '_apt'`. That's harmless. It only means the `.deb` is in
> your home directory.

## 2. Log in to the console automatically

```bash
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf >/dev/null <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $USER --noclear %I \$TERM
EOF
```

## 3. Start the kiosk on login

Create `~/kiosk.sh`:

```sh
#!/bin/sh
# Runs the app fullscreen under cage; reopens it if it exits.
export WEBKIT_DISABLE_DMABUF_RENDERER=1
while true; do
  cage -d -- sh -c "wlr-randr --output HDMI-A-1 --mode 1024x600 --transform 90; exec spotify-cover-art-v2"
  sleep 3
done
```

Set `--mode` and `--transform` for your screen (see [step 4](#4-resolution-and-rotation)).
Drop `--transform 90` to stay in landscape.

Then run `chmod +x ~/kiosk.sh` and add this to the end of `~/.bash_profile`.
It only starts on the physical console, never over SSH:

```sh
if [ -z "$WAYLAND_DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec "$HOME/kiosk.sh"
fi
```

Reboot, and the app should come up fullscreen.

## 4. Resolution and rotation

From an SSH session, you can inspect and change the live display:

```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u) WAYLAND_DISPLAY=wayland-0
wlr-randr                                   # outputs, modes, current transform
wlr-randr --output HDMI-A-1 --transform 90  # portrait; use 270 if it's upside down
```

**Use the panel's real native resolution.** Anything else gets rescaled by the
screen, which blurs the picture and can stretch it differently along each
axis. Don't trust the mode list blindly: small HDMI screens and adapter boards
often carry a copied EDID. The Waveshare board above reports itself as a
*Lenovo L1950wD 19"* and offers 1440×900. That mode "works", but the board
squeezes it onto its 1024×600 panel and everything looks stretched. Check the
panel's datasheet, or measure (see [step 5](#5-fixing-a-stretched-picture-non-square-pixels)).

## 5. Fixing a stretched picture (non-square pixels)

Some small panels don't have square pixels, so album art (always square)
comes out slightly rectangular even at the native resolution. If the screen
has its own scaler, which most HDMI boards do, you can correct for this by
sending a custom mode with extra pixels along the axis that looks too long.
The screen squeezes them back in.

1. Turn on **Style: Fit** so the whole cover is visible, then measure the
   cover art on the screen with a ruler, as precisely as you can. A bigger
   picture gives a more accurate result.
2. Find the axis that measures **too long**, and the panel's native pixel
   count along it. In portrait with `--transform 90`, the screen's vertical
   axis is the panel's *first* mode number: the 1024 in 1024×600.
3. New pixel count = native × (long measurement ÷ short measurement). Round it
   to the nearest whole number.
4. Try it live, then put it in `kiosk.sh` in place of `--mode ...`:
   ```bash
   wlr-randr --output HDMI-A-1 --custom-mode 1076x600@60Hz --transform 90
   ```
   If the screen goes blank or shows "out of range", run the `--mode` command
   again to go back.

Worked example (the Waveshare Zero-DISP-7A in portrait): a square measured
79.5 mm wide × 83.5 mm tall. 1024 × 83.5 / 79.5 ≈ 1076, so the custom mode is
`1076x600`. Afterwards it measured 79.5 × 79.5 mm.

## 6. Settings that suit a portrait screen

- **Style: Fit.** The default fills the whole area and crops the cover. In
  portrait, that means cutting off its sides. Fit shows the whole square
  cover over a blurred copy of it.
- **Background: Cover Image.** Uses a blurred copy of the cover behind the
  track text.
- **Idle mode: Library Covers**, unless you've added videos for Video Art.
  Without them, the idle screen only shows "No videos available".
- **Font:** on a Lite image, "System Default" comes out as DejaVu Sans. To
  match the screenshots, put Roboto on the Pi, then pick **Roboto** in
  settings. For example, for your user only:
  ```bash
  mkdir -p ~/.local/share/fonts
  curl -fL -o ~/.local/share/fonts/Roboto.ttf "https://github.com/google/fonts/raw/main/ofl/roboto/Roboto%5Bwdth,wght%5D.ttf"
  fc-cache -f
  ```

## 7. Pi Zero 2 W: turn off Wi-Fi power saving

Wi-Fi power saving is on by default and causes intermittent dropouts on the
Zero 2 W, which can leave the display stuck on an old track. With NetworkManager
(the default on current Raspberry Pi OS):

```bash
printf '[connection]\nwifi.powersave = 2\n' | sudo tee /etc/NetworkManager/conf.d/wifi-powersave-off.conf
sudo systemctl restart NetworkManager
```

## Troubleshooting

- **Screen shows a `login:` prompt:** autologin isn't active. Check that
  `/etc/systemd/system/getty@tty1.service.d/autologin.conf` exists and isn't
  empty.
- **Black screen, no app:** check `pgrep -a cage` over SSH, and `free -m` for
  memory pressure.
- **Restart just the app:** `kill $(pidof spotify-cover-art-v2)`. `kiosk.sh`
  reopens it.
