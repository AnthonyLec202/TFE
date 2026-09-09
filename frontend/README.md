# Kideo — client

Application React de la plateforme Kideo : interface progressive (PWA), miroir local chiffré et
synchronisation différée. **La documentation du projet — présentation, prérequis, démarrage des deux
tiers, variables de configuration, conventions d'architecture — se trouve dans le
[README à la racine du dépôt](../README.md).**

## Démarrage rapide

L'API doit tourner au préalable (voir le README racine).

```bash
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement, avec proxy de `/api`, `/hubs` et `/health` |
| `npm run build` | `tsc -b` en mode strict puis build de production |
| `npm run test` | Suite unitaire Vitest |
| `npm run lint` | ESLint |
| `npm run preview` | Sert le bundle de production |

## Repères

- `src/features/<domaine>/` — code groupé par domaine, scission conteneur / présentation
- `src/core/offline/` — base locale Dexie, moteur de synchronisation, chiffrement au repos
- `src/services/` — clients HTTP bruts partagés
- `src/pages/` — coquilles de route, sans logique

`VITE_API_URL` doit rester **vide** : le client vise sa propre origine, qui relaie l'API. Une URL
absolue rétablit un appel inter-site et la session est alors perdue sur les navigateurs mobiles.
