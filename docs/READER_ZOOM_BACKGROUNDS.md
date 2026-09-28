# Zoom et fonds du Moushaf — version 0.9.30 (42)

- Pincement de ×1 à ×3 et déplacement de la page agrandie ; double toucher pour agrandir ou revenir à la page entière.
- Les coordonnées de sélection sont transformées avec la page. Le calque des versets reste dans le même repère que la calligraphie.
- Le swipe tourne les pages à taille normale ; en zoom il déplace le texte. La lecture simplifiée agrandit le texte et conserve le défilement vertical.
- Réglages → Affichage du Coran → Fond du Coran avec règles de Tajwid : Ivoire, Rosé, Sable, Sépia.
- `reader.paper` utilise la persistance locale et la synchronisation du compte existantes. Aucun changement de schéma Supabase.
- La couleur est appliquée au papier et au conteneur sans recharger le lecteur ni modifier les glyphes Tajwid.

## Vérifications

TypeScript sans erreur ; 150 tests réussis, incluant pincement, déplacement, double toucher, mapping des versets, swipe et conservation des préférences après migration.
Le double clic a été vérifié sur le vrai rendu HTML dans l’aperçu. La vérification visuelle du panneau Réglages a été interrompue par un blocage du navigateur.
Les gestes natifs, la lisibilité des quatre fonds et les safe areas restent à vérifier sur iPhone et Android réels.

## Essai sur téléphone

1. Choisir chaque fond dans Réglages, ouvrir le Coran avec règles de Tajwid, fermer puis rouvrir l’application pour vérifier la conservation du choix.
2. Pincer, déplacer la page et double toucher pour revenir à la page entière.
3. Tester un marque-page et le suivi audio après zoom : les zones doivent rester alignées.
4. Refaire le test en Lecture, Apprentissage et Révision, puis avec le Coran de Médine et la Lecture simplifiée.

Le moteur audio et les règles de répétition n’ont pas été modifiés.
