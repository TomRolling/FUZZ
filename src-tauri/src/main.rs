// Point d'entrée natif de Jardin Idle.
// Aucune logique métier ici : tout le jeu vit dans dist/index.html (HTML/CSS/JS),
// Tauri se contente d'ouvrir une fenêtre native qui charge ce fichier.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Jardin Idle");
}
