# Changelog

All notable changes to BagIdea Office. A **release** is a deliberate `VERSION`
bump on `main` (see [RELEASING.md](RELEASING.md)) — that's what triggers the
in-app 🔄 update banner. Versions follow [semver](https://semver.org).

## [0.6.4] — Director's desk + Thai in the Security Center

- **Fixed — agents stopped stealing the Director's desk.** Freed desks were
  recycled into the shared Ops pool *including the Director's private
  workstation* (`lead_desk`). Since the host session (main) finishes work
  constantly, that desk kept re-entering the pool and other agents would sit at
  it. The Director's desk is now excluded from the pool, so staff reliably use
  the shared Ops desks and only the Director uses the Exec workstation.
- **Fixed — Thai (and other non-ASCII) text rendered as mojibake** in the
  Windows permission card. The `PreToolUse` hook now reads stdin and POSTs its
  body as UTF-8 end-to-end, and the daemon decodes request bodies as UTF-8 in a
  single pass (so multibyte characters that straddle a TCP chunk survive too).

## [0.6.3] — Right Ctrl push-to-talk

- **Changed — Right Ctrl is the default push-to-talk hotkey.** It's rarely typed,
  which makes it ideal for hold-to-talk without clashing with normal typing.

## [0.6.2] — Smooth wallpaper

- **Fixed — wallpaper stutter / idle GPU.** A mis-firing occlusion throttle was
  pinning the renderer at ~2 fps; it's disabled until it can be made reliable.

## [0.6.1] — macOS install & CLI fixes

- **Fixed — macOS installer and path execution** issues (#2, #3) and a stray
  token that broke the `bagidea` CLI on every platform (PR #4 follow-up).
- Groundwork for auto-throttling the wallpaper when it's fully covered.

## [0.6.0] — Usability, office life & cost visibility

- Multiline chat and note inputs; notes can be opened and edited in place.
- More playful ambient life and clearer hotkey discoverability.
- Cost visibility: estimated Claude / Gemini / OpenAI spend surfaced in stats.

## [0.5.0] — First macOS support (beta)

- **First macOS build (beta)** alongside Windows.
- Full internationalization across 14 languages with resilient seed loading and
  atomic i18n cache writes.
- Daemon watchdog so the office never sits brainless after a crash.
- Localized wallpaper agent status plates to match the chosen language.

## [0.4.0] — Translations, sponsors & voices

- Ship UI translations (14 languages).
- Sponsors section (WARRIX as Gold Partner).
- More agent voices and an orb watchdog.

## [0.3.1] — Uninstall & story

- `bagidea uninstall` command.
- Sharpened the product story across README and the website.

## [0.3.0] — Art in the box

- Bundle the free / CC0 art packs (characters, 3D models, sounds) directly in
  the repo, so a fresh install and `bagidea update` carry the full look out of
  the box.

---

*Earlier history predates this changelog — see `git log` for the full record.*

[0.6.4]: https://github.com/bagidea/bagidea-office/releases/tag/v0.6.4
[0.6.3]: https://github.com/bagidea/bagidea-office/releases/tag/v0.6.3
[0.6.2]: https://github.com/bagidea/bagidea-office/releases/tag/v0.6.2
[0.6.1]: https://github.com/bagidea/bagidea-office/releases/tag/v0.6.1
[0.6.0]: https://github.com/bagidea/bagidea-office/releases/tag/v0.6.0
[0.5.0]: https://github.com/bagidea/bagidea-office/releases/tag/v0.5.0
[0.4.0]: https://github.com/bagidea/bagidea-office/releases/tag/v0.4.0
[0.3.1]: https://github.com/bagidea/bagidea-office/releases/tag/v0.3.1
[0.3.0]: https://github.com/bagidea/bagidea-office/releases/tag/v0.3.0
