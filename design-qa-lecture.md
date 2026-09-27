# Vérification visuelle — Lecture et audio compact

Référence : captures utilisateur 1, Z, 3, 4, 5, inspectées avant les modifications.

Vérifié sur composants React Native réels compilés pour le navigateur, largeurs 320, 393 et 430 px, hauteur 720 px.

- Header compact, informations dynamiques, page centrée et ratio conservé.
- Page inchangée lorsque le panneau audio apparaît ; superposition au-dessus de la barre.
- Panneau de base environ 185 px dans la zone de lecture mesurée, inférieur à un tiers ; avancé plus haut et défilable.
- Les deux lignes de sélecteurs restent lisibles après correction du flexShrink en mode avancé. Défilement horizontal sur petit écran pour accéder à tous les boutons.
- Marque-page sauvegardé sur Al Baqarah 3, toutes les zones du verset surlignées, carte avec aperçu arabe et reprise testée.
- Coordonnées corrigées avec measureInWindow : ne dépendent plus de la cible enfant de l’événement tactile.
- Séance sur 320 px : titre peut occuper deux lignes, aucune action perdue ; espace maximal selon le ratio de page.

Captures : work-dist/design/bookmarks.png, reading-compact-audio.png, learning-compact-320.png.

Limites : aperçu web, pas de validation matérielle des safe areas ni de l’audio. Tests physiques détaillés dans LECTURE_MARQUES_PAGES.md.
