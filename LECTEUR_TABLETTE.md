# Notes sur les mots et les versets — version 0.9.39

## Utilisation

Le bouton permanent « Annoter · tablette et stylet » est supprimé. Maintenir le doigt sur un mot ouvre les actions « Annoter ce mot » et « Annoter le verset ».

Choisir « Surligner » ou « Entourer », puis ajouter un commentaire au clavier ou dans l’onglet « Stylet ». Les deux commentaires peuvent coexister dans la même note. « Enregistrer » conserve ensemble la note et son repère.

Le repère reste visible dans le lecteur habituel après fermeture de la note, changement de page et zoom. Toucher le passage marqué rouvre la note. « Supprimer la note et le repère » retire les deux. Les anciennes annotations sont conservées et deviennent aussi visibles dans le lecteur.

## Éditions

- **Coran avec règles de Tajwid** : sélection du mot à partir des positions exactes des glyphes d’origine ; sélection possible du verset entier. Les repères suivent le zoom et la pagination, y compris les versets répartis sur plusieurs pages.
- **Lecture simplifiée** : sélection des mots réels du texte, en conservant les couleurs du tajwid à l’intérieur de chaque mot.
- **Coran (édition en images)** : annotation du verset à partir des coordonnées originales de cette édition. Comme cette source ne fournit pas les positions des mots, le menu propose « Choisir un mot dans le Coran avec Tajwid » pour ouvrir le même verset dans le lecteur qui dispose de ces positions. Aucun emplacement de mot n’est inventé sur les images.

## Conservation

Les coordonnées et les identifiants du passage sont enregistrés avec la note. Le commentaire et les tracés manuscrits restent dans l’état privé du compte ; le moteur de page reçoit seulement les données nécessaires au repère. La sauvegarde locale et la synchronisation existantes conservent les notes et les suppressions séparément pour chaque compte.

Une modification non enregistrée demande confirmation avant de fermer l’éditeur. Le bouton « Annuler le dernier trait » permet de corriger l’écriture manuscrite sans effacer toute la note.

## Vérification

Des tests couvrent la sélection exacte d’un mot, les gestes d’appui long, le défilement et le pincement, la conservation des notes, les repères persistants, la suppression et la résolution des coordonnées après changement de mise en page.

Le contrôle visuel dans le navigateur couvre la création d’une note sur un mot, le commentaire au clavier, le tracé manuscrit, la fermeture et la réouverture, le changement de page, le zoom et la suppression.

La pression du stylet et la reconnaissance automatique de l’écriture ne sont pas implémentées. Le fonctionnement sur un véritable Apple Pencil ou stylet Android reste à vérifier sur appareil.
