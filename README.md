# Kideo

Plateforme clinique **local-first** pour le suivi neuropsychologique en cabinet : dossiers patients,
mur collaboratif d'équipe de soin, séances avec prise de notes au stylet, et génération assistée de
comptes rendus par un modèle de langage exécuté sur le poste de la praticienne.

L'application fonctionne **sans connexion** : la patientèle, les séances et les notes sont miroitées
dans le navigateur et synchronisées au retour du réseau.

Deux tiers : une API ASP.NET Core adossée à PostgreSQL, et un client React installable (PWA). Le
client n'appelle jamais l'API par une URL absolue — il vise sa propre origine, qui relaie `/api`,
`/hubs` et `/health` (proxy du serveur Vite en local, réécritures Vercel en production). C'est ce qui
rend le cookie de session *first-party*, condition sans laquelle l'authentification échoue sur les
navigateurs mobiles. Les conventions d'architecture des deux tiers sont décrites dans
[`CLAUDE.md`](CLAUDE.md).

## Pile technique

| Tier | Technologies |
|---|---|
| **API** | .NET 9, ASP.NET Core, EF Core 9 + Npgsql, ASP.NET Identity, JWT en cookie `HttpOnly`, SignalR, Scalar/OpenAPI, MailKit |
| **Client** | React 19, TypeScript 6, Vite 8, Tailwind 4, React Router 7, Dexie 4 (IndexedDB), TipTap 3, `vite-plugin-pwa` |
| **Base de données** | PostgreSQL (24 migrations, appliquées au démarrage de l'API) |
| **Services externes** | Supabase (PostgreSQL managé en production + Storage des pièces jointes), MyScript (reconnaissance manuscrite), Brevo (SMTP) |
| **Inférence** | Ollama en local, modèle `qwen2.5:7b` |
| **Qualité** | Vitest 4 (86 tests), ESLint 10, `tsc` en mode strict |

---

## Prérequis

- **SDK .NET 9**
- **Node.js `^20.19` ou `>=22.12`** — exigence de Vite 8 ; Node 20.9 ou 22.0 échouent au build. La
  contrainte est déclarée dans `package.json` et `npm install` la refuse (`engine-strict`).
- **PostgreSQL 14 ou supérieur**, accessible localement. Aucune extension n'est requise.
- **Ollama** *(facultatif)* — uniquement pour la génération de comptes rendus. Le modèle pèse environ
  5 Go et demande à peu près autant de mémoire : `ollama pull qwen2.5:7b`

## Démarrage local

### 1. Base de données

Créer une base vide. Le schéma est appliqué automatiquement au démarrage de l'API
(`Database.MigrateAsync()`) ; aucune commande `dotnet ef` n'est requise.

```bash
psql -U postgres -c "CREATE DATABASE tfe;"
```

### 2. Secrets de l'API

Les secrets ne sont jamais versionnés : `appsettings.json` les porte à vide, et
`appsettings.Development.json` **remet à vide la chaîne de connexion et la clé de chiffrement**.
Renseigner `appsettings.json` est donc sans effet en développement — il faut passer par le
gestionnaire de secrets utilisateur.

Générer d'abord les deux clés. `Encryption:PiiKey` doit être une chaîne **Base64 valide décodant vers
au moins 16 octets** (32 recommandés) : une phrase de passe arbitraire fait échouer le service de
chiffrement. `Jwt:Key` doit faire au moins 32 caractères ; la même commande convient.

```powershell
# PowerShell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

```bash
# bash
openssl rand -base64 32
```

Puis :

```bash
cd TFE.Api
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=tfe;Username=postgres;Password=postgres"
dotnet user-secrets set "Jwt:Key"                "<clé générée ci-dessus>"
dotnet user-secrets set "Encryption:PiiKey"      "<autre clé générée ci-dessus>"
dotnet user-secrets set "Admin:Email"            "admin@exemple.be"
dotnet user-secrets set "Admin:InitialPassword"  "<mot de passe initial, 6 caractères minimum>"
```

> `Cors:AllowedOrigins` n'a pas à être configuré en local : `appsettings.Development.json` autorise
> déjà `http://localhost:5173` et `http://localhost:4173`. Hors développement, l'API **refuse de
> démarrer** si la liste est vide.

### 3. Lancer l'API

```bash
dotnet run --project TFE.Api      # http://localhost:5043
```

**Vérifier la sortie.** L'amorçage de la base est isolé dans un `try/catch` : une chaîne de connexion
erronée ou une `PiiKey` mal formée n'empêche pas l'API de démarrer — elle produit une ligne d'erreur,
puis tous les endpoints échouent ensuite. Le démarrage n'est réussi que si ces deux lignes
apparaissent :

```
[Seed] Running database migrations...
[Seed] Migrations OK.
```

> **Port.** L'API écoute sur **5043**, valeur que visent aussi `VITE_DEV_API_TARGET` et le repli
> d'`apiClient`. Les deux doivent concorder : changer l'un (`--urls`, profil de lancement) impose de
> changer l'autre. Le lancement par F5 depuis Visual Studio suit `Properties/launchSettings.json`,
> aligné sur le même port.

En développement, la référence interactive de l'API est servie par Scalar sur `/scalar/v1`.

### 4. Lancer le client

```bash
cd frontend
cp .env.example .env      # les valeurs par défaut conviennent au développement local
npm install
npm run dev               # http://localhost:5173
```

Le serveur de développement relaie `/api`, `/hubs` et `/health` vers `VITE_DEV_API_TARGET`, de sorte
que la topologie à origine unique — et donc le comportement du cookie — soit identique à la
production.

### 5. Première connexion

L'inscription libre n'existe pas : l'enrôlement se fait **sur invitation**. Au premier démarrage,
l'API crée un compte administrateur à partir de `Admin:Email` et `Admin:InitialPassword` ; c'est le
seul point d'entrée.

1. Ouvrir `http://localhost:5173/login` et se connecter avec ces identifiants.
2. Créer un patient, puis générer un code d'invitation depuis sa fiche.
3. Le code est **affiché en clair dans l'application** — aucun envoi de courriel n'est nécessaire.
   Le saisir sur `/enroll` pour créer un second compte (praticien, parent, enseignant…).

Le compte administrateur n'est réamorcé que si la base ne contient **aucun** administrateur :
renommer ce compte ne le fait pas réapparaître au redémarrage suivant.

### 6. Inférence locale *(facultatif)*

Ollama doit autoriser explicitement l'origine de l'application, sans quoi le navigateur écarte la
réponse :

```powershell
# PowerShell
$env:OLLAMA_ORIGINS = "http://localhost:5173"; ollama serve
```

```bash
# bash
OLLAMA_ORIGINS=http://localhost:5173 ollama serve
```

---

## Configuration

### API — section de configuration → variable d'environnement

Le séparateur `__` (double tiret bas) traduit le `:` de la configuration .NET. Sur Azure, ces clés se
règlent dans les paramètres applicatifs du service.

| Clé | Rôle | Secret |
|---|---|---|
| `ConnectionStrings:DefaultConnection` | Chaîne de connexion PostgreSQL | oui |
| `Jwt:Key` | Clé de signature du jeton de session (≥ 32 caractères) | **oui** |
| `Jwt:Issuer` / `Jwt:Audience` / `Jwt:ExpiresInMinutes` | Émetteur, audience et durée de vie du jeton | non |
| `Encryption:PiiKey` | Clé de chiffrement des colonnes nominatives (**Base64, ≥ 16 octets décodés**) | **oui** |
| `Cors:AllowedOrigins` | Origines autorisées (tableau). **Vide ⇒ l'API refuse de démarrer** | non |
| `Cors:AllowedOriginPatterns` | Motifs d'origine, à laisser vides en production | non |
| `App:FrontendBaseUrl` | Base des liens envoyés par courriel | non |
| `Admin:Email` / `Admin:InitialPassword` | Compte administrateur créé à l'amorçage | **oui** |
| `Supabase:Url` / `Supabase:AttachmentsBucket` | Stockage objet des pièces jointes | non |
| `Supabase:ServiceRoleKey` | Clé de service du stockage | **oui** |
| `Email:Smtp*` / `Email:From*` | Relais SMTP transactionnel | mot de passe **oui** |
| `Handwriting:ApplicationKey` / `Handwriting:HmacKey` | Accès au prestataire de reconnaissance | **oui** |
| `Handwriting:BatchUrl` / `Language` / `MaxPoints` | Point d'entrée, langue, plafond de points par requête | non |

### Fonctionnalités inertes sans leur clé

Aucune de ces absences n'empêche l'API de démarrer ; le reste de l'application reste utilisable.

| Secret absent | Conséquence |
|---|---|
| `Handwriting:ApplicationKey` + `Handwriting:HmacKey` | La conversion manuscrite répond `503`. Les tracés sont conservés localement en attendant. |
| `Supabase:ServiceRoleKey` | Le dépôt de pièces jointes échoue. |
| `Email:SmtpPassword` | Aucun courriel n'est envoyé : la réinitialisation de mot de passe est inopérante. L'enrôlement, lui, n'en dépend pas — le code d'invitation est affiché dans l'application. |
| `App:FrontendBaseUrl` mal réglé | Les liens contenus dans les courriels pointent vers la mauvaise origine. |

### Client — `frontend/.env`

Tout ce qui est préfixé `VITE_` est **inliné dans le bundle et donc public**. Aucune clé secrète ne
doit y figurer : c'est la raison pour laquelle la reconnaissance manuscrite est mandatée par l'API.

| Clé | Valeur attendue |
|---|---|
| `VITE_API_URL` | **Vide.** Vide signifie « même origine » ; une URL absolue rétablit un appel inter-site et casse la session sur mobile. Ne pas supprimer la clé : absente, `apiClient` se rabat sur `http://localhost:5043`. |
| `VITE_DEV_API_TARGET` | Cible du proxy de développement (`http://localhost:5043` par défaut). |
| `VITE_OLLAMA_URL` | `http://127.0.0.1:11434` — en IPv4 explicite, `localhost` pouvant résoudre en `::1`. |
| `VITE_OLLAMA_MODEL` | `qwen2.5:7b` |

## Commandes

### Client (`frontend/`)

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement sur `:5173`, avec proxy d'API |
| `npm run build` | Vérification de types stricte (`tsc -b`) **puis** build de production |
| `npm run test` | Suite unitaire Vitest (86 tests) |
| `npm run test:watch` | Idem, en mode surveillance |
| `npm run lint` | ESLint sur l'ensemble du projet |
| `npm run preview` | Sert le bundle de production sur `:4173`, avec le même proxy |

### API (`TFE.Api/`)

| Commande | Effet |
|---|---|
| `dotnet run` | Démarre l'API, applique les migrations et amorce le compte administrateur |
| `dotnet build` | Compilation seule |
| `dotnet ef migrations add <Nom>` | Nouvelle migration (l'application se fait au démarrage) |

Vérifications attendues avant de livrer : `npm run test` → 86 / 86, `npm run build` → 0 erreur,
`npm run lint` → 0 avertissement.

## Dépannage

| Symptôme | Cause habituelle |
|---|---|
| L'API démarre mais toutes les requêtes échouent | `[Seed] Migrations OK.` n'est pas apparu : chaîne de connexion invalide, ou `Encryption:PiiKey` qui n'est pas du Base64 d'au moins 16 octets. L'échec d'amorçage est journalisé, pas fatal. |
| `404` sur `/api/...` en développement | L'API n'est pas lancée, ou n'écoute pas sur le port visé par `VITE_DEV_API_TARGET` (5043 par défaut). |
| Connexion acceptée puis perdue au rechargement | `VITE_API_URL` n'est pas vide : l'appel redevient inter-site et le cookie `SameSite=Lax` est écarté. |
| L'API refuse de démarrer | `Cors:AllowedOrigins` est vide pour l'environnement courant. |
| Génération de compte rendu indisponible | Ollama n'est pas lancé, ou `OLLAMA_ORIGINS` n'autorise pas l'origine de l'application. |
| Conversion manuscrite en `503` | Clés MyScript absentes de la configuration de l'API. |

## Structure du projet

```
TFE.Api/        API ASP.NET Core — patron N-tiers
                Controllers / Services / Repositories + UnitOfWork / Interfaces /
                Models / DTOs / Data (contexte, migrations, amorçage) / Hubs (SignalR)

frontend/src/   Client React — découpage par fonctionnalité
                features/<domaine>/ (conteneurs, composants, hooks, services, types) /
                components/ui + layout / core/offline (base locale, synchronisation) /
                services (clients HTTP bruts) / pages (coquilles de route)
```

Les règles qui régissent ce découpage — couches de l'API, scission conteneur / présentation,
isolation des fonctionnalités par leur `index.ts` — font autorité dans [`CLAUDE.md`](CLAUDE.md). Les
identifiants et commentaires du code sont en **anglais**, les messages destinés à l'utilisateur en
**français**.

## Déploiement

| Tier | Cible | Déclencheur |
|---|---|---|
| Client | Vercel | à chaque poussée ; `vercel.json` porte les réécritures `/api`, `/hubs`, `/health` |
| API | Azure App Service (Belgique) | GitHub Actions, filtré sur les chemins de l'API |

Après publication, le workflow sonde un point d'entrée protégé jusqu'à douze fois, à quinze secondes
d'intervalle : un `401` ou un `429` vaut succès, un `404` signale une route absente du build, un `5xx`
que l'application n'a pas démarré. Une étape de publication réussie ne dit rien du démarrage
effectif — l'API échoue volontairement si sa liste d'origines est vide.

Sur une base hébergée chez Supabase, exécuter une fois
[`TFE.Api/Data/Scripts/EnableRowLevelSecurity.sql`](TFE.Api/Data/Scripts/EnableRowLevelSecurity.sql) :
le script active RLS sans aucune politique sur toutes les tables, ce qui ferme l'API REST
auto-générée de Supabase. Le rôle utilisé par la chaîne de connexion contourne RLS, donc EF Core
n'est pas affecté. Étape manuelle et idempotente, sans objet sur une instance PostgreSQL locale.

## Notes de sécurité

- **Le jeton de session ne transite jamais par JavaScript** : cookie `HttpOnly`, `Secure`,
  `SameSite=Lax`, sans attribut `Domain` — donc restreint à l'hôte émetteur.
- **Chiffrement au repos du miroir local** : les colonnes sensibles d'IndexedDB (contenu des notes,
  tracés non convertis, comptes rendus) sont chiffrées en AES-GCM par une clé dérivée par PBKDF2,
  non extractible et jamais sérialisée.
- **Aucune donnée clinique n'atteint un service d'inférence tiers** : la génération de comptes rendus
  s'exécute sur le poste de la praticienne.
- **Aucun secret versionné** : secrets utilisateur en local, paramètres applicatifs en production.
- **Enrôlement sur invitation uniquement** : un code est nominatif, à usage unique, et horodate le
  consentement RGPD.

---

## Utilisation de l'intelligence artificielle

Une partie du code de ce dépôt a été produite avec l'assistance d'un outil d'intelligence
artificielle. Cette section en rend compte, conformément aux exigences de transparence applicables
au travail de fin d'études dont ce projet est le support.

### Outil employé

**Claude** (Anthropic), utilisé via **Claude Code**, l'interface en ligne de commande du même
éditeur. https://claude.ai — https://claude.com/claude-code

### Méthode de travail

L'assistance n'a pas été employée de manière ponctuelle, prompt par prompt, mais encadrée par un
document d'instructions permanent.

**1. Cadrage préalable par `CLAUDE.md`.** Le fichier [`CLAUDE.md`](CLAUDE.md), versionné à la racine
du dépôt, a été rédigé en premier. Il présente l'application et surtout **l'architecture attendue** :
conventions de nommage, paradigme imposé à chaque tiers, découpage en couches côté serveur avec les
interdictions propres à chacune — un contrôleur ne porte pas de règle métier, un service n'injecte
jamais le `DbContext`, un dépôt ne valide jamais la transaction — et, côté client, l'organisation par
fonctionnalité assortie de la séparation conteneur / présentation. Ce fichier est lu à chaque session
et constitue le cadre auquel toute production est tenue.

**2. Développement dirigé par prompts.** Chaque fonctionnalité a fait l'objet d'instructions décrivant
le comportement attendu, les règles de gestion et les cas limites, à charge pour l'outil de produire
une implémentation **conforme aux contraintes architecturales déjà posées**. La conception — modèle de
données, découpage des responsabilités, décisions de sécurité — précède les prompts et n'en découle
pas.

**3. Relecture et refactorisation systématiques.** Aucune production n'a été intégrée en l'état. Le
code généré a été relu puis retravaillé, avec trois objectifs constants : la lisibilité, la capacité
à évoluer, et l'élimination des duplications. Plusieurs des composants transverses du projet — le
résolveur de rôles d'équipe de soin, le service de chiffrement, le moteur de synchronisation — sont
le résultat de cette étape : ils consolident en un point unique des logiques que les premières
implémentations avaient dispersées.

### Portée de l'intervention

| Registre | Nature de l'assistance |
|---|---|
| Composants d'interface répétitifs | Génération d'une première version, systématiquement retravaillée. |
| Logique métier serveur | Implémentation sous contrainte des règles définies au préalable. |
| Diagnostic d'anomalies | Analyse de traces et d'erreurs, propositions de piste. |
| Structures alternatives | Propositions discutées, retenues ou écartées selon les contraintes du projet. |
| Décisions d'architecture | **Aucune.** Elles sont antérieures et consignées dans `CLAUDE.md`. |

Plusieurs propositions ont été écartées parce qu'elles contredisaient une contrainte du projet : le
chiffrement du miroir local par les crochets de table Dexie, qui écrit le texte clair sans lever
d'erreur, et diverses variantes de génération de comptes rendus par un service distant,
incompatibles avec l'exigence de non-transfert des notes cliniques.

### Responsabilité

La responsabilité du code remis est entière et personnelle. Chaque production a été vérifiée, testée
et adaptée au contexte du projet avant intégration.
