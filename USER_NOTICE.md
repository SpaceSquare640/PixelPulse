# User Notice

繁體中文版：[USER_NOTICE.zh-TW.md](USER_NOTICE.zh-TW.md)

Practical things worth knowing before you start using PixelPulse — this is
not a legal document; see [DISCLAIMER.md](DISCLAIMER.md) and the in-app Terms
of Service / Privacy Policy for that.

## What PixelPulse actually does

It watches a region of your screen for an image or pixel colour you
configured, and — when it finds a match — simulates a mouse click, a key
press, typed text, or a multi-step macro. Everything runs locally on your own
computer; nothing is uploaded anywhere.

## Before you trust a new rule

- **Start with Dry Run on** — it's the default for new rules. It logs
  matches without actually clicking or typing, so you can confirm detection
  is working before letting it act.
- Use **Test Match** in the rule editor to check a trigger fires correctly
  against the current screen.
- Crop template images tightly around just the target — a wider crop is more
  likely to false-match on similar-looking elements elsewhere.

## Safety features you should know about

- **Cooldown** — minimum time between triggers for the same rule, so one
  match doesn't fire the action repeatedly.
- **Max triggers** — an optional cap on how many times a rule is allowed to
  fire in one run.
- **Kill switch** — press `Ctrl+Alt+Q` at any time to stop the engine
  immediately, from anywhere, even if the GUI window doesn't have focus.

## Things that can break detection

- Changing screen resolution, display scaling (DPI), or moving/resizing the
  target window after a rule was created.
- The target application changing its UI (a new icon, a moved button, a
  theme update).
- Overlapping windows covering the region PixelPulse is watching.

If a rule stops matching, re-pick the region/point rather than assuming
something is broken.

## Where your data lives

Rules are stored in `rules.json` and captured template images in `targets/`,
both on your own disk, next to wherever you're running PixelPulse from. See
the in-app Privacy Policy tab for the full picture.

## Getting more help

The in-app **Help** panel (the **?** button) has a full User Manual, Terms of
Service, Privacy Policy, this notice, and the Disclaimer — each switchable
between English and 繁體中文. For anything else, open an issue on
[GitHub](https://github.com/SpaceSquare640/PixelPulse).
