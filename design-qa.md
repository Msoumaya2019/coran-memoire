# Vérification visuelle — Révisions — 28 septembre 2026

final result: passed

## Références et périmètre
- Maquette des quatre vues « Mes révisions » (01_56_56).
- Maquette de la barre unique de révision (01_58_43).
- Comparaisons côte à côte enregistrées dans `work-dist/revision-comparison.png` et `work-dist/revision-dashboard-comparison.png`.
- Composants réels de l’application rendus avec React Native Web. Données de démonstration isolées, services cloud et microphone simulés. Ceci valide la présentation et les raccordements UI, pas la lecture/prise de son sur appareil physique.

## Vérifications observées
- Une rangée unique : Parfait / Quelques hésitations / À retravailler | Écouter / Ma voix.
- Séparateur discret entre les trois retours et les deux actions audio ; thème existant appliqué.
- À 320 × 568, chaque action mesure environ 54 × 64 pixels CSS, sans débordement ; même alignement à 393 × 852 et 430 × 932.
- Les anciens gros blocs permanents ont disparu ; le Moushaf utilise l’espace restant et conserve le ratio de son image originale.
- Header compact dynamique, page indiquée, flèches de navigation, plein écran : conservés.
- Ma voix ouvre seulement à la demande le panneau utilisant RecitationRecorder ; Écouter ouvre PassageAudioPlayer avec le passage concerné.
- Plein écran : header et barre masqués ; bouton de sortie et accès audio discrets conservés.
- Parcours observé : Commencer → Al Mulk 1–5 (consolidation) → Parfait → Ar Rûm 15 (priorité) → À retravailler → Al Fâtiha 1–7 (cycle).
- Le sélecteur intégré 7/14/21/30 jours a été ouvert ; choisir 30 jours a recalculé le rythme affiché et la quantité du jour. Il évite une alerte native à cinq boutons, incompatible avec la limite Android.
- Dashboard : carte quotidienne en premier, cycle, consolidations et timeline, priorités, suivi en dernier.
- Palette lilas et palette Nuit existante vérifiées. Le thème « Nuit » actuel utilise déjà des fonds clairs avec des accents marine ; aucun véritable thème sombre nouveau n’est ajouté.

## Écarts intentionnels / limites
- La maquette indique Ar Rûm 15 tout en colorant les versets 7–8. Le lecteur conserve le vrai mapping et la sélection du verset 15.
- Le rapport largeur/hauteur de l’image réelle est conservé : les espaces de centrage dépendent de la page et du téléphone. Aucun étirement pour copier la maquette.
- Le numéro de page reste dans le sous-titre compact du lecteur partagé, pour libérer de la hauteur.
- Les valeurs et le thème sont ceux de l’application, sans recopier les chiffres fictifs de la maquette.
- Safe areas : conteneur natif existant conservé. Validation physique iPhone/Android (microphone, audio, encoche, geste natif, taille de police système) à effectuer dans la compilation mobile.

Aucun défaut P0/P1/P2 constaté dans les états UI inspectés. Les limites physiques ci-dessus restent hors de cette validation visuelle navigateur.
