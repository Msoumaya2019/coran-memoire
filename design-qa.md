# Coran Test — vérification du 28 septembre 2026

- Page 10 comparée à la référence : mêmes glyphes QPC V4, lignes, mots, couleurs et numéros de versets issus de l’IPA.
- Plein écran sans header, boutons, cadre ni lecteur visible.
- Swipe RTL dans les deux sens : 10 → 11 → 10.
- Pages 1 et 604 contrôlées ; titres décoratifs et basmala originaux conservés.
- Formats navigateur contrôlés : 320×568, 393×852, 430×932 et 360×800. Page entière avec ratio conservé, sans débordement.
- Overlay invisible ; positions normalisées mesurées par mot, regroupées par verset et ligne.
- TypeScript : réussi. Tests : 122 réussis.
- Les essais navigateur ne remplacent pas une validation sur iPhone et Android physiques : ces essais restent à réaliser.

Capture : work-dist/coran-test-page10.png (artefact local non versionné).

## Lecteur commun — version 0.9.25

- Toutes les sources utilisent le même en-tête compact et les trois actions flottantes.
- Coran Tajweed contrôlé sur 320×568 : commandes lisibles, menu, plein écran ; Médine sur 430×932.
- Coran Test : traduction réelle, sélection de 2:66, deux zones de surlignage et un indicateur de marque-page, reprise page 10, lecteur audio partagé et changement de source.
- TypeScript et 125 tests réussis, également dans le job iOS GitHub.
- Aucun test audio/microphone physique n’est revendiqué ; appareils iPhone et Android à vérifier.
- Captures de l’aperçu conservées localement dans work-dist ; certains captures du navigateur subissent une réduction liée à sa mise à l’échelle.
