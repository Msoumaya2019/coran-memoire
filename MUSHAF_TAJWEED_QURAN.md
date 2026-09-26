# Moushaf Tajweed de l’application Quran

## Source et composition

Les 604 PNG sont reproduits octet pour octet depuis le paquet utilisé par Quran pour iOS :
https://files.quran.app/hafs/tajweed/zips/images_1280.zip

Empreinte SHA-256 de l’archive : `3b4e87837ea961102c77a670a913e68e24a2b7bd9fd1ef0aa320ee17c569c40a`.
Les empreintes individuelles sont dans `src/data/mushaf-tajweed-hashes.json`.
Le nom historique du paquet est « 1280 », mais les PNG complets mesurent **1340 × 1890**, marges comprises. Le lecteur utilise les dimensions réelles.

Cette édition Tajweed est attribuée à Dar Al Maarifah. Elle est distincte des anciennes images EasyQuran et du rendu QCF V4 supprimé. L’autorisation de redistribution de l’édition Dar Al Maarifah déclarée par le propriétaire est documentée dans `TAJWEED_PAGE_SOURCE.md`. Le code du moteur Quran pour iOS n’est pas copié dans l’application.

Les marqueurs, bandeaux de sourates, Basmala, lettres et couleurs sont déjà dans les images. Aucun texte ni signe n’est recomposé ou recolorié. Les images sont incluses dans les builds pour fonctionner hors ligne ; leur poids total est d’environ 140 Mo avant compression des builds.

## Suivi audio et interactions

Les zones viennent de `databases/ayahinfo_1280.db` inclus dans **ce même paquet**, regroupées par sourate, verset et ligne. Le lecteur ne réutilise pas les coordonnées du Moushaf noir. Les limites des 604 pages ont été comparées avec les données Hafs existantes : aucun verset manquant ou ajouté.

L’audio conserve ses identifiants coraniques, son lecteur, ses récitateurs et ses répétitions. Un fond transparent sur les zones du verset actif laisse les couleurs Tajweed visibles. L’appui long utilise également les coordonnées propres à cette édition.

Le plein écran ajuste le ratio de l’édition sélectionnée aux dimensions mesurées du conteneur. Changer de page ou de mode ne réutilise pas le ratio de l’autre édition.

## Accès

- Lecteur : bouton Médine / Tajweed / Simplifiée → **Moushaf Tajweed**.
- Réglages → Affichage du Coran → **Moushaf Tajweed**.
- Toucher le titre **Le Coran** et la sourate ouvre une liste locale des 114 sourates. Le choix ouvre la sourate et réinitialise le passage audio sans modifier les apprentissages ou révisions.

## Vérifications

Les tests vérifient l’intégrité de chaque PNG, tous les versets et leurs coordonnées sur les 604 pages, le ciblage des zones et les ratios sur plusieurs tailles d’écran après vingt changements de page. Les tests audio existants vérifient les répétitions. Les essais de gestes et de lecture effective sur téléphones physiques restent distincts de ces contrôles automatiques.
