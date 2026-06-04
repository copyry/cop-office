#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// BagIdea AI Agents Office — native overlay shell.
// Two always-on-top windows:
//   • the launcher ORB (frameless, transparent, branded) — click toggles the
//     overlay, top grip drags it, right-click quits
//   • the OVERLAY (daemon-served web UI) — closing it only hides it; the orb
//     brings it back. The overlay can never be lost.

use tao::{
    dpi::{LogicalPosition, LogicalSize},
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder},
    platform::windows::WindowBuilderExtWindows,
    window::WindowBuilder,
};
use wry::WebViewBuilder;

#[derive(Debug)]
enum UserEvent {
    Toggle,
    Drag,
    Quit,
}

const ORB_HTML: &str = r#"<!doctype html>
<html><body style="margin:0;overflow:hidden;user-select:none;-webkit-user-select:none;
    background:linear-gradient(160deg,#16233a,#0a111d);height:100vh;display:flex;
    flex-direction:column;box-sizing:border-box;border:1px solid rgba(110,185,255,.5)">
<div id="grip" style="height:11px;cursor:move;display:flex;justify-content:center;align-items:center;flex:none">
  <div style="width:22px;height:3px;border-radius:2px;background:rgba(160,200,255,.45)"></div>
</div>
<div id="orb" style="flex:1;display:flex;align-items:center;justify-content:center;cursor:pointer">
  <img id="lg" src="http://127.0.0.1:8787/brand/logo_box.png" width="40" draggable="false"
       style="filter:drop-shadow(0 0 8px rgba(80,160,255,.7))"
       onerror="this.outerHTML='<span style=&quot;font-size:24px&quot;>🏢</span>'">
</div>
<script>
  document.getElementById('grip').addEventListener('mousedown', function (e) {
    if (e.button === 0) window.ipc.postMessage('drag');
  });
  document.getElementById('orb').addEventListener('click', function () {
    window.ipc.postMessage('toggle');
  });
  document.getElementById('orb').addEventListener('contextmenu', function (e) {
    e.preventDefault();
    window.ipc.postMessage('quit');
  });
</script>
</body></html>"#;

fn main() {
    let event_loop = EventLoopBuilder::<UserEvent>::with_user_event().build();
    let proxy = event_loop.create_proxy();

    // ---- overlay window (web UI from the daemon) — starts hidden: the app
    // runs in the background and the launcher widget summons it.
    let overlay = WindowBuilder::new()
        .with_title("BagIdea Office")
        .with_inner_size(LogicalSize::new(560.0, 700.0))
        .with_position(LogicalPosition::new(1060.0, 96.0))
        .with_always_on_top(true)
        .with_visible(false)
        .build(&event_loop)
        .expect("overlay window");
    let overlay_id = overlay.id();
    let _overlay_view = WebViewBuilder::new()
        .with_url("http://127.0.0.1:8787/")
        .build(&overlay)
        .expect("overlay webview");

    // ---- launcher orb (frameless, transparent, branded)
    let orb = WindowBuilder::new()
        .with_title("BagIdea Orb")
        .with_inner_size(LogicalSize::new(64.0, 72.0))
        .with_position(LogicalPosition::new(1596.0, 14.0))
        .with_decorations(false)
        .with_transparent(true)
        .with_resizable(false)
        .with_always_on_top(true)
        .with_skip_taskbar(true)
        .build(&event_loop)
        .expect("orb window");
    let orb_id = orb.id();
    let ipc_proxy = proxy.clone();
    let _orb_view = WebViewBuilder::new()
        .with_transparent(true)
        .with_background_color((0, 0, 0, 0))
        .with_html(ORB_HTML)
        .with_ipc_handler(move |req| {
            let _ = match req.body().as_str() {
                "toggle" => ipc_proxy.send_event(UserEvent::Toggle),
                "drag" => ipc_proxy.send_event(UserEvent::Drag),
                "quit" => ipc_proxy.send_event(UserEvent::Quit),
                _ => Ok(()),
            };
        })
        .build(&orb)
        .expect("orb webview");

    // Among multiple TOPMOST windows, Windows orders by recency — re-assert
    // the orb whenever the overlay comes forward so it can never be covered.
    let raise_orb = |orb: &tao::window::Window| {
        orb.set_always_on_top(false);
        orb.set_always_on_top(true);
    };

    let mut overlay_visible = false;
    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        match event {
            Event::WindowEvent {
                window_id,
                event: WindowEvent::CloseRequested,
                ..
            } => {
                if window_id == overlay_id {
                    // Closing the overlay only hides it — the orb restores it.
                    overlay.set_visible(false);
                    overlay_visible = false;
                } else if window_id == orb_id {
                    *control_flow = ControlFlow::Exit;
                }
            }
            Event::WindowEvent {
                window_id,
                event: WindowEvent::Focused(true),
                ..
            } => {
                if window_id == overlay_id {
                    raise_orb(&orb);
                }
            }
            Event::UserEvent(ue) => match ue {
                UserEvent::Toggle => {
                    overlay_visible = !overlay_visible;
                    overlay.set_visible(overlay_visible);
                    if overlay_visible {
                        overlay.set_focus();
                        raise_orb(&orb);
                    }
                }
                UserEvent::Drag => {
                    let _ = orb.drag_window();
                }
                UserEvent::Quit => {
                    *control_flow = ControlFlow::Exit;
                }
            },
            _ => {}
        }
    });
}
