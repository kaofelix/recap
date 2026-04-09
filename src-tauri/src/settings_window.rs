use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const SETTINGS_WINDOW_LABEL: &str = "settings";
const SETTINGS_WINDOW_TITLE: &str = "Settings";
const SETTINGS_WINDOW_WIDTH: f64 = 400.0;
const SETTINGS_WINDOW_HEIGHT: f64 = 300.0;

/// Open the Settings window, or focus it if it already exists.
pub fn open_or_focus(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window(SETTINGS_WINDOW_LABEL) {
        let _ = window.set_focus();
        return;
    }

    // Create hidden so the webview can render before the window appears,
    // avoiding a white flash. The frontend calls `show()` once mounted.
    let builder = WebviewWindowBuilder::new(
        app_handle,
        SETTINGS_WINDOW_LABEL,
        WebviewUrl::App("settings.html".into()),
    )
    .title(SETTINGS_WINDOW_TITLE)
    .inner_size(SETTINGS_WINDOW_WIDTH, SETTINGS_WINDOW_HEIGHT)
    .visible(false)
    .resizable(false)
    .maximizable(false)
    .minimizable(false);

    if let Err(err) = builder.build() {
        eprintln!("Failed to create settings window: {err}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn constants_are_consistent() {
        assert_eq!(SETTINGS_WINDOW_LABEL, "settings");
        assert_eq!(SETTINGS_WINDOW_TITLE, "Settings");
        assert!(SETTINGS_WINDOW_WIDTH > 0.0);
        assert!(SETTINGS_WINDOW_HEIGHT > 0.0);
    }
}
