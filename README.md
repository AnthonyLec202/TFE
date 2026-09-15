# Kideo

Plateforme clinique **local-first** pour le suivi neuropsychologique en cabinet : dossiers patients,
mur collaboratif d'équipe de soin, séances avec prise de notes au stylet, et génération assistée de
comptes rendus par un modèle de langage exécuté sur le poste de la praticienne.

L'application fonctionne **sans connexion** : la patientèle, les séances et les notes sont miroitées
dans le navigateur et synchronisées au retour du réseau. Aucune donnée clinique ne quitte
l'infrastructure du cabinet pour un service d'inférence tiers.

---

## Sommaire

- [Architecture](#architecture)
- [Pile technique](#pile-technique)
- [Prérequis](#prérequis)
- [Démarrage local](#démarrage-local)
- [Variables de configuration](#variables-de-configuration)
- [Commandes](#commandes)
- [Carte des répertoires](#carte-des-répertoires)
- [Conventions d'architecture](#conventions-darchitecture)
- [Tests et vérifications](#tests-et-vérifications)
- [Déploiement](#déploiement)
- [Notes de sécurité](#notes-de-sécurité)
- [Utilisation de l'intelligence artificielle](#utilisation-de-lintelligence-artificielle)

---

## Architecture

Deux tiers déployés séparément, réunis derrière une **origine unique** :

```
Navigateur (PWA React)                       Poste de la praticienne
  ├── IndexedDB (miroir local chiffré)         └── Ollama — inférence locale
  ├── Service Worker (coquille hors ligne)          (aucune sortie réseau)
  └── /api, /hubs, /health  ─────┐
                                 │  réécriture same-origin (Vercel en production,
                                 │  proxy du serveur de développement en local)
                                 ▼
                        API ASP.NET Core ─── PostgreSQL
                                 ├── SignalR (mur temps réel)
                                 ├── Supabase Storage (pièces jointes)
                                 └── MyScript (reconnaissance d'écriture, mandatée)
```

Le point structurant est la **réécriture same-origin**. Le frontend n'appelle jamais l'API par une
URL absolue : il vise son propre domaine, qui relaie `/api`, `/hubs` et `/health` vers le service
applicatif. C'est ce qui rend le cookie de session *first-party* — condition sans laquelle
l'authentification échoue sur tous les navigateurs mobiles, qui bloquent les cookies inter-sites par
défaut.

## Pile technique

| Tier | Technologies |
|---|---|
| **API** | .NET 9, ASP.NET Core, EF Core 9 + Npgsql, ASP.NET Identity, JWT en cookie `HttpOnly`, SignalR, Scalar/OpenAPI, MailKit |
| **Client** | React 19, TypeScript 6, Vite 8, Tailwind 4, React Router 7, Dexie 4 (IndexedDB), TipTap 3, `vite-plugin-pwa` |
| **Base de données** | PostgreSQL (24 migrations, appliquées au démarrage de l'API) |
| **Services externes** | Supabase Storage (pièces jointes), MyScript (reconnaissance manuscrite), Brevo (SMTP) |
| **Inférence** | Ollama en local, modèle `qwen2.5:7b` |
| **Qualité** | Vitest 4 (86 tests), ESLint 10, `tsc` en mode strict |

## Prérequis

- **SDK .NET 9**
- **Node.js 20** ou supérieur
- **PostgreSQL** accessible localement
- **Ollama** *(facultatif)* — nécessaire uniquement pour la génération de comptes rendus :
  `ollama pull qwen2.5:7b`

## Démarrage local

### 1. Base de données

Créer une base vide ; le schéma est appliqué automatiquement au démarrage de l'API
(`Database.MigrateAsync()`), aucune commande `dotnet ef` n'est requise.

```bash
createdb tfe
```

### 2. Secrets de l'API

`appsettings.json` est versionné avec **tous ses secrets vides**, par conception. Renseignez-les via
le gestionnaire de secrets utilisateur ; l'API refuse de démarrer si `Cors:AllowedOrigins` est vide.

```bash
cd TFE.Api
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=tfe;Username=postgres;Password=postgres"
dotnet user-secrets set "Cors:AllowedOrigins:0" "http://localhost:5173"
dotnet user-secrets set "Jwt:Key"                "<chaîne aléatoire d'au moins 32 caractères>"
dotnet user-secrets set "Encryption:PiiKey"      "<clé de chiffrement des colonnes>"
dotnet user-secrets set "Admin:Email"            "admin@exemple.be"
dotnet user-secrets set "Admin:InitialPassword"  "<mot de passe du compte initial>"
```

Deux fonctionnalités restent inertes sans leurs clés, sans empêcher le démarrage :

| Secret absent | Conséquence |
|---|---|
| `Handwriting:ApplicationKey` + `Handwriting:HmacKey` | La conversion manuscrite répond `503`. Les tracés sont conservés localement en attendant. |
| `Supabase:ServiceRoleKey` | Le dépôt de pièces jointes échoue. |

### 3. Lancer l'API

```bash
dotnet run --project TFE.Api --urls http://localhost:5043
```

> **Ports.** Le profil de lancement (`Properties/launchSettings.json`) écoute sur **5050**, tandis
> que `VITE_DEV_API_TARGET` et le repli d'`apiClient` visent **5043**. Les deux doivent concorder :
> soit vous forcez `--urls` comme ci-dessus, soit vous alignez `VITE_DEV_API_TARGET` sur 5050.

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

### 5. Inférence locale *(facultatif)*

Ollama doit autoriser explicitement l'origine de l'application, sans quoi le navigateur écarte la
réponse :

```bash
OLLAMA_ORIGINS=http://localhost:5173 ollama serve
```

## Variables de configuration

### API — section de configuration → variable d'environnement

Le séparateur `__` (double tiret bas) traduit le `:` de la configuration .NET. Sur Azure, ces clés
se règlent dans les paramètres applicatifs du service.

| Clé | Rôle | Secret |
|---|---|---|
| `ConnectionStrings:DefaultConnection` | Chaîne de connexion PostgreSQL | oui |
| `Jwt:Key` | Clé de signature du jeton de session | **oui** |
| `Jwt:Issuer` / `Jwt:Audience` / `Jwt:ExpiresInMinutes` | Émetteur, audience et durée de vie du jeton | non |
| `Encryption:PiiKey` | Clé de chiffrement des colonnes nominatives | **oui** |
| `Cors:AllowedOrigins` | Origines autorisées (tableau). **Vide ⇒ l'API refuse de démarrer** | non |
| `Cors:AllowedOriginPatterns` | Motifs d'origine, à laisser vides en production | non |
| `App:FrontendBaseUrl` | Base des liens envoyés par courriel | non |
| `Admin:Email` / `Admin:InitialPassword` | Compte administrateur créé à l'amorçage | **oui** |
| `Supabase:Url` / `Supabase:AttachmentsBucket` | Stockage objet des pièces jointes | non |
| `Supabase:ServiceRoleKey` | Clé de service du stockage | **oui** |
| `Email:Smtp*` / `Email:From*` | Relais SMTP transactionnel | mot de passe **oui** |
| `Handwriting:ApplicationKey` / `Handwriting:HmacKey` | Accès au prestataire de reconnaissance | **oui** |
| `Handwriting:BatchUrl` / `Language` / `MaxPoints` | Point d'entrée, langue, plafond de points par requête | non |

### Client — `frontend/.env`

Tout ce qui est préfixé `VITE_` est **inliné dans le bundle et donc public**. Aucune clé secrète ne
doit y figurer : c'est la raison pour laquelle la reconnaissance manuscrite est mandatée par l'API.

| Clé | Valeur attendue |
|---|---|
| `VITE_API_URL` | **Vide.** Vide signifie « même origine » ; une URL absolue rétablit un appel inter-site et casse la session sur mobile. |
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
| `npm run preview` | Sert le bundle de production localement |

### API (`TFE.Api/`)

| Commande | Effet |
|---|---|
| `dotnet run --urls http://localhost:5043` | Démarre l'API, applique les migrations et amorce le compte administrateur |
| `dotnet build` | Compilation seule |
| `dotnet ef migrations add <Nom>` | Nouvelle migration (l'application se fait au démarrage) |

## Carte des répertoires

```
TFE.Api/                    API ASP.NET Core — patron N-tiers
  Controllers/                points d'entrée HTTP, sans logique métier
  Services/                   règles métier, cartographie Modèle → DTO
  Repositories/               accès aux données + UnitOfWork (transactions)
  Interfaces/                 contrats des services et des dépôts (injection)
  Models/                     entités persistées
  DTOs/                       contrats d'API, découplés du schéma
  Data/                       DbContext, migrations, amorçage
  Hubs/                       temps réel SignalR (mur collaboratif)
  Options/                    classes d'options liées à la configuration
  Extensions/                 enregistrement des services, cookie de session

frontend/src/
  features/<domaine>/         code groupé par domaine métier
    *Container.tsx              données, état, effets de bord
    components/                 présentation, pilotée par les props
    hooks/  services/  utils/  types/
    index.ts                    façade publique de la fonctionnalité
  components/ui/              primitives génériques (Button, Card, Input…)
  components/layout/          coquille applicative (Navbar, MainLayout)
  core/offline/               base locale, moteur de synchronisation, chiffrement au repos
  services/                   clients HTTP bruts partagés
  pages/                      coquilles de route, sans logique
  types/                      types partagés par au moins deux fonctionnalités
```

## Conventions d'architecture

Ces règles font autorité en cas de doute sur l'emplacement d'un fichier.

### API — patron N-tiers

1. Les couches communiquent **uniquement par interfaces injectées** : contrôleur → `IService`,
   service → `IRepository`.
2. Un `Model` n'est **jamais** renvoyé tel quel par un contrôleur ; le service le projette en `DTO`.
3. **Contrôleurs maigres, services gras** : un point d'entrée tient en une à trois lignes.
4. Un service n'injecte **jamais** `ApplicationDbContext`. La persistance et les transactions passent
   par `IUnitOfWork`.
5. Les méthodes mutantes d'un dépôt ne font que préparer les changements ; **seul le service valide**
   via `IUnitOfWork`.

### Client — découpage par fonctionnalité

1. **Scission conteneur / présentation obligatoire.** Les `*Container.tsx` détiennent les données et
   les effets ; les composants de `components/` ne reçoivent que des props.
2. **Isolation par `index.ts`.** Une fonctionnalité n'importe d'une autre que par sa façade publique,
   jamais par un chemin interne.
3. **Les pages sont des coquilles** : elles montent un conteneur, rien de plus.
4. **Aucun code mort après refactorisation** : un fichier déplacé est supprimé, pas laissé en
   réexportation.

### Langue et commentaires

Les identifiants et les commentaires du code sont en **anglais** ; les messages destinés à
l'utilisateur sont en **français**. La convention de commentaire est qu'il n'explique pas *ce que*
fait le code — cela se lit — mais **pourquoi il est écrit ainsi**, en particulier lorsqu'une
formulation plus naturelle a été essayée et a échoué. Plusieurs de ces commentaires décrivent des
régressions déjà survenues : ils valent avertissement.

## Tests et vérifications

| Vérification | Commande | État attendu |
|---|---|---|
| Socle unitaire | `npm run test` | 86 / 86, aucun test ignoré |
| Types | `npm run build` (ou `npx tsc --noEmit`) | 0 erreur |
| Analyse statique | `npm run lint` | 0 erreur, 0 avertissement |

Le socle unitaire couvre cinq modules purs et volontairement ciblés : reflux des lignes reconnues,
fenêtre de validité de session hors ligne, insertion du texte reconnu dans le contenu enrichi,
normalisation des horodatages de tracés, et ordonnancement du catalogue d'outils. Ce sont les unités
dont la défaillance est **silencieuse** — elle ne produit aucun message et ne se détecte que par
assertion.

Les règles de cloisonnement, l'effacement de compte et le chiffrement au repos ne sont pas couverts
par des tests automatisés : ils relèvent de procédures d'acceptation manuelles.

## Déploiement

| Tier | Cible | Déclencheur |
|---|---|---|
| Client | Vercel | à chaque poussée ; `vercel.json` porte les réécritures `/api`, `/hubs`, `/health` |
| API | Azure App Service (Belgique) | GitHub Actions, filtré sur les chemins de l'API |

Le workflow ne se contente pas de publier : il **sonde** ensuite un point d'entrée protégé jusqu'à
douze fois, à quinze secondes d'intervalle. Un `401` ou un `429` vaut succès — la route existe et
applique son autorisation. Un `404` signale une route absente du build, un `5xx` que l'application
n'a pas démarré. Cette sonde existe parce qu'une étape de publication réussie ne dit rien du
démarrage effectif : l'API échoue volontairement si sa liste d'origines est vide.

## Notes de sécurité

- **Le jeton de session ne transite jamais par JavaScript.** Il est délivré dans un cookie
  `HttpOnly`, `Secure`, `SameSite=Lax`, sans attribut `Domain` — donc restreint à l'hôte émetteur.
- **Chiffrement au repos du miroir local.** Les colonnes sensibles d'IndexedDB (contenu des notes,
  tracés non convertis, comptes rendus) sont chiffrées en AES-GCM par une clé dérivée par PBKDF2 de
  l'identifiant utilisateur et d'un sel propre au terminal. La clé est non extractible et n'est
  jamais sérialisée.
- **Aucune donnée clinique n'atteint un service d'inférence tiers.** La génération de comptes rendus
  s'exécute sur le poste de la praticienne.
- **`appsettings.json` est versionné sans aucun secret.** Les valeurs réelles viennent des secrets
  utilisateur en local et des paramètres applicatifs en production.
- **Enrôlement sur invitation uniquement.** Aucun parcours d'inscription libre n'existe ; un code est
  nominatif, à usage unique et horodate le consentement RGPD.

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
