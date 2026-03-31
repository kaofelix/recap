mod commands;
mod git;

use tauri::image::Image;
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

const CHECK_FOR_UPDATES_MENU_ID: &str = "check_for_updates";
const CHECK_FOR_UPDATES_EVENT: &str = "menu://check-for-updates";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let check_for_updates =
                MenuItemBuilder::with_id(CHECK_FOR_UPDATES_MENU_ID, "Check for Updates…")
                    .build(app)?;

            let app_submenu = SubmenuBuilder::new(app, "Recap")
                .about(Some(AboutMetadata {
                    icon: Image::from_bytes(include_bytes!("../icons/icon.png")).ok(),
                    ..Default::default()
                }))
                .separator()
                .item(&check_for_updates)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .copy()
                .paste()
                .cut()
                .separator()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .build()?;
            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app_handle, event| {
            if event.id().as_ref() == CHECK_FOR_UPDATES_MENU_ID {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.emit(CHECK_FOR_UPDATES_EVENT, ());
                }
            }
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::errors::report_frontend_error,
            commands::git::list_commits,
            commands::git::list_authors,
            commands::git::get_commit_files,
            commands::git::get_commit_range_files,
            commands::git::get_file_diff,
            commands::git::get_file_contents,
            commands::git::get_commit_range_file_contents,
            commands::git::get_current_branch,
            commands::git::list_branches,
            commands::git::checkout_branch,
            commands::git::validate_repo,
            commands::git::get_working_changes,
            commands::git::get_working_file_diff,
            commands::git::get_working_file_contents,
            commands::git::get_working_changes_ex,
            commands::git::get_staged_file_diff,
            commands::git::get_unstaged_file_diff,
            commands::git::get_staged_file_contents,
            commands::git::get_unstaged_file_contents,
            commands::git::stage_file,
            commands::git::stage_all,
            commands::git::unstage_file,
            commands::git::unstage_all,
            commands::git::discard_file,
            commands::git::create_commit,
            commands::git::get_remote_url,
            commands::git::get_ahead_behind,
            commands::git::get_commit_message,
            commands::git::reword_commit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
