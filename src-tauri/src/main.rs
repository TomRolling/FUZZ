// Point d'entrée natif de Fuzz.
// Aucune logique métier ici : tout le jeu vit dans dist/index.html (HTML/CSS/JS),
// Tauri se contente d'ouvrir une fenêtre native qui charge ce fichier.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        // Ouvre une adresse dans le navigateur du système (signalement de bug) : sans lui, un
        // lien externe ne fait rien du tout dans une fenêtre Tauri.
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Fuzz");
}
