# Vérification visuelle — thème blanc et repères en marge

## Références

Maquettes du 3 octobre 2026 à 12:01–12:04 : Accueil, Coran, Juz, Programme, Lecture, Progrès, Amis, Objectif, Apparence. Maquette 12:05:02 : repères dans la marge gauche. Les valeurs illustratives des maquettes sont remplacées par les données réelles ; le total canonique est 6 236 versets.

## Vérifications réalisées

- Aperçu des composants de production dans React Native Web, avec services externes simulés uniquement dans le script de QA.
- Vues 440 × 880 et 375 × 744 de contenu utile. Captures dans `docs/qa/` : accueil, programme, progrès, amis/recherche, apparence, objectif, sourates, Juz, Hizb, validation partielle et lecture.
- Comparaison aux références : fond presque blanc, cartes blanches, titres serif compacts, accent prune, décor de mosquée discret, illustration de lecture, médaillons dorés, cinq onglets exacts. Les anciennes fonctions sociales restent accessibles.
- Accent vert sélectionné : boutons, titres et sélection deviennent verts ; fonds et cartes restent clairs. Le thème rose et les thèmes historiques restent proposés.
- Recherche Amis : saisir Kamel conserve uniquement la carte correspondante. Sélecteurs Juz et Hizb affichent immédiatement les divisions et leurs vrais intervalles de pages.
- Objectif : menus fonctionnels, sélection de verset mise à jour, objectif existant conservé tant qu’il n’est pas modifié. Aucun verset n’est déclaré connu par une simple ouverture du formulaire.
- Apprentissage partiel Al Qasas 85 → Al Ankabût 5 : menus limités aux deux sourates, puis uniquement 85–88 pour Al Qasas. Validation jusqu’à 87 : 3/9 appris, 6 restants, reprise au verset 88 ; coches et repères remplis pour 85–87.
- Mushaf QPC page 402 : les 128 rectangles de mots sont rigoureusement identiques avant/après affichage des annotations. Preuve : `docs/qa/mushaf-geometry.json`. Aucun calque de programme derrière le texte.
- Pages images : même image, mêmes dimensions, mêmes positions ; annotations sur un calque indépendant dans la marge. Les versets partageant une ligne ont un repère groupé (ex. 1·2), afin d’éviter des pastilles superposées.

## Choix et limites

Le bandeau est intégré à l’en-tête Juz/sourate du lecteur QPC. Certaines sources images n’ont aucun espace d’en-tête disponible : leur capsule utilise l’espace sous la page, afin de ne pas masquer la première ligne. La taille du Mushaf n’a pas été diminuée pour créer un nouvel en-tête.

Les photos personnelles des amis et les images des contenus administrateur restent leurs données réelles, avec cache/placeholder existants. Aucun nombre fictif de versets d’amis n’est ajouté : le contrat de la liste sociale ne fournit pas cette statistique.

Les illustrations créées reprennent les motifs et la palette des maquettes ; elles ne sont pas des extractions pixel à pixel de celles-ci. Les pages du Coran restent les ressources originales.

Les safe areas natives, Dynamic Island, zoom et orientation paysage, audio réel, microphone, notifications et persistance après arrêt forcé restent à contrôler sur appareils physiques. Aucun test physique iPhone n’a été effectué dans cette session.
