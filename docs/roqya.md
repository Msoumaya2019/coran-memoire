# Espace Roqya

Le lecteur utilise `expo-audio` et le service existant `audioFocus`. Il reste monté dans `AppContent` lorsque les écrans changent ; la fermeture de la fiche laisse le mini-lecteur actif. Aucun audio, récitateur ou texte religieux n’est intégré au bundle. Les deux couvertures locales servent uniquement de fallback si aucune image n’est fournie.

## Mise en service Supabase

Exécuter `supabase/roqya.sql` dans le SQL Editor du projet Supabase existant. La migration ajoute uniquement trois tables et deux buckets dédiés. Elle ne modifie aucune table d’authentification, de Coran ou de progression. Elle peut être exécutée plusieurs fois. Aucun fichier ni donnée d’exemple n’est créé.

1. Dans `roqya_reciters`, ajouter un nom, éventuellement une `photo_url`, une description et un `sort_order`.
2. Dans `roqyas`, ajouter le titre, la description, une catégorie (`complete`, `short`, `sleep`, `protection`, ou une catégorie libre), une image HTTPS optionnelle et l’ordre.
3. Envoyer le MP3/M4A dans le bucket privé `roqya-audio`, par exemple `mishary-al-afasy/roqya-complete.mp3`.
4. Dans `roqya_audios`, associer les deux identifiants, renseigner `storage_path` avec ce chemin **sans préfixe de bucket**, `duration_seconds` et, de préférence, la taille exacte `file_size` en octets. `audio_url` peut rester NULL. Ne pas stocker d’URL signée dans la table.
5. Activer les trois entrées avec `enabled=true`. Une Roqya apparaît seulement si elle possède au moins une version audio et un récitateur activés.

Les images/photos peuvent être envoyées dans `roqya-images` puis leur URL publique HTTPS copiée dans les tables. La bibliothèque est récupérée à l’ouverture de l’application, au retour au premier plan et sur « Actualiser le catalogue ». L’ordre et les nouvelles entrées ne nécessitent pas de publication d’application.

## Sécurité

Les rôles anon/authenticated ont seulement SELECT. Les politiques RLS masquent les versions dont le récitateur ou la Roqya est désactivé. Les objets du bucket audio privé ne sont lisibles que s’ils correspondent à une version autorisée. Les URL signées expirent après six heures ; une nouvelle tentative en obtient une nouvelle. Une URL déjà émise reste valide jusqu’à son expiration. Les téléchargements déjà effectués ne sont pas effaçables à distance lorsque le téléphone est hors ligne.

L’administration actuelle passe par le dashboard Supabase/service role côté serveur. Ne jamais embarquer la clé service role. Un futur écran administrateur devra utiliser les droits administrateur existants via des RPC/Edge Functions contrôlées côté serveur ; aucun droit d’écriture n’est donné aux utilisateurs de l’application.

## Stockage et lecture

Les favoris et positions sont stockés dans la base SQLite déjà utilisée par l’application, séparément pour chaque compte. La reprise est propre à chaque `roqya_audio_id` ; changer de récitateur reprend sa propre position. Une nouvelle version jamais écoutée commence au début. La progression est enregistrée toutes les cinq secondes, à la pause, au changement de source et au changement d’état de l’application.

Les téléchargements sont dans le répertoire Documents de l’application et leur association (`audio_id`, `local_file_path`, `downloaded_at`, signature de source) est persistante. Le téléchargement écrit d’abord un fichier temporaire, vérifie le résultat et la taille quand connue, puis publie le fichier final. Il n’annonce jamais un fichier partiel comme prêt. Les octets réels déterminent le pourcentage ; sans taille connue, une progression indéterminée est affichée. Un transfert interrompu peut être relancé. Le fichier local valide est préféré au streaming ; un fichier supprimé est détecté et retiré de la liste.

La minuterie programme l’arrêt sur le lecteur natif Expo existant (DispatchSourceTimer iOS / Handler Android), indépendamment des timers JavaScript. `scripts/prepare-roqya-audio.cjs`, appelé par `app.config.js` avant prebuild, ajoute cette petite API aux sources de la version Expo Audio installée sans créer de fichiers Swift dans le dépôt. Les patches sont idempotents et refusent les versions incompatibles. Le timer natif est annulé à la libération et à la perte du focus audio, puis réarmé avec l’échéance restante lors de la reprise. La fin de fichier s’arrête nativement. Expo Go/une ancienne compilation sans cette API affiche une erreur explicite ; une nouvelle compilation native est requise. Les comportements sous restrictions OS restent à vérifier sur appareils.

## Vérification sur appareils

Avec un vrai fichier pour deux récitateurs : vérifier le streaming, la reprise après fermeture, les changements rapides de récitateur, les téléchargements/interruption réseau, la suppression d’un fichier local, le passage Coran/Roqya, les commandes média, la minuterie et la lecture écran verrouillé sur iPhone et Android. L’export Metro et l’aperçu web ne valident pas les services audio natifs.
