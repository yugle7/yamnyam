# Food Diary (`yamnyam`) — Implementation Specification

Working contract for an LLM agent modifying the app. The source code is the final authority for
implementation; this document defines intent, data contracts, invariants, and safe change points.

## 0. Agent Brief

- Static SPA: `index.html`, `style.css`, `script.js`.
- All application logic belongs in `script.js`.
- Foods have two sources: read-only `REFS` (`foods.js`) and editable `foods` (localStorage).
- Main data path: `getActiveFoods()` → search/parser/matching → meal items or recipe ingredients →
  `sumItems()` → diary and statistics.
- Preserve per-100-g nutrition, item grams, custom IDs, archived-food exclusion, and local-first
  behavior.
- Cloud foods are merged only when local foods are missing; duplicate threshold is `0.8`.
- Never save a meal with zero items or any `foodId == null` item.
- Reuse existing sheets, cards, tags, icons, numeric masks, and translations.
- Do not add frameworks, dependencies, modules, or additional JS files.

## 1. Scope and Constraints

### Product

Single-user, offline-first food diary installed as a PWA. The user can:

- record meals by text parsing, voice, photo, search, or quick picks;
- track calories, macros, micronutrients, health score, water, sleep, steps, and weight;
- create/edit/archive custom products, dishes, and recipes;
- view diary history and 12 statistics charts for day/week/month;
- export/import all local data;
- optionally sync meal photos to remote storage.

Out of scope: accounts, cross-device sync, barcode scanning, social features, medical advice,
server-side meal storage.

### Hard rules

- Vanilla HTML/CSS/JS only; no build step, package manager, imports, or external libraries.
- Keep all logic in `script.js`.
- Preserve existing file structure and script order:
  `foods.js` → `data.js` → `script.js`.
- New user-facing text belongs in both RU/EN translation sets. Existing hardcoded `OK` controls are
  intentional.
- Preserve existing layout, UI patterns, data compatibility, and behavior unless explicitly changed.
- Avoid `??`/`??=`; use explicit null checks in the current style.
- Do not leave temporary test files or servers behind.

### Files

| File | Role |
| --- | --- |
| `index.html` | App shell, pages, sheets, dialogs, nav |
| `style.css` | Layout, components, themes |
| `script.js` | State, logic, rendering |
| `data.js` | RU/EN translations, defaults |
| `foods.js` | Reference foods (`window.REFS`) |
| `sprite.svg` | Shared icons |
| `sw.js` | Service worker/cache |
| `manifest.webmanifest` | PWA metadata |
| `privacy.html` | Privacy page |

## 2. Architecture and State

```text
REFS + foods
   ↓
getActiveFoods()
   ↓
match/rank/parse/search
   ↓
meal.items / recipe.ingredients
   ↓
sumItems()
   ↓
diary, stats, totals
```

Runtime state:

```js
REFS              // read-only reference foods
foods             // custom and cloud foods
meals             // saved meals
person            // body data, goals, targets
logs              // water, sleep, steps, weight arrays
meal              // current meal draft or null
dish              // current food editor state or null
S, lang           // translations and language
favorites, recents, tags
```

On boot: choose RU/EN from `navigator.language`, apply translations, compute `REFS` health scores,
load local data, render today, open IndexedDB photos, garbage-collect photos, start optional sync.

### Canonical terms

| Term | Meaning |
| --- | --- |
| Active food | Non-archived custom/cloud food or any `REFS` food |
| Resolved item | Meal item with a non-null `foodId` |
| Unresolved item | Meal item with `foodId == null`; red card |
| Fragment | Temporary normalized parser key on a draft item |
| Food editor | `#dish-page`, the product/dish/recipe form/detail view |
| Search sheet | Normal search |
| Quick sheet | Search opened by the star icon |
| Cloud food | Food returned by the cloud function and merged into `foods` |

### Conventions

- Timestamps are milliseconds.
- Day key is `YYYYMMDD` from `getDateKey(date)`.
- Dates/times are local.
- `parseNumber` accepts comma/dot; blank/invalid → `null`.
- Display decimals use a comma.
- Inputs use bounded numeric masks.

## 3. Data Contracts

### Food

```js
{
  id, kind: "product" | "dish" | "recipe",
  ru, en, aliases: [],
  nutrition: { calories, protein, fat, carbs, fiber, sugar, freeSugar, salt, satFat, transFat },
  micro: { vitaminA, vitaminC, vitaminD, vitaminE, vitaminK, vitaminB6, vitaminB12,
           folate, calcium, iron, potassium, magnesium, zinc } | null,
  ingredients: [{ foodId, grams }],
  yieldGrams: number | null,
  servingGrams, pieceGrams: number | null,
  healthScore: number | null,
  tags: [], custom: boolean, archived: boolean
}
```

- Nutrition is per 100 g.
- `servingGrams` is the default search portion.
- `pieceGrams` is used for piece conversion; fallback is serving grams.
- `ingredients` is non-empty only for app-created recipes.
- Custom/cloud IDs start at `1_000_000`.
- Cloud foods MUST arrive in this exact shape; do not remap field names.
- Archived foods are excluded from active search, favorites, and quick picks.

### Meal and item

```js
meal = {
  created, eaten, key, type: 0|1|2|3,
  items, tags, photoId: number|null, note
}

item = {
  foodId: number|null, name, grams,
  nutrition: Nutrition|null, micro: Micro|null,
  healthScore: number|null, fragment?: string
}
```

Meal types: `0 snack`, `1 breakfast`, `2 lunch`, `3 dinner`.

- `meal.created` is the meal identity.
- `fragment` exists only on draft parsed items and is stripped before save.
- Item nutrition is a snapshot; historical meals remain stable if foods change.
- Unresolved means `foodId == null`.

### Person, logs, misc

```js
person = {
  sex: 0|1, birthdate: YYYYMMDD|0, height, weight, activity,
  targets: { sleep, steps, water, weight },
  goals: { calories, protein, fat, carbs, fiber, sugar, salt, satFat },
  manual: []
}

log = { key: YYYYMMDD, date, value }
```

- Logs are separate arrays: water, sleep, steps, weight.
- One value per day per log; editing replaces it.
- Recents: up to 50 unique `{foodId, grams, date}`, newest first.
- Favorites: food IDs.
- Tags: strings; defaults come from the active translations.
- Photo record (IndexedDB): `{id, blob, mime, width, height, size, status, attempts,
  objectKey, createdAt}`.

## 4. Storage and Lifecycle

localStorage keys:

```text
meals, foods, person, weight, water, sleep, steps, tags, favorites, recents
```

Photo DB: IndexedDB `FoodDiaryPhotos`, store `photos`.

- `saveMeals()` sorts by `eaten` and invalidates calendar caches.
- `savePerson()` recalculates derived goals/targets before writing.
- Read errors use fallbacks and warn; write errors show a localized storage error.
- Invalidate derived caches (`foodsCounter`, `calendarPages`) when inputs change.
- A saved meal is cloned before editing so cancel does not mutate storage.

## 5. Food Matching and Ranking

Active list:

```js
[...foods.filter(f => !f.archived), ...REFS]
```

Normalization: lowercase, `ё→е`, remove punctuation, split hyphens/whitespace, Russian stemming,
basic English plurals. Match against `ru`, `en`, and aliases.

`rankFoods(query, activeFoods)`:

- empty query → `[]`;
- keep candidates with confidence `>= 0.5`;
- sort by confidence, custom-over-reference, favorite, usage frequency, shorter name.

`matchFood` returns the top candidate or `null`.

Limits:

- normal search: 50 results;
- empty query: alphabetical, except Recent/Frequent quick lists;
- recent/frequent quick lists: 10 items each.

## 6. Cloud Food Enrichment

### Request

```text
CLOUD_FOOD_API_URL = https://functions.yandexcloud.net/GET_MEAL_FUNCTION_ID
GET <url>?query=name1,name2
```

- One request per batch.
- URL-encode each name, join with literal commas.
- Remove empty/duplicate names.

### Response

JSON array of complete Food objects.

- Non-array, non-2xx, invalid JSON, or network error → `[]`.
- Failure is silent and MUST NOT interrupt the current flow.

### Merge

```js
mergeCloudFoods(cloudFoods):
  active = getActiveFoods()
  for each food:
    if matchFood(food[lang], active).confidence >= 0.8: skip
    food.id = nextFoodId()
    foods.push(food)
    active.push(food)
  save once if anything was added
```

- Store returned food objects as-is except for the new local ID.
- Do not convert nutrition/micro/name fields.
- Duplicate check uses the active local list and newly added foods.

### Triggers and guards

Search:

- Query non-empty, no local results, not quick mode, tab `all` or `product`.
- Ineligible tabs: dish, recipe, quick tabs.
- `cloudSearchKey` prevents repeating the same `tab:query` request.
- Reset key on open, query change, or tab change.
- On merge success, rerender through normal local search.

Meal:

- After parse, collect unique unresolved item names.
- One request for all names.
- `cloudMealNames` prevents repeating the same name set.
- `cloudToken` invalidates stale requests after parse/meal changes.
- On merge success, rerun `applyParse()` so normal matching resolves items.
- Loop terminates because equal name sets skip, empty name sets skip, and zero additions do not
  trigger reparse.

## 7. Search

Opening:

- `icon-search` → normal search for a meal or ingredient.
- `icon-star` → quick picks.
- `icon-plus` → blank food editor.

Normal tabs: `all`, `product`, `dish`, `recipe`.

Quick tabs: `recent`, `frequent`, `favorites`, `my`.

- My = all non-archived custom foods.
- Quick favorites live under the star tab; there is no normal favorites tab.
- Active tab has an accent underline.

Results show localized name, calories/100 g, health bar, and a favorite-star button.

Selection:

- Clicking a result adds it to the current meal or recipe.
- Recent quick result uses saved grams; otherwise serving grams or 100 g.
- Favorite star toggles favorites without selecting.
- Search result cards do not open the editor directly.

Ingredient search excludes the recipe being edited.

## 8. Meal Page and Parser

### Header and controls

- Date/time via picker.
- New meal type from hour: 05–10 breakfast, 11–15 lunch, 16–20 dinner, otherwise snack.
- Type button cycles breakfast → lunch → dinner → snack.
- `meal-text` max 200 chars; parse after 400 ms; Enter flushes and blurs.
- Camera: one meal photo.
- Mic: append speech and parse.
- Search: normal search.
- Star: quick picks.
- Plus: blank food editor.

### Parsing

Split fragments on:

- semicolon, newline;
- comma not between digits;
- `and`, `with`, `и`, `с`, `со`;
- `+`.

If a whole fragment matches locally at `>= 0.9`, do not split it further.

`parseQuantity`:

- first number; comma/dot decimals;
- optional unit; strip quantity from name;
- no unit + count ≤ 20 → pieces;
- no unit + count > 20 → grams;
- no number + countable unit → one unit.

| Unit | Grams |
| --- | ---: |
| g, ml | 1 |
| kg, l | 1000 |
| piece | `pieceGrams || servingGrams || 100` |
| tsp | 5 |
| tbsp | 15 |
| cup | 200 |
| serving | `servingGrams || 100` |

Grams are rounded and at least 1.

### Draft items

Each fragment becomes a resolved item (best local match) or unresolved red card.

`applyParse` preserves by `fragment`:

- same fragment → keep old item and adjusted grams;
- old unresolved + new resolved → use new food, keep old grams and fragment;
- otherwise → parsed item.

Interactions:

- resolved card → portion sheet;
- unresolved card → create food with name prefilled; save uses replace and preserves grams;
- Enter/Space mirrors click;
- unresolved save flashes the first red card.

### Save

`saveMeal()`:

- strip fragments;
- snapshot tags and note;
- insert or replace by `created`;
- save meals, update recents, delete replaced photo if needed;
- return to diary at meal date.

Blocks:

- no items → disabled;
- any unresolved item → block.

Cancel discards new photos. Delete uses confirmation.

Tags: global strings; food tags can auto-add to the meal. Note max 280 chars and auto-opens when
non-empty.

## 9. Food Editor / Recipes

Modes: create, edit, replace unresolved meal item, ingredient view (return to recipe).

Kinds: product, dish, recipe.

Fields:

- name (max 80), serving grams (max 5000), recipe yield (max 5000);
- basis: per 100 g or per serving;
- calories/protein/fat/carbs;
- optional fiber/sugar/salt/freeSugar/satFat/transFat;
- 13 micronutrients in amount or %DV mode;
- ingredients (recipe);
- tags.

Validation:

- product/dish: name required, basis > 0, protein+fat+carbs ≤ 100 g;
- recipe: name required, at least one ingredient, total grams > 0;
- missing nutrition inputs are 0; calories may be 0.

Recipe calculation:

```text
sum nutrient += food.nutrition[k] * grams / 100
sum grams += grams
per-100g = total / (yieldGrams || total grams)
```

- Recipe macro/micro fields are read-only and update live.
- More than one ingredient shows total macros and grams.
- Serving placeholder is yield when available, else 100.

Save:

- new food gets `nextFoodId()`;
- existing food keeps ID;
- build complete Food, save, then close to meal/recipe/return.

Archive sets `archived: true`, removes from favorites, saves; historical meal items stay.

Name matching:

- new products do not auto-search `REFS` while typing;
- editing an existing non-recipe food may prefill from `REFS` after a match;
- preserve this behavior unless asked.

## 10. Portion Sheet

Opened from a resolved meal item or recipe ingredient.

- title, grams input, minus/plus, create/delete/OK;
- max 5000 g, min 1 on save;
- step = serving grams or 100;
- OK saves and recalculates recipe if ingredient;
- delete removes item/ingredient;
- unknown item can open creation.

Portion title click:

- reads stored food ID;
- closes portion sheet;
- opens food editor/detail page.
- from a recipe ingredient: snapshot and restore the recipe form on close; do not add the ingredient
  again.

## 11. Diary and Logs

Calendar:

- Monday-first, swipe/arrow month navigation;
- future dates muted; selected date enlarged;
- health-colored mark scaled by calories vs goal;
- normalization/streak text above month;
- date click rerenders day.

Day view:

- rings for calories/protein/fat/carbs;
- rings for weight/steps/sleep/water; click opens log editor;
- meal cards show time, type, tags, names, calories, photo indicator, health bar;
- meal click opens an editing clone;
- daily micro bars show %DV;
- empty state when no meals.

Logs:

- water, sleep, steps, weight;
- one value per day; minus/plus with bounds/step;
- weight update also updates profile and person rendering.

## 12. Statistics

Periods: day, week (default), month; previous/next range; period change resets to today.

| Chart ID | Content |
| --- | --- |
| `calories-chart` | Intake, target, 7-day average in week view |
| `macros-chart` | Stacked protein/fat/carbs |
| `balance-chart` | Macro imbalance in kcal |
| `meal-type-chart` | Calories by meal type |
| `water-chart` | Water bars vs target |
| `health-chart` | Health score and average |
| `nutrient-chart` | Fiber/sugar/salt/satFat; grams or % goal |
| `weight-chart` | Weight, trend, range change |
| `sleep-chart` | Sleep bars vs target |
| `steps-chart` | Steps bars vs target |
| `hour-heatmap` | 7×24 weekday/hour calories |
| `micro-chart` | Micronutrient %DV bars |

`nutrient-mode` toggles grams/% for the nutrient chart. Charts are SVG, responsive on resize, and
use the shared hover/tap tooltip.

## 13. Profile, Goals, Health

Fields: birthdate, sex, height, weight, activity.

Activity levels: `1.20, 1.375, 1.55, 1.725, 1.90`; slider supports 1.0–2.0 and labels nearest.

Automatic goals:

```text
BMR = 10*weight + 6.25*height - 5*age + (sex ? +5 : -161)
calories = max(1200, BMR * activity)
protein = weight * 1.6
fat = calories / 30
carbs = max(0, (calories - protein*4 - fat*9) / 4)
fiber = calories * 0.014
sugar = calories / 40
salt = 0.92 + 0.0023 * calories
satFat = calories / 90
```

Age defaults to 30.

Targets:

```text
sleep: 15.5 / 13.5 / 12.5 / 11.5 / 10 / 9 / 8 / 7.5 by age bands
steps: clamp(8000 + 10*(MIST - 360), 5000, 12000)
MIST = 675.113 + 66.165*sex - 5.353*age - 6.593*bmi
bmi = 10000*weight / height^2
water = weight * 30 ml
weight target = current weight
```

Manual override: editing a calculated field adds its key to `person.manual`; accent label; tapping
the label restores automatic values.

Health score:

```text
unsatFat = max(0, fat - satFat - transFat)
microCoverage = Σ min(micro[k] / MICRO_NORMALS[k], 1)
score = 90
  - 10*clamp(calories/800)
  - 30*clamp(freeSugar/10)
  - 15*clamp(satFat/10)
  - 20*clamp(salt/2)
  +  8*clamp(fiber/8)
  +  4*clamp(protein/25)
  + 10*clamp(unsatFat/70)
  +  5*clamp(microCoverage/3)
```

Round and clamp to 0–100. `healthColor(score)` supplies the gradient.

## 14. Photos

- One optional meal photo.
- Compress JPEG: max width 1280, quality 0.82.
- IndexedDB is primary storage.
- Optional remote sync via `window.PHOTO_API_URL` presigned `put`/`get`/`delete`.
- Upload retries up to 5, then error.
- Delete uses a local tombstone + remote delete.
- Unreferenced photos are garbage-collected.
- Photos are hidden if IndexedDB is unavailable.
- Photos are not exported.

## 15. Settings, Import, Export, Reset

Export `yamnyam-YYYYMMDD.json`:

```js
{app:"yamnyam", exported, meals, foods, person,
 weight, water, sleep, steps, tags, favorites, recents}
```

Photos excluded.

Import validates:

- `app === "yamnyam"`;
- finite person sex/height/weight/activity/birthdate;
- required arrays;
- meals with finite `created`/`eaten` and array items.

Import replaces storage, reloads state, returns to today, GC photos. Reset clears storage and
photos, reloads defaults.

Settings also includes support, mail, and privacy links.

## 16. PWA, Localization, UI

PWA:

- standalone portrait install; maskable icons;
- service worker pre-caches shell and `foods.js`;
- separate food cache;
- network-first navigation; cache-first static assets;
- non-GET/cross-origin requests pass through;
- cache versions: `CODE_VERSION` (shell/assets), `REFS_VERSION` (`foods.js`);
- app works offline after first load; cloud/photo remote actions need network;
- day rolls over when tab becomes visible.

Localization/UI:

- language from browser only, no switch;
- new text in both RU/EN;
- plural functions for counts;
- light default, dark via `prefers-color-scheme`;
- safe-area and `dvh`;
- role/tabindex/keyboard for clickable cards/titles;
- dialogs `role="dialog"` + `aria-modal`;
- existing numeric masks and input modes.

Known intentional UI facts:

- Search results have a favorite star, not an edit button.
- Search has no footer/Create action; plus opens a blank product.
- Only meal photos exist; no food/dish photos.
- Portion title opens the food editor; ingredient view restores the recipe.
- Hardcoded shared `OK` labels are intentional.

## 17. Failure Handling

| Failure | Result |
| --- | --- |
| localStorage read | fallback + warning |
| localStorage write | localized storage error |
| Cloud request/JSON | empty result, silent |
| Photo save | localized photo error |
| Photo sync | retry up to 5, then error |
| Missing food | unresolved/empty |
| Unresolved meal save | blocked, first red card flashes |
| Offline | local diary continues |

## 18. Agent Map

### Key DOM

```text
pages: diary-page, meal-page, dish-page, stats-page, person-page, settings-page
sheets: search-sheet, portion-sheet, tags-sheet, when-picker, log-sheet
shell: modal, overlay, nav-bar
meal: meal-text, confirm, cancel, meal-items, meal-total, meal-note
actions: icon-photo, icon-voice, icon-search, icon-star, icon-plus
search: search-input, search-tabs, search-results, search-back, search-clear
portion: portion-title, portion-grams, portion-minus, portion-plus,
         portion-create, portion-delete, portion-confirm
editor: dish-name, dish-kind, dish-basis, dish-serving-grams, dish-yield,
        dish-calories, dish-protein, dish-fat, dish-carbs,
        dish-micro, dish-micro-fields, dish-micro-mode, ingredients-list,
        add-ingredient, dish-tags, dish-save, dish-cancel
stats: period, range, nutrient-mode
```

### Key functions

| Function | Role |
| --- | --- |
| `findFood` | custom first, then REFS |
| `getActiveFoods` | active list |
| `matchScore` / `rankFoods` / `matchFood` | matching |
| `fetchCloudFoods` / `mergeCloudFoods` | cloud |
| `parseMeal` / `applyParse` / `loadCloudItems` | parsing |
| `makeItem` / `sumItems` | item snapshot/aggregation |
| `computeHealth` | health score |
| `openSearch` / `renderSearchResults` / `pickFood` | search |
| `openPortion` / `savePortion` / `openPortionDetails` | portion |
| `openDishPage` / `readDish` / `closeDishPage` | editor |
| `renderDiary` / `renderDay` / `openMeal` / `saveMeal` | diary/meal |
| `renderStats` / `renderPerson` | stats/profile |
| `loadAll` / `save*` | persistence |
| `syncPhotos` / `gcPhotos` | photos |

### Change map

- UI: `index.html` + localized strings + refs/handlers in `script.js`; reuse existing classes.
- Food field: schema, editor, `makeItem`, `sumItems`, persistence; check old data.
- Parser: `splitFragments`, `parseQuantity`, `unitOf`, `toGrams`, `applyParse`.
- Search: `SEARCH_TABS`, `QUICK_TABS`, `searchActiveFoods`, `searchFoods`, `resultHtml`,
  `renderSearchResults`, `pickFood`.
- Cloud: `fetchCloudFoods`, `mergeCloudFoods`, search trigger, meal trigger; preserve triggers,
  comma batching, array response, `0.8` duplicate threshold, silent failure.
- Stats: `getRange`, `getBuckets`, chart renderers, `renderStats`.
- Translation: both `data.js` languages; use `data-i18n*`.
- Icons: add `<symbol>` in `sprite.svg`; use `sprite.svg#id`; no inline duplicate paths.

## 19. Verification and Acceptance

Static checks:

```bash
node --check script.js
node --check data.js
node --check foods.js
git diff --check
```

Browser smoke test:

1. `python3 -m http.server 8765 --bind 127.0.0.1`
2. Open `index.html` in headless Chrome.
3. Drive a temporary iframe harness through `contentWindow.eval`.
4. Remove the harness and stop the server.

Smoke flows: parse known/unknown foods; create unknown; local/cloud search; save meal; portion
save/delete; product/dish/recipe; recipe yield; stats day/week/month; export/import/reset; RU/EN and
light/dark.

Complete when:

1. Requested behavior works.
2. Existing meal/search/parser flows still work.
3. Local results win before cloud.
4. Cloud duplicates are skipped at `0.8`.
5. Unresolved meals remain blocked.
6. Recipe totals use ingredients and yield.
7. Diary/stats totals stay consistent.
8. Photos stay local-first with optional sync.
9. Export/import/reset remain correct.
10. New UI is translated.
11. Static checks and `git diff --check` pass.
12. No unrelated files/behavior changed.

## 20. Configuration

| Setting | Location |
| --- | --- |
| Cloud food endpoint | `CLOUD_FOOD_API_URL` in `script.js` |
| Photo API | `window.PHOTO_API_URL` before `script.js` |
| Reference foods | `foods.js` |
| Translations/default tags | `data.js` |
| Static cache version | `CODE_VERSION` in `sw.js` |
| Food cache version | `REFS_VERSION` in `sw.js` |
| PWA metadata/icons | `manifest.webmanifest` |
| Photo DB | `FoodDiaryPhotos` |
| Export app ID | `"yamnyam"` |
