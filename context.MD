## 1. Fonctionnalité : Mur Collaboratif et Visibilité (RBAC)

**1.1. Règles de visibilité et d'accès :**
- **Concept principal :** Un fil d'actualité asynchrone composé de `Post`, `Comment` et `Attachment`, strictement rattaché à un `Patient` unique.
- **Visibilité :**
  - **Collaborateurs :** Par défaut, tout contenu publié est public et visible par l'intégralité de la `CareTeam` du patient.
  - **Administrateur (Neuropsychologue) :** Possède le droit de restreindre la visibilité d'un `Post` lors de sa création ou modification (ex: masquer le contenu pour les utilisateurs ayant le `RelationshipType` "Teacher").

**1.2. Permissions et Cycle de vie (Actions CRUD) :**
- **Administrateur (Neuropsychologue) :** - Possède un contrôle total et permanent. 
  - Peut modifier ou supprimer **n'importe quel** `Post` ou `Comment`, peu importe l'auteur ou le délai écoulé depuis la publication.
- **Collaborateurs (Parents, Enseignants, etc.) :**
  - Peuvent modifier ou supprimer uniquement **leurs propres** publications (`Post` ou `Comment`).
  - **Délai de restriction :** Ces actions de modification/suppression ne sont autorisées que dans un **délai de 24 heures** après la publication initiale. Passé ce délai, le contenu devient définitif pour garantir l'intégrité du suivi clinique (sauf intervention de l'administrateur).

**1.3. Modélisation et Structure (Post, Comment, Attachment) :**
- **Relations :**
  - Un `Post` possède 0..n `Attachment` et 0..n `Comment`.
  - Un `Comment` possède 0..n `Attachment`.
- **Entité Polymorphique `Attachment` :**
  - Table unique gérant les métadonnées des fichiers stockés sur Supabase Storage.
  - **Clés étrangères :** `PostId` (Nullable) et `CommentId` (Nullable).
  - **Contrainte d'intégrité (CHECK constraint) :** Un `Attachment` doit être lié exclusivement à un `Post` OU à un `Comment`. La présence des deux IDs ou l'absence des deux est interdite.
  - **Audit :** Champ `UploadedById` obligatoire pour identifier formellement l'auteur du fichier (indépendamment de l'auteur du post/commentaire).

**1.4. Directives techniques pour l'IA (Claude Code) :**
- **Logique de filtrage :** L'API .NET doit appliquer un filtre systématique sur les `GET` pour respecter les exclusions de visibilité définies par l'admin.
- **Validation des droits :** Avant tout `PUT` ou `DELETE`, le service doit vérifier :
  1. Si l'utilisateur est Admin.
  2. OU si l'utilisateur est l'auteur (`CreatedById`) ET que le délai de 24h n'est pas dépassé.
- **Nettoyage :** La suppression d'un parent (`Post` ou `Comment`) doit déclencher la suppression physique des fichiers liés dans le stockage cloud.

## 2. Fonctionnalité : Authentification, Enrôlement et Sécurité (Identity)

**2.1. Processus d'Enrôlement Principal (Admin vers Parents) :**
- **Création du Patient :** Lors de la création d'un dossier `Patient` par le psychologue, le système génère automatiquement un jeton de sécurité (`EnrollmentToken`).
- **Nature du Jeton :** Ce n'est pas un champ de la table Patient. C'est une entité distincte (`EnrollmentToken`) contenant :
  - `PatientId` (Le dossier ciblé).
  - `TokenHash` (Le code d'invitation généré de manière aléatoire (ex: 8 caractères alphanumériques), stocké en base de données sous forme de Hash, comme un mot de passe).
  - `RoleTarget` (Le rôle prévu, ici "Parent").
  - `ExpiresAt` (Date d'expiration, ex: 7 jours).
- **Consommation :** Le parent arrive sur la page "J'ai un code d'invitation". Il saisit le code. Le backend vérifie le Hash. Si valide, le compte utilisateur est créé, lié à la `CareTeam` du patient, et le `EnrollmentToken` est **immédiatement supprimé (ou marqué IsUsed=true)** pour empêcher toute réutilisation.

**2.2. Processus de Délégation (Parents vers Professionnels) :**
- Les parents ont la possibilité d'agrandir l'équipe de soins, mais **il n'y a pas de code global ou réutilisable**.
- **Action :** Le parent génère une nouvelle invitation ciblée depuis son interface.
- **Résultat :** Le système crée un *nouveau* `EnrollmentToken` à usage strict et unique, lié au patient, avec le rôle spécifié (ex: "Teacher"). Ce nouveau code est transmis au professionnel. Une fois consommé, ce code est détruit.

**2.3. Directives techniques pour l'IA (Claude Code) :**
- Utilise **ASP.NET Core Identity** pour la gestion des utilisateurs (`ApplicationUser`).
- L'authentification API doit se faire via des **Tokens JWT** (Bearer). Le JWT doit inclure des Claims contenant l'ID de l'utilisateur et son email.
- **Service d'Enrôlement :** Crée un `EnrollmentService` dans la couche Application qui centralise la génération cryptographique sécurisée des codes (via `RandomNumberGenerator`), leur hachage avant stockage, et la transaction atomique lors de la consommation (Création de l'utilisateur + Ajout dans la CareTeam + Suppression du Token).

**2.4. Attribution des rôles et Cas particuliers (CareTeam) :**
- **Attribution stricte :** Lors de la consommation d'un `EnrollmentToken`, le backend doit automatiquement assigner le rôle défini dans la propriété `RoleTarget` du jeton. L'interface d'inscription ne doit pas permettre au nouvel utilisateur de choisir ou modifier ce rôle.
- **Gestion des rôles personnalisés :** - L'Enum `RelationshipType` définit les permissions strictes du système (ex: `Parent`, `Teacher`, `SpeechTherapist`, `Other`).
  - L'entité `CareTeam` doit inclure une propriété `CustomRoleName` (String, Nullable).
  - Si une invitation est créée avec le rôle `Other`, la valeur textuelle saisie par l'invitant (ex: "Éducateur spécialisé") est stockée dans `CustomRoleName` à des fins d'affichage exclusif, tandis que le système applique les règles d'autorisation standards liées au rôle `Other`.


## 3. Fonctionnalité : Sessions Cliniques et Prise de Notes (Offline PWA)

**3.1. Structure et Relations :**
- **Séance (Session) :** Un `Patient` possède plusieurs `Session`. Chaque `Session` est datée.
- **Note :** Une `Note` appartient obligatoirement à une et une seule `Session`. Une `Session` peut comporter 0 ou plusieurs `Note`.

**3.2. Prise de Notes et Technologie Hybride (PWA) :**
- **UX de l'Éditeur Principal :** L'interface repose sur un éditeur de texte enrichi (ex: `TipTap`). Le rendu final de toute note est exclusivement du texte typographié (pas d'images de croquis).
- **Workflow de Saisie au Stylet (Inking) :**
  - Utilisation de la `Web Handwriting Recognition API`.
  - **Capture Vectorielle :** L'application capture les coordonnées des tracés (`Strokes`) via les `PointerEvents`, et non des images.
  - **Reconnaissance par Batch :** Implémentation d'un délai d'inactivité (ex: 800ms) après la levée du stylet. Une fois ce délai atteint, les tracés sont envoyés à l'API de reconnaissance.
  - **Insertion Dynamique :** Le texte reconnu est automatiquement injecté à la position du curseur dans l'éditeur, et le canevas de tracé est effacé pour la saisie suivante.
- **Fonctionnement Offline-First :** - Les requêtes de l'éditeur sont sauvegardées localement via **IndexedDB** (Dexie.js).
  - Synchronisation automatique avec l'API .NET lors du rétablissement de la connexion.


**3.3. Confidentialité et Publication (Secret Médical) :**
- **Accès Psychologue (Admin) :** Seul le psychologue a accès à l'espace de prise de notes en temps réel. Il peut créer, modifier et consulter toutes les notes, publiées ou non.
- **Accès Parent :** - Les parents ne voient **aucune** note par défaut.
  - Un parent peut consulter les notes d'une séance passée **uniquement** si celle-ci a été relue, validée et marquée explicitement comme "Publiée" (`IsPublished = true`) par le psychologue.
- **Accès Collaborateurs :** Les enseignants, logopèdes ou autres professionnels n'ont **aucun accès** aux notes de session, même si elles sont publiées (accès réservé au cercle familial restreint).

**3.4. Directives techniques pour l'IA (Claude Code) :**
- Utilise **Vite-plugin-pwa** pour la gestion du cache et du Service Worker.
- Le modèle `SessionNote` en base de données doit inclure un booléen `IsPublished`.
- L'API .NET doit filtrer les requêtes de consultation des notes pour s'assurer que :
  1. L'utilisateur est bien le parent du patient concerné.
  2. La propriété `IsPublished` est bien à `true`.
- Prévoir un champ `RawData` (JSON) dans l'entité `Note` pour stocker éventuellement les coordonnées des tracés au stylet (strokes) si besoin.

**3.5. Stratégie de Synchronisation et Résolution de Conflits :**
- **Stratégie "Last Write Wins" (La plus récente l'emporte) :** - Chaque `SessionNote` possède un champ `UpdatedAt` (Timestamp UTC).
  - Lors de la synchronisation (retour en ligne de la PWA), l'API .NET doit comparer le `UpdatedAt` de la note entrante (venant d'IndexedDB) avec celui de la base de données (PostgreSQL).
  - Si la note locale est plus récente, elle écrase la version serveur. Si la note serveur est plus récente, l'API rejette la modification locale (et idéalement, met à jour le client local).

**3.6. Sécurité des données hors ligne (Threat Model) :**
- **Absence de chiffrement applicatif local :** Pour maintenir la fluidité de la PWA, les données stockées dans `IndexedDB` (Dexie.js) ne subissent pas de chiffrement applicatif supplémentaire (AES). 
- **Sécurité déléguée au système d'exploitation :** L'architecture assume que l'isolation des données repose sur le respect des protocoles de sécurité du terminal physique (Chiffrement BitLocker de la Surface Pro, mot de passe de session et verrouillage automatique).
- **Nettoyage automatique :** (Optionnel mais recommandé) Demander à Claude Code d'implémenter un mécanisme qui vide le cache `IndexedDB` local dès qu'une déconnexion (Logout) explicite est effectuée par l'utilisateur.

