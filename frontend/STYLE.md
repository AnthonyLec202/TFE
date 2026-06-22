# Charte de style — « Piste A · Clinique sereine »

Guide de référence pour appliquer le style visuel implémenté sur la page **Mes patients** à
l'ensemble de l'application. Toute nouvelle page ou refonte doit suivre ces règles.

Direction artistique : surfaces **sable** chaudes, primaire **pétrole** (teal), accent **terracotta**,
titres en serif. Sobre, clinique, lisible.

---

## 0. Règle de langue

- **Tout le texte présent sur l'application doit être en français.** Aucun libellé, message,
  placeholder, bouton, info-bulle ou texte d'état visible par l'utilisateur ne doit rester en anglais.
  (Les identifiants de code — variables, props, types — restent en anglais conformément à la section 1
  de `CLAUDE.md`.)

---

## 1. Fondations techniques

- **Stack** : React + Tailwind CSS **v4** (configuration par `@theme` dans `src/index.css`, pas de
  `tailwind.config.js`).
- **Polices** : chargées dans `index.html` via Google Fonts.
  - `Public Sans` → corps de texte (`font-sans`, police par défaut du `body`).
  - `Source Serif 4` → titres de page et marque (`font-serif`).
- **Tokens** : définis une seule fois dans le bloc `@theme` de `src/index.css`. Ne jamais redéfinir
  une couleur en dur si un token existe.

```css
@theme {
  --font-sans: 'Public Sans', system-ui, -apple-system, sans-serif;
  --font-serif: 'Source Serif 4', Georgia, serif;

  /* Pétrole (primaire) */
  --color-petrol-50:  #E4F0EE;  /* fond clair (badges, pastilles, avatars) */
  --color-petrol-100: #C7E2DE;  /* bordure au survol */
  --color-petrol-600: #1F6F6B;  /* primaire (boutons, liens actifs, icônes) */
  --color-petrol-700: #1A5C58;  /* primaire au survol */

  /* Sable (surfaces, bordures neutres) */
  --color-sand-50:  #F7F5F1;  /* fond applicatif */
  --color-sand-100: #F0EDE7;  /* survol discret, fonds secondaires */
  --color-sand-200: #E9E4DC;  /* bordure des cartes / navbar */
  --color-sand-300: #E0DACF;  /* bordure des champs de saisie */
  --color-sand-400: #DED9D0;  /* bordure renforcée */

  /* Encre / texte */
  --color-ink:      #221F1B;  /* titres, texte fort */
  --color-ink-700:  #3D382F;  /* texte de menu */
  --color-taupe-600: #4A453C; /* labels de formulaire */
  --color-taupe-500: #7C746A; /* texte secondaire / muted */
  --color-taupe-400: #A39C90; /* texte tertiaire / placeholders discrets */

  /* Terracotta (accent) */
  --color-terracotta: #BC6A4E; /* pastille de notification, accents */
}
```

### `body` (déjà appliqué)
```css
body {
  font-family: 'Public Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
  background: #F7F5F1;
  color: #221F1B;
}
```

> ⚠️ **Nommage `taupe` et non `stone`.** Tailwind v4 fournit déjà une palette `stone` intégrée :
> nommer notre token `stone` n'en écraserait qu'une partie (collision). On utilise donc **`taupe`**
> pour le texte muted. Ne pas réintroduire `stone-*`.

---

## 2. Palette sémantique (utilitaires Tailwind générés)

| Usage | Classe | Token |
|---|---|---|
| Fond application | `bg-sand-50` | `#F7F5F1` |
| Surface carte | `bg-white` | `#FFFFFF` |
| Survol discret / fond secondaire | `bg-sand-100` | `#F0EDE7` |
| Bordure carte / navbar | `border-sand-200` | `#E9E4DC` |
| Bordure champ de saisie | `border-sand-300` | `#E0DACF` |
| Primaire (bouton, lien actif, icône) | `bg-petrol-600` / `text-petrol-600` | `#1F6F6B` |
| Primaire survol | `hover:bg-petrol-700` | `#1A5C58` |
| Fond clair primaire (badge, avatar) | `bg-petrol-50` | `#E4F0EE` |
| Bordure survol carte | `hover:border-petrol-100` | `#C7E2DE` |
| Titre / texte fort | `text-ink` | `#221F1B` |
| Texte de menu | `text-ink-700` | `#3D382F` |
| Label de formulaire | `text-taupe-600` | `#4A453C` |
| Texte secondaire | `text-taupe-500` | `#7C746A` |
| Texte tertiaire / placeholder | `text-taupe-400` | `#A39C90` |
| Accent notification | `bg-terracotta` | `#BC6A4E` |

### Couleurs d'état (utilisées en dur, hors token car ponctuelles)
| État | Texte | Fond | Bordure |
|---|---|---|---|
| Succès / synchronisé | `#2F7D5B` | `#E6F0EA` | `#CADDD0` |
| Avertissement / en attente | `#9A6A18` | `#F7EFDC` | `#E4D2A6` |
| Erreur / hors ligne / déconnexion | `#B5453C` | `#F6E9E6` | `#E7CEC8` |

> Les erreurs de formulaire conservent la palette Tailwind `red-*` (`text-red-600`, `bg-red-50`,
> `border-red-200`) déjà en place — ne pas la remplacer.

---

## 3. Typographie

| Élément | Classes |
|---|---|
| Titre de page (H1) | `font-serif font-semibold text-[30px] tracking-[-0.015em] text-ink` |
| Sous-titre de page | `text-[14.5px] text-taupe-500` |
| Marque (logo texte) | `font-serif font-semibold text-[17px] tracking-tight text-ink` |
| Titre de carte / section (H2) | `text-[15px] font-semibold text-ink` |
| Label de champ | `text-[12.5px] font-medium text-taupe-600` (ou le `label` du composant `Input`) |
| Corps | `text-sm text-ink` / secondaire `text-taupe-500` |
| Texte d'item de liste | `text-[15px] font-semibold text-ink` (nom), `text-[13px] text-taupe-500` (méta) |

**Règle** : seuls les **titres de page** et la **marque** sont en `font-serif`. Tout le reste est en
`Public Sans` (défaut). Ne pas mettre les titres de carte en serif.

---

## 4. Primitives UI partagées (déjà au thème)

Réutiliser systématiquement les composants de `src/components/ui/`. Ils sont déjà retravaillés :

- **`Button`** — `primary` = pétrole, `secondary` = sable, `ghost` = sable, `danger` = rouge.
  Toujours passer par `<Button variant=… size=…>`, ne pas recréer de bouton primaire en dur.
- **`Input`** — bordure `sand-300`, focus ring `petrol-600`, label `taupe-600`, placeholder `taupe-400`.
- **`Card`** — `bg-white rounded-2xl border border-sand-200 shadow-sm`.

Pour un bouton hors composant (cas rares), reproduire :
```
bg-petrol-600 text-white hover:bg-petrol-700 rounded-lg font-medium
```

---

## 5. Recettes de composants

### Navbar
- Hauteur `h-[60px]`, `bg-white border-b border-sand-200 px-6`.
- Logo : carré `w-[30px] h-[30px] rounded-lg bg-petrol-600 text-white`, lettre « N » en
  `font-serif font-bold text-[15px]`, suivi de la marque en serif.
- Lien actif : `border-petrol-600 text-petrol-600 font-semibold` (soulignement bas 2px).
- Lien inactif : `border-transparent text-taupe-500 font-medium hover:text-ink`.
- Libellés en français : **Mes patients / Mes séances / Mes outils**.

### Avatar (initiales)
```
w-[42px] h-[42px] rounded-full bg-petrol-50 text-petrol-600
flex items-center justify-center font-bold text-sm
```
(Avatar utilisateur navbar : `w-[38px] h-[38px] bg-petrol-600 text-white text-[13px] font-semibold`.)

### Carte d'item cliquable (liste)
```
block w-full text-left rounded-xl border border-sand-200 bg-white px-[18px] py-4
transition-[border-color,box-shadow]
hover:border-petrol-100 hover:shadow-[0_2px_10px_rgba(31,111,107,0.08)]
```
Structure : `flex items-center justify-between` → [avatar + bloc texte] à gauche,
`ChevronRight` (`text-[#C2BBB0]`) à droite.

### En-tête de page
```
flex items-end justify-between gap-4
```
→ à gauche : H1 serif + sous-titre `text-taupe-500` ; à droite : pastille de statut.

### Pastille de statut (pill)
Base : `flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-full` + un point
`w-[7px] h-[7px] rounded-full`. Décliner avec les couleurs d'état (succès / avertissement / erreur).

### Badge « en attente »
```
inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full
bg-[#F7EFDC] text-[#9A6A18] border border-[#E4D2A6]
```
+ icône `Clock` 11px (lucide-react).

### Carte de formulaire
- `Card` en `p-[22px]`.
- En-tête : pastille icône `w-[30px] h-[30px] rounded-lg bg-petrol-50 text-petrol-600` + icône
  lucide (`strokeWidth={1.85}`), suivie du titre `text-[15px] font-semibold text-ink`.
- Champs via `Input`, bouton de soumission `<Button>` (pétrole) aligné à droite.

### Menu déroulant (dropdown)
```
rounded-xl border border-sand-200 bg-white shadow-[0_8px_28px_rgba(45,40,33,0.14)] overflow-hidden
```
Items : `rounded-lg px-2.5 py-2.5 text-[13.5px] hover:bg-sand-50` ; action destructive en
`text-[#B5453C] hover:bg-[#F6E9E6]`.

---

## 6. Mise en page

- **Conteneur principal** (`MainLayout`) : `bg-sand-50`, contenu `max-w-[1040px] mx-auto px-6 py-9`.
- **Grille maître/détail** (formulaire à gauche + liste à droite) :
  `grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start`.
- **Espacement vertical de page** : `flex flex-col gap-7`.
- **Rayons** : cartes `rounded-2xl` (primitive) / items de liste `rounded-xl` / champs & boutons
  `rounded-lg` / pastilles & avatars `rounded-full`.
- **Icônes** : `lucide-react`, taille usuelle `h-4 w-4` (16px) ou `h-5 w-5` (20px) selon le contexte.

---

## 7. Règles de migration (pages restantes)

Les pages **Mes séances**, **Mes outils**, **Mur collaboratif**, **Profil**, etc. héritent déjà des
polices, du fond sable et des primitives `Button`/`Input`/`Card` retravaillées, mais contiennent
encore des classes `slate-*` / `blue-*` dans leur markup. Pour chaque page, remplacer :

| Ancien (à retirer) | Nouveau |
|---|---|
| `bg-slate-50` | `bg-sand-50` |
| `bg-white` (carte) | inchangé (mais préférer la primitive `Card`) |
| `border-slate-200` | `border-sand-200` (carte) / `border-sand-300` (champ) |
| `text-slate-900` | `text-ink` |
| `text-slate-700` | `text-ink-700` ou `text-taupe-600` (label) |
| `text-slate-500` / `text-slate-400` | `text-taupe-500` / `text-taupe-400` |
| `bg-blue-600` / `hover:bg-blue-700` | `bg-petrol-600` / `hover:bg-petrol-700` |
| `text-blue-600` / `text-blue-700` | `text-petrol-600` |
| `bg-blue-50` / `bg-blue-100` | `bg-petrol-50` |
| `focus:ring-blue-500` / `focus-visible:ring-blue-500` | `…ring-petrol-600` |
| Titre de page non-serif | ajouter `font-serif` (+ `text-[30px] tracking-[-0.015em]`) |

**À conserver tel quel** : la palette `red-*` des erreurs, les couleurs d'état succès/avertissement
définies en dur (section 2), et toute logique métier — la migration est **purement visuelle**.

**À ne pas faire** : réintroduire `slate-*` / `blue-*` / `stone-*`, coder une couleur en dur quand un
token existe, mettre des titres de carte en serif, recréer un bouton primaire sans le composant `Button`.

---

## 8. Validation

Après une refonte de page :
- `npx tsc --noEmit -p tsconfig.app.json` (les seules erreurs tolérées sont les 2 préexistantes :
  `LocalDatabase.ts:238` et `ProfileContainer.tsx:60`).
- `npx vite build` doit passer ; vérifier qu'aucune classe `*-slate-*` / `*-blue-*` ne subsiste dans
  le markup de la page migrée.
