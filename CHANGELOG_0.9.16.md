# Version 0.9.16 — interface et séance de lecture

- Refonte des cinq écrans principaux en réutilisant leurs données et actions.
- Séance du jour : en-tête compact, page ajustée au conteneur mesuré, quatre actions et panneaux à la demande.
- Validation, report, traduction, audio, répétitions et enregistrements existants conservés.
- Retrait des cinq récitateurs signalés comme non fonctionnels : Saad Al-Ghamdi, Nasser Al-Qatami, Salah Al-Budair, Salah Boukhatir et Yassir Al-Doussari. Une préférence ancienne revient à Al-Husary.
- Bibliothèque MaterialCommunityIcons et copie du code d’invitation via Expo Clipboard.
- Métadonnée mecquoise/médinoise issue de quran-meta, sans modification du texte coranique.

## Vérifications
TypeScript sans erreur, 56 tests réussis, export Expo/Hermes iOS et Android réussi. Contrôles visuels de la séance à 320/393/430 pixels et vingt changements de page. Les services de l’aperçu sont simulés : les tests sur téléphones réels restent nécessaires pour le microphone, l’audio audible et les safe areas physiques.

## Déploiement
Version Expo 0.9.16, build iOS 28, versionCode Android 28. Aucun changement Supabase ni de credentials Apple/Firebase.
