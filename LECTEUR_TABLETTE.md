# Lecteur du Coran et annotations — 18 novembre 2026

Projet Expo repris depuis le code local de `Msoumaya2019/coran-memoire`, révision `f538ae3`. Cette mise à jour ajoute les annotations et l’affichage tablette au projet Expo. Aucun nouvel APK/IPA compilé pour cette révision.

## Changements

- « Coran de Médine » retiré des réglages et du sélecteur du lecteur. Les comptes qui utilisaient cette édition passent au Coran avec règles de Tajwid, sans effacer leurs connaissances, marques-pages ou historique. Les anciennes données restent compatibles.
- Coran avec règles de Tajwid conservé par défaut pour les nouvelles installations.
- « Coran 1441 » renommé « Coran » dans les écrans. Son identifiant interne reste inchangé pour conserver les téléchargements et les marques-pages.
- Transition de page avec une feuille qui pivote autour de la reliure et une ombre. La transition du tajwid attend que la nouvelle page soit prête. Le réglage système de réduction des animations est respecté.
- Bouton « Annoter · tablette et stylet » dans les éditions paginées. Les outils permettent de surligner, entourer, écrire à main levée et placer une note au clavier sur la page, avec quatre couleurs.
- Sur grand écran (900 pixels et plus), les outils occupent un panneau latéral. En portrait et sur téléphone, ils passent sous la page. Les coordonnées sont proportionnelles à la page : les repères suivent la rotation et les changements de taille.
- Les annotations sont visibles dans l’atelier d’annotation. Le mode lecture habituel conserve ses gestes de zoom et de navigation. Le dessin bloque ces gestes pour éviter de tourner une page accidentellement. La lecture simplifiée par versets conserve son interface existante.
- Sauvegarde des annotations par page et par édition dans l’état du compte existant ; fusion des modifications entre appareils, conservation des suppressions et isolation des comptes.

## Utilisation

Ouvrir le Coran, puis « Annoter · tablette et stylet ». Choisir un outil et une couleur, puis tracer directement sur le mot ou le passage souhaité. Pour entourer, tracer la diagonale du cadre entourant le mot ou le verset. Pour une note au clavier, choisir « Note clavier », toucher son emplacement, saisir le texte et appuyer sur « Enregistrer ». Les tracés sont enregistrés automatiquement. La liste permet de modifier une note ou de supprimer un repère.

## Vérifications

- Vérification TypeScript : aucune erreur.
- 216 tests automatisés réussis, aucun échec ou test ignoré. Les nouveaux tests couvrent la migration de Médine, les coordonnées après rotation, la séparation des éditions et pages, les suppressions et la fusion hors ligne des annotations.
- Aperçu des composants réels dans le navigateur : surlignage, entourage, note au clavier, changement de page et retour aux annotations, adaptation en portrait de 393 pixels.
- Aperçu web compilé avec les services réseau simulés ; aucun message ni donnée de test envoyé au serveur.

Le tracé avec un vrai Apple Pencil ou un stylet Android, le clavier mobile, l’animation dans une WebView native et la synchronisation avec deux appareils physiques restent à valider sur appareil. La pression du stylet et la reconnaissance de l’écriture manuscrite ne sont pas implémentées.

Pour lancer le projet : installer les dépendances du `package.json`, puis utiliser les commandes existantes `npm start`, `npm run typecheck` et `npm test`.
