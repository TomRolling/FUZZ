// Point d'entrée natif de Jardin Idle.
// Aucune logique métier ici : tout le jeu vit dans dist/index.html (HTML/CSS/JS),
// Tauri se contente d'ouvrir une fenêtre native qui charge ce fichier.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Jardin Idle");
}
