# Migration note — Windowed mode (`BAGIDEA_WINDOW=1`)

> Hand-off note for whoever ports this feature into the other project copy.
> Goal: run the Godot world as a **normal framed, movable window** (1280×800,
> centred) while still keeping the shell's floating **chat head + tray** — instead
> of the borderless desktop-embed wallpaper. Opt-in via env var; original
> behaviour and the Windows path stay 100% unchanged.

## Trigger / contract

- New env var: **`BAGIDEA_WINDOW=1`** (read by the **shell**, macOS only).
- When set, the shell passes the Godot user arg **`--windowed`** instead of
  `--wallpaper`, and **skips the DYLD wallpaper shim** entirely.
- Godot branches on `--windowed` for window placement, but shares the perf rung
  and the `bagidea_world_ready` flag with `--wallpaper`.

## Files changed

### 1. `shell/src/main.rs` — `platform::office_args()` (macOS `#[cfg(target_os = "macos")]`)

Added an early opt-in branch at the top of the function:

```rust
if std::env::var("BAGIDEA_WINDOW").as_deref() == Ok("1") {
    c.args(["--path"]).arg(root.join("godot")).args(["--", "--windowed"]);
    // No DYLD shim: no desktop-level attach in window mode.
    return;
}
// ...original --wallpaper + DYLD_INSERT_LIBRARIES shim path unchanged below...
```

- Original path (no env / env != "1") is byte-for-byte the old behaviour.
- Windows `office_args` was **not touched** (WorkerW path unchanged).

### 2. `godot/scripts/office_floor.gd`

**(2a) Perf rung** (in `_ready()`): was gated on `"--wallpaper"` only; now runs for
**both** `--wallpaper` and `--windowed` (M2 8GB target wants the light render in
window mode too). Sets `Engine.max_fps = 30`, MSAA 2x, disables ssao / volumetric
fog, shadow atlas 4096, DOF off.

```gdscript
var _args := OS.get_cmdline_user_args()
if ("--wallpaper" in _args) or ("--windowed" in _args):
    ...
```

**(2b) `_opaque_after_first_frame()`** — the borderless/fullscreen attach was
`--wallpaper`-only; added an `elif "--windowed"` branch that makes a normal framed
window (mirrors the tail of `_enter_editor_mode()`):

```gdscript
elif "--windowed" in args:
    DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
    DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_BORDERLESS, false)
    var win := Vector2i(1280, 800)
    DisplayServer.window_set_size(win)
    var scr := DisplayServer.window_get_current_screen()
    var sp := DisplayServer.screen_get_position(scr)
    var ss := DisplayServer.screen_get_size(scr)
    DisplayServer.window_set_position(sp + (ss - win) / 2)
    get_window().grab_focus()
    DisplayServer.window_move_to_foreground()
    DisplayServer.window_set_title("BagIdea Office")
    get_tree().create_timer(0.8).timeout.connect(func():
        DisplayServer.window_set_title("BagIdea Office"))
```

- The `--wallpaper` borderless block is unchanged.
- The **`bagidea_world_ready` flag write at the end runs in every mode** (shell
  waits on it to drop the splash) — do not gate it behind a mode check.

## Gotchas when migrating

- Keep the `world_ready` flag write outside the mode branches.
- Don't add the env check to the Windows `office_args` — desktop embed there is
  WorkerW, a different mechanism; leave it alone.
- The perf rung and the window-placement live in two different functions
  (`_ready()` vs `_opaque_after_first_frame()`) — touching the window mid-load
  repaints the boot splash on black, which is why placement waits for the first
  `frame_post_draw`.

## How to test

```sh
cd shell && cargo build --release
BAGIDEA_WINDOW=1 ./shell/target/release/bagidea-office-shell
```

Expect: Godot opens as a bordered 1280×800 window centred on screen, plus the
floating chat head and the tray icon. Running without `BAGIDEA_WINDOW` gives the
original borderless desktop wallpaper.
