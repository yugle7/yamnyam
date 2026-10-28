// ==========================================================================
// 1. CONSTANTS
// ==========================================================================

const APP_NAME = "num-num";

const NUTRIENT_KEYS = [
    "calories",
    "protein",
    "fat",
    "carbs",
    "fiber",
    "sugar",
    "salt",
    "satFat",
    "freeSugar",
    "transFat",
];

const MICRO_KEYS = [
    "vitaminA",
    "vitaminC",
    "vitaminD",
    "vitaminE",
    "vitaminK",
    "vitaminB6",
    "vitaminB12",
    "folate",
    "calcium",
    "iron",
    "potassium",
    "magnesium",
    "zinc",
];

// FDA Daily Values
const MICRO_NORMALS = {
    vitaminA: 900,
    vitaminC: 90,
    vitaminD: 20,
    vitaminE: 15,
    vitaminK: 120,
    vitaminB6: 1.7,
    vitaminB12: 2.4,
    folate: 400,
    calcium: 1300,
    iron: 18,
    potassium: 4700,
    magnesium: 420,
    zinc: 11,
};

const MICRO_UNITS = {
    vitaminA: "µg",
    vitaminC: "mg",
    vitaminD: "µg",
    vitaminE: "mg",
    vitaminK: "µg",
    vitaminB6: "mg",
    vitaminB12: "µg",
    folate: "µg",
    calcium: "mg",
    iron: "mg",
    potassium: "mg",
    magnesium: "mg",
    zinc: "mg",
};

const KCAL_PER_GRAM = {protein: 4, fat: 9, carbs: 4};

const SNACK = 0;
const BREAKFAST = 1;
const LUNCH = 2;
const DINNER = 3;

const DAY = 0;
const WEEK = 1;

const MAX_GRAMS = 5000;
const DEFAULT_SERVING = 100;

const MEAL_TYPES = [BREAKFAST, LUNCH, DINNER, SNACK];
const PHOTO_MAX_WIDTH = 1280;
const PHOTO_QUALITY = 0.82;

const DEFAULT_PERSON = {
    sex: 1,
    birthdate: 0,
    height: 175,
    weight: 70,
    activity: 1.375,
    manual: []
};

const LOGS = {
    water: {
        max: 10000,
        decimals: 0,
        step: 200,
    },
    sleep: {
        max: 24,
        decimals: 1,
        step: 0.5,
    },
    steps: {
        max: 100000,
        decimals: 0,
        step: 500,
    },
    weight: {
        max: 500,
        decimals: 1,
        step: 0.1,
    },
};

const STORAGE_KEYS = [
    "meals",
    "foods",
    "person",
    "weight",
    "water",
    "sleep",
    "steps",
    "tags",
    "favorites",
    "recents",
];

// ==========================================================================
// 2. EXTERNAL DATA
// ==========================================================================

const REFS = Array.isArray(window.REFS)
    ? window.REFS
    : (console.warn("window.REFS is not an array, food base is empty"), []);
const translations = window.TRANSLATIONS || {};
const PHOTO_API_URL = window.PHOTO_API_URL || "";

// ==========================================================================
// 3. STATE
// ==========================================================================

let S = {};
let lang = "en";

let person;
let meals = [];
let foods = [];
let tags = [];

let favorites = [];
let recents = [];

const logs = {
    water: [],
    sleep: [],
    steps: [],
    weight: [],
};

let date = new Date();
let today = new Date(date);

let calendarDate = new Date(date);
let calendarPages = {};
let chosenButton = null;

let page = null;
let link = null;

// ==========================================================================
// 4. UTILS
// ==========================================================================

const $ = (id) => document.getElementById(id);

const pad = (n, d = 2) => String(n).padStart(d, "0");
const getDateKey = (d) => {
    d = new Date(d);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};
const getTimeText = (d) => {
    d = new Date(d);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const getDateText = (d) => {
    d = new Date(d);
    return `${d.getDate()} ${S.mons[d.getMonth()]}`;
};

const startOfDay = (d) => {
    d = new Date(d);
    d.setHours(0, 0, 0, 0);
    return d;
};

const addDays = (d, n) => {
    d = new Date(d);
    d.setDate(d.getDate() + n);
    return d;
};

const getMonday = (d) => {
    const x = startOfDay(d);
    const day = x.getDay();
    x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
    return x;
};

const getWeekday = (d) => (new Date(d).getDay() + 6) % 7;

const round = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;

const fmt = (x, d = 0) => (x ? String(round(x, d)).replace(".", ",") : "0");

const clean = (s) =>
    String(s)
        .normalize("NFKC")
        .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ")
        .replace(/\s+/gu, " ")
        .trim()
        .slice(0, 100);

const norm = (s) =>
    s.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const debounce = (fn, ms) => {
    let timer = null;
    let lastArgs = [];
    const call = (...args) => {
        lastArgs = args;
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
    call.flush = () => {
        if (timer === null) return;
        clearTimeout(timer);
        timer = null;
        fn(...lastArgs);
    };
    return call;
};

const emptyNutrition = () => Object.fromEntries(NUTRIENT_KEYS.map(k => [k, 0]));
const emptyMicro = () => Object.fromEntries(MICRO_KEYS.map(k => [k, 0]));

// ==========================================================================
// 5. CALCULATIONS
// ==========================================================================

const sumItems = (items) => {
    if (!items.length) return null;

    const dst = {
        grams: 0,
        ...emptyNutrition(),
        micro: emptyMicro(),
        healthScore: null,
    };
    const healthScore = {
        calories: 0,
        grams: 0,
    };
    const weight = {
        calories: 0,
        grams: 0,
    };

    for (const item of items) {
        const g = item.grams / 100;
        dst.grams += item.grams;

        if (item.nutrition)
            NUTRIENT_KEYS.forEach((k) => (dst[k] += (item.nutrition[k] || 0) * g));

        if (item.micro)
            MICRO_KEYS.forEach((k) => (dst.micro[k] += (item.micro[k] || 0) * g));

        if (item.healthScore) {
            const calories = item.nutrition.calories * g;
            weight.calories += calories;
            healthScore.calories += item.healthScore * calories;
            weight.grams += item.grams;
            healthScore.grams += item.healthScore * item.grams;
        }
    }

    if (weight.calories) dst.healthScore = healthScore.calories / weight.calories;
    else if (weight.grams) dst.healthScore = healthScore.grams / weight.grams;
    return dst;
};

const clamp = (x, min = 0, max = 1) => Math.min(max, Math.max(min, x));

const computeHealth = (nutrition, micro = {}) => {
    let {calories, protein, fat, fiber, freeSugar, salt, satFat, transFat} = nutrition;
    const unsatFat = Math.max(0, fat - satFat - transFat);

    const microCoverage = Object.entries(micro).reduce(
        (s, [k, v]) => s + Math.min(v / MICRO_NORMALS[k], 1),
        0,
    );

    const s =
        90 -
        10 * clamp(calories / 800) -
        30 * clamp(freeSugar / 10) -
        15 * clamp(satFat / 10) -
        20 * clamp(salt / 2) +
        8 * clamp(fiber / 8) +
        4 * clamp(protein / 25) +
        10 * clamp(unsatFat / 70) +
        5 * clamp(microCoverage / 3);

    return Math.round(Math.max(0, Math.min(100, s)));
};

const healthColor = (score) => {
    const s = score / 50;
    const r = s < 1 ? 200 : 330 - 130 * s;
    const g = 120 + 50 * s;
    const b = s < 1 ? 120 - 40 * s : 40 + 40 * s;
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
};

const getAge = (birthdate) => {
    if (!birthdate) return 30;
    const Y = Math.floor(birthdate / 10000);
    const M = Math.floor(birthdate / 100) % 100;
    const D = birthdate % 100;
    const now = new Date();
    const m = now.getMonth() + 1 - M;
    const age = now.getFullYear() - Y - (m < 0 || (m === 0 && now.getDate() < D));
    return Math.min(120, Math.max(0, age));
};

const getGoals = ({sex, age, height, weight, activity}) => {
    const calories = Math.max(
        1200,
        (10 * weight + 6.25 * height - 5 * age + (sex ? 5 : -161)) * activity,
    );
    const protein = weight * 1.6;
    const fat = calories / 30;
    const carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);
    const salt = 0.92 + 0.0023 * calories;
    return {
        calories,
        protein,
        fat,
        carbs,
        fiber: calories * 0.014,
        sugar: calories / 40,
        salt,
        satFat: calories / 90
    };
};

const getSleep = age =>
    age < 0.33 ? 15.5 :
        age < 1 ? 13.5 :
            age < 3 ? 12.5 :
                age < 6 ? 11.5 :
                    age < 14 ? 10 :
                        age < 18 ? 9 :
                            age < 65 ? 8 :
                                7.5;

const getMistPredictedSteps = (age, sex, weight, height) => {
    const bmi = 10000 * weight / (height * height);
    return Math.round(675.113 + (66.165 * sex) - (5.353 * age) - (6.593 * bmi));
}

const getSteps = (age, sex, weight, height) => {
    const mist = getMistPredictedSteps(age, sex, weight, height);
    const goal = 8000 + 10 * (mist - 360);
    return clamp(goal, 5000, 12000);
};

const getTargets = ({age, sex, weight, height}) => ({
    sleep: getSleep(age),
    steps: getSteps(age, sex, weight, height),
    water: Math.round(weight * 30),
    weight,
});

const updatePerson = () => {
    person.age = getAge(person.birthdate);
    const goals = getGoals(person);
    const targets = getTargets(person);

    person.manual.forEach(key => {
        if (key in goals) goals[key] = person.goals[key];
        else targets[key] = person.targets[key];
    });
    person.targets = targets;
    person.goals = goals;
};

const linearRegression = (points) => {
    const n = points.length;
    if (n < 2) return null;
    const mx = points.reduce((s, p) => s + p.x, 0) / n;
    const my = points.reduce((s, p) => s + p.y, 0) / n;
    let sxx = 0;
    let sxy = 0;
    points.forEach(({x, y}) => {
        sxx += (x - mx) ** 2;
        sxy += (x - mx) * (y - my);
    });
    if (!sxx) return null;
    const b = sxy / sxx;
    return {a: my - b * mx, b};
};

const computeFromIngredients = (ingredients, yieldGrams) => {
    const dst = {
        grams: 0,
        nutrition: emptyNutrition(),
        micro: emptyMicro(),
    };

    for (const {foodId, grams} of ingredients) {
        const f = findFood(foodId);
        if (!f) continue;
        dst.grams += grams;
        NUTRIENT_KEYS.forEach(k => (dst.nutrition[k] += (f.nutrition[k] || 0) * grams),);
        MICRO_KEYS.forEach(k => (dst.micro[k] += (f.micro[k] || 0) * grams));
    }

    const g = 1 / (yieldGrams || dst.grams);
    for (const k of NUTRIENT_KEYS) dst.nutrition[k] *= g;
    for (const k of MICRO_KEYS) dst.micro[k] *= g;

    return dst;
};

// ==========================================================================
// 6. PRODUCTS AND SEARCH
// ==========================================================================

const findFood = (id) =>
    id == null
        ? null
        : foods.find((f) => f.id === id) || REFS.find((f) => f.id === id) || null;

const prepareRefs = () => {
    REFS.forEach((f) => {
        f.healthScore = computeHealth(f.nutrition, f.micro);
    });
};

const normalizeWord = (w) => {
    w = w.toLowerCase().replace(/ё/g, "е");

    if (/[а-я]/.test(w)) {
        for (const e of ruEndings) {
            if (w.length - e.length >= 3 && w.endsWith(e)) return w.slice(0, -e.length);
        }
        return w;
    }
    if (/(o|x|ch|sh|ss)es$/.test(w) && w.length >= 5) return w.slice(0, -2);
    if (/[^aeiou]ies$/.test(w) && w.length >= 6) return w.slice(0, -3) + "y";
    if (w.endsWith("s") && !w.endsWith("ss") && w.length >= 4) return w.slice(0, -1);
    return w;
};

const normalizePhrase = s => s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s-]/g, " ")
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(normalizeWord)
    .join(" ");

const levenshtein = (a, b) => {
    if (a.length < b.length) [a, b] = [b, a];
    let prev = Array.from({length: b.length + 1}, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++)
            cur[j] = Math.min(
                prev[j] + 1,
                cur[j - 1] + 1,
                prev[j - 1] + (a[i - 1] !== b[j - 1]),
            );
        prev = cur;
    }
    return prev[b.length];
};

const similarity = (a, b) =>
    a === b ? 1 : 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

const phraseSimilarity = (a, b) => {
    if (a === b) return 1;

    const aWords = a.split(" ");
    const bWords = b.split(" ");
    const pairs = [];

    for (let i = 0; i < aWords.length; i++)
        for (let j = 0; j < bWords.length; j++)
            pairs.push([similarity(aWords[i], bWords[j]), i, j]);

    pairs.sort((a, b) => b[0] - a[0]);

    const usedA = new Set();
    const usedB = new Set();
    let total = 0;

    for (const [s, i, j] of pairs) {
        if (usedA.has(i) || usedB.has(j)) continue;
        total += s;
        usedA.add(i);
        usedB.add(j);
    }

    const words = (2 * total) / (aWords.length + bWords.length);
    return 0.9 * words + 0.1 * similarity(a, b);
};

const keysCache = new WeakMap();

const foodKeys = (f) => {
    let keys = keysCache.get(f);
    if (!keys) {
        keys = [
            ...new Set(
                [f.ru, f.en, ...(f.aliases || [])]
                    .filter(Boolean)
                    .map(normalizePhrase)
                    .filter(Boolean),
            ),
        ];
        keysCache.set(f, keys);
    }
    return keys;
};

const matchScore = (food, query) => {
    if (!query) return 0;

    let score = 0;
    for (const key of foodKeys(food))
        score = Math.max(score, phraseSimilarity(key, query));
    return score;
};

let foodsCounter;

const updateFoodsCounter = () => {
    if (foodsCounter) return;
    foodsCounter = new Map();
    meals.forEach((m) =>
        m.items.forEach(({foodId}) => {
            if (foodId != null)
                foodsCounter.set(foodId, (foodsCounter.get(foodId) || 0) + 1);
        }),
    );
};

const getActiveFoods = () => [...foods.filter((f) => !f.archived), ...REFS];

// Candidate comparison: confidence, custom food, favorites, frequency, shorter name
const compareFoodMatches = (a, b) => {
    updateFoodsCounter();
    return (
        b.confidence - a.confidence ||
        b.food.custom - a.food.custom ||
        favorites.includes(b.food.id) - favorites.includes(a.food.id) ||
        (foodsCounter.get(b.food.id) || 0) - (foodsCounter.get(a.food.id) || 0) ||
        a.food[lang].length - b.food[lang].length
    );
};

const rankFoods = (query, activeFoods = getActiveFoods()) => {
    query = normalizePhrase(query);
    if (!query) return [];
    return activeFoods
        .map((food) => ({food, confidence: matchScore(food, query)}))
        .filter((m) => m.confidence >= 0.5)
        .sort(compareFoodMatches);
};

const matchFood = (text, activeFoods) => rankFoods(text, activeFoods)[0] || null;

// ==========================================================================
// 7. PARSER
// ==========================================================================

const unitOf = (word) => {
    const w = word.toLowerCase().replace(/ё/g, "е").replace(/\.$/, "");
    if (/^(г|гр|грамм|грамма|граммов|g|gr|gram|grams)$/.test(w)) return "g";
    if (/^(кг|kg|килограмм|килограмма|килограммов)$/.test(w)) return "kg";
    if (/^(мл|ml|миллилитр|миллилитра|миллилитров)$/.test(w)) return "ml";
    if (/^(л|l|литр|литра|литров|liter|liters|litre|litres)$/.test(w)) return "l";
    if (/^(шт|штук|штука|штуки|штучки|pc|pcs|piece|pieces)$/.test(w)) return "pc";
    if (
        /^(кусок|куска|кусков|кусочек|кусочка|кусочков|куски|кусочки|slice|slices)$/.test(
            w,
        )
    ) return "pc";
    if (/^(чл|tsp)$/.test(w)) return "tsp";
    if (/^(стл|tbsp)$/.test(w) || /^лож/.test(w)) return "tbsp";
    if (/^(стакан|стакана|стаканов|стаканчик|кружка|чашка|cup|cups)$/.test(w)) return "cup";
    if (/^(порция|порции|порций|порцию|serving|servings)$/.test(w)) return "serving";
    return null;
};

// Units that can be written without a number: "a glass of milk"
const COUNTABLE_UNITS = ["pc", "tsp", "tbsp", "cup", "serving"];

const toGrams = (count, unit, food) => {
    const serving = food?.servingGrams || DEFAULT_SERVING;
    const k =
        {
            g: 1,
            kg: 1000,
            ml: 1,
            l: 1000,
            pc: food?.pieceGrams || serving,
            tsp: 5,
            tbsp: 15,
            cup: 200,
            serving,
        }[unit] || serving;
    return Math.max(1, Math.round(count * k));
};

const splitFragments = (text) =>
    text
        .split(/[;\n]|(?<!\d),|,(?!\d)/)
        .map(norm)
        .filter(Boolean)
        .flatMap((part) => {
            const name = clean(parseQuantity(part).name);
            const whole = name ? matchFood(name) : null;
            if (whole && whole.confidence >= 0.9) return [part];
            return part.split(/\s+(?:и|с|со|and|with)\s+|\s*\+\s*/i);
        })
        .map(norm)
        .filter(Boolean);

const parseQuantity = (fragment) => {
    let text = fragment
        .replace(/(^|\s)ч\.\s?л\.?/gi, "$1 чл ")
        .replace(/(^|\s)ст\.\s?л\.?/gi, "$1 стл ")
        .replace(/чайн\S*\s+лож\S*/gi, " чл ")
        .replace(/столов\S*\s+лож\S*/gi, " стл ");

    const number = text.match(/(\d+(?:[.,]\d+)?)\s*([a-zа-я]+\.?)?/i);
    if (number) {
        const count = +number[1].replace(",", ".") || 1;
        let unit = number[2] ? unitOf(number[2]) : null;
        const consumed = unit ? number[0] : number[1];
        // Cut out the number by match position, not the first occurrence in the string
        const name =
            text.slice(0, number.index) +
            " " +
            text.slice(number.index + consumed.length);

        if (!unit) unit = count <= 20 ? "pc" : "g";
        return {count, unit, name};
    }

    const words = text.split(/\s+/);
    const i = words.findIndex((w) => COUNTABLE_UNITS.includes(unitOf(w)));
    if (i >= 0) {
        const unit = unitOf(words[i]);
        words.splice(i, 1);
        return {count: 1, unit, name: words.join(" ")};
    }
    return {count: 1, unit: "pc", name: text};
};

const makeItem = (food, grams, source) => ({
    foodId: food.id,
    name: food[lang],
    grams,
    nutrition: {...food.nutrition},
    micro: {...food.micro},
    healthScore: food.healthScore,
    source,
});

const parseMeal = (text) =>
    splitFragments(text).map((fragment) => {
        let {count, unit, name} = parseQuantity(fragment);
        name = clean(name);
        const match = name ? matchFood(name) : null;
        const grams = toGrams(count, unit, match?.food);

        if (match) {
            return {
                ...makeItem(match.food, grams, "parse"),
                fragment: norm(fragment),
            };
        }
        return {
            foodId: null,
            name: capitalize(name || clean(fragment)),
            grams,
            nutrition: null,
            micro: null,
            healthScore: null,
            source: "parse",
            fragment: norm(fragment),
        };
    });

const isProblem = (item) => item.foodId == null;

// ==========================================================================
// 8. NUMERIC MASKS
// ==========================================================================

const normalizeNumber = (v, max, decimals) => {
    v = v.replace(",", ".").replace(/[^\d.]/g, "");
    const i = v.indexOf(".");
    if (i >= 0) {
        v = decimals
            ? v.slice(0, i + 1) +
            v
                .slice(i + 1)
                .replace(/\./g, "")
                .slice(0, decimals)
            : v.slice(0, i);
    }
    v = v.replace(/^0+(?=\d)/, "");
    while (v && +v > max) v = v.slice(0, -1);
    return v.replace(".", ",");
};

const parseNumber = (s) => {
    const v = Number(s.replace(",", "."));
    return s.trim() && Number.isFinite(v) ? v : null;
};

const maskNumber = (input, max, decimals) => {
    input.addEventListener("input", () => {
        input.value = normalizeNumber(input.value, max, decimals);
    });
    input.addEventListener("paste", (e) => {
        e.preventDefault();
        input.value = normalizeNumber(
            e.clipboardData.getData("text"),
            max,
            decimals,
        );
        input.dispatchEvent(new Event("input"));
    });
};

// ==========================================================================
// 9. DOM LINKS
// ==========================================================================

/* --- Pages and navigation --- */
const pages = {
    diary: $("diary-page"),
    meal: $("meal-page"),
    dish: $("dish-page"),
    stats: $("stats-page"),
    person: $("person-page"),
    settings: $("settings-page"),
};

const nav = $("nav");
const navBar = $("nav-bar");
const navLinks = {
    diary: $("nav-diary"),
    meal: $("add-meal"),
    stats: $("nav-stats"),
    person: $("nav-person"),
    settings: $("nav-settings"),
};

/* --- Diary --- */
const calendar = $("calendar");
const calendars = $("calendars");
const chosenDay = $("chosen-day");
const dayMeals = $("day-meals");

/* --- Eating --- */
const mealDate = $("meal-date");
const mealTime = $("meal-time");
const mealType = $("meal-type");
const mealText = $("meal-text");
const clearText = $("clear-text");
const iconPhoto = $("icon-photo");
const iconVoice = $("icon-voice");
const iconSearch = $("icon-search");
const iconStar = $("icon-star");
const iconPlus = $("icon-plus");
const photoInput = $("photo-input");
const mealPhoto = $("meal-photo");
const mealItems = $("meal-items");
const mealTotal = $("meal-total");
const tagButtons = $("tag-buttons");
const editTagsButton = $("edit-tags");
const noteBlock = $("note-block");
const mealNote = $("meal-note");
const mealDelete = $("meal-delete");
const confirmButton = $("confirm");
const cancelButton = $("cancel");

/* --- Product / recipe --- */
const dishKind = $("dish-kind");
const dishName = $("dish-name");
const dishBasis = $("dish-basis");
const dishServing = $("dish-serving-grams");
const dishYieldField = $("dish-yield-field");
const dishYield = $("dish-yield");
const dishInputs = {
    calories: $("dish-calories"),
    protein: $("dish-protein"),
    fat: $("dish-fat"),
    carbs: $("dish-carbs"),
    fiber: $("dish-fiber"),
    sugar: $("dish-sugar"),
    salt: $("dish-salt"),
    satFat: $("dish-satFat"),
    freeSugar: $("dish-freeSugar"),
    transFat: $("dish-transFat"),
};
const toggleMicro = $("toggle-micro");
const dishMicro = $("dish-micro");
const dishMicroMode = $("dish-micro-mode");
const dishMicroFields = $("dish-micro-fields");
const dishMicroSource = $("dish-micro-source");
const ingredientsBlock = $("ingredients-block");
const addIngredient = $("add-ingredient");
const ingredientsList = $("ingredients-list");
const ingredientsTotal = $("ingredients-total");
const dishTags = $("dish-tags");
const dishArchive = $("dish-archive");
const dishSave = $("dish-save");
const dishCancel = $("dish-cancel");

/* --- Overlay and modal window --- */
const overlay = $("overlay");
const modal = $("modal");
const question = $("question");
const modalYes = $("modal-yes");
const modalNo = $("modal-no");

/* --- Search --- */
const searchSheet = $("search-sheet");
const searchInput = $("search-input");
const searchClear = $("search-clear");
const searchTabs = $("search-tabs");
const searchResults = $("search-results");
const searchBack = $("search-back");

/* --- Portion --- */
const portionSheet = $("portion-sheet");
const portionTitle = $("portion-title");
const portionGrams = $("portion-grams");
const portionMinus = $("portion-minus");
const portionPlus = $("portion-plus");
const portionCreate = $("portion-create");
const portionDelete = $("portion-delete");
const portionConfirm = $("portion-confirm");

/* --- Tags --- */
const tagsSheet = $("tags-sheet");
const tagInput = $("tag");
const createTagButton = $("create-tag");
const tagActions = $("tag-actions");
const closeTags = $("close-tags");
const applyTags = $("apply-tags");

/* --- Date/Time picker --- */
const whenPicker = $("when-picker");
const whenCalendar = $("when-calendar");
const whenDays = $("when-days");
const clock = $("clock");
const hand = $("hand");
const line = $("line");
const white = $("white");
const black = $("black");
const dayButton = $("day");
const hourButton = $("hour");
const minuteButton = $("minute");
const closeWhen = $("close-when");
const applyWhen = $("apply-when");

/* --- Profile --- */
const logRings = $("log-rings");
const birthdateInput = $("birthdate");
const sexInput = $("sex");
const heightInput = $("height");
const weightInput = $("weight");
const activityInput = $("activity");
const activityLevel = $("activity-level");

const targetInput = {
    sleep: $("target-sleep"),
    steps: $("target-steps"),
    water: $("target-water"),
    weight: $("target-weight")
};

const targetInputs = Object.values(targetInput);

const TARGET_KEYS = ['sleep', 'steps', 'water', 'weight'];
const GOAL_KEYS = [
    "calories",
    "protein",
    "fat",
    "carbs",
    "fiber",
    "sugar",
    "salt",
    "satFat",
];
const goalInput = {
    calories: $("goal-calories"),
    protein: $("goal-protein"),
    fat: $("goal-fat"),
    carbs: $("goal-carbs"),
    fiber: $("goal-fiber"),
    sugar: $("goal-sugar"),
    salt: $("goal-salt"),
    satFat: $("goal-satFat"),
};
const goalInputs = Object.values(goalInput);
const calculatedInputs = {...targetInput, ...goalInput};

const exportButton = $("export");
const importButton = $("import");
const importInput = $("import-input");
const resetButton = $("reset");

/* --- Day details --- */
const dayRings = $("day-rings");
const dayMicro = $("day-micro");

/* --- Logs --- */
const logSheet = $("log-sheet");
const logTitle = $("log-title");
const logValue = $("log-value");
const logUnit = $("log-unit");
const closeLog = $("close-log");
const applyLog = $("apply-log");
const logMinus = $("log-minus");
const logPlus = $("log-plus");

/* --- Statistics --- */
const periodArea = $("period");
const rangeArea = $("range");
const rangeLabel = $("range-label");
const chartTip = $("chart-tip");

// ==========================================================================
// 10. LANGUAGE
// ==========================================================================

const setLanguage = () => {
    lang = navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en";
    document.documentElement.lang = lang;
    S = translations[lang];

    document
        .querySelectorAll("[data-i18n]")
        .forEach((el) => (el.textContent = S[el.dataset.i18n]));
    document
        .querySelectorAll("[data-i18n-placeholder]")
        .forEach((el) => (el.placeholder = S[el.dataset.i18nPlaceholder]));
    document
        .querySelectorAll("[data-i18n-title]")
        .forEach((el) => (el.title = S[el.dataset.i18nTitle]));
    document
        .querySelectorAll("[data-i18n-aria-label]")
        .forEach((el) =>
            el.setAttribute("aria-label", S[el.dataset.i18nAriaLabel]),
        );

    whenCalendar.firstElementChild.innerHTML = S.wds
        .map((w) => `<span>${w}</span>`)
        .join("");

};

// ==========================================================================
// 11. STORAGE
// ==========================================================================

const read = (key, fallback) => {
    try {
        const value = localStorage.getItem(key);
        return value == null ? fallback : JSON.parse(value);
    } catch {
        console.warn(`localStorage: cannot read ${key}`);
        return fallback;
    }
};

const write = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        showMessage(S.storageError);
        return false;
    }
};

const invalidate = () => {
    calendarPages = {};
};

const sortMeals = () => meals.sort((a, b) => a.eaten - b.eaten);

const saveMeals = () => {
    invalidate();
    write("meals", meals);
    sortMeals();
};

const saveFoods = () => write("foods", foods);
const saveTags = () => write("tags", tags);
const saveFavorites = () => write("favorites", favorites);
const saveRecents = () => write("recents", recents);

const personToStore = () => {
    const {
        sex,
        birthdate,
        height,
        weight,
        activity,
        targets,
        goals,
        manual,
    } = person;
    return {
        sex,
        birthdate,
        height,
        weight,
        activity,
        targets,
        goals,
        manual,
    };
};

const savePerson = () => {
    updatePerson();
    invalidate();
    write("person", personToStore());
};

const loadPerson = () => {
    person = read("person", {...DEFAULT_PERSON});
    updatePerson();
};

const loadMeals = () => {
    meals = read("meals", []).filter(Boolean);
    sortMeals();
};

const loadFoods = () => {
    foods = read("foods", []).filter(Boolean);
};

const loadLogs = () => {
    logs.weight = read("weight", []);
    logs.water = read("water", []);
    logs.sleep = read("sleep", []);
    logs.steps = read("steps", []);
};

const loadTags = () => {
    tags = read("tags", [...S.defaultTags]).filter(Boolean);
    favorites = read("favorites", []);
    recents = read("recents", []);
};

const loadAll = () => {
    invalidate();
    loadPerson();
    loadMeals();
    loadFoods();
    loadLogs();
    loadTags();
};

const MAX_RECENT = 50;

const updateRecents = (items) => {
    const now = Date.now();

    const dst = [];
    const foodIds = new Set();

    for (const {foodId, grams} of items) {
        if (foodId == null || foodIds.has(foodId)) continue;
        dst.push({foodId, grams, date: now})
        foodIds.add(foodId);
    }
    for (const q of recents) {
        if (foodIds.has(q.foodId)) continue;
        dst.push(q);
        if (dst.length === MAX_RECENT) break;
    }
    recents = dst;
    saveRecents();
};

/* --- Export and import --- */

const exportData = () => {
    const data = {
        app: APP_NAME,
        exported: Date.now(),
        meals,
        foods,
        person: personToStore(),
        ...logs,
        tags,
        favorites,
        recents,
    };
    const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${APP_NAME}-${getDateKey(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const IMPORT_ARRAYS = [
    "meals",
    "foods",
    "weight",
    "water",
    "sleep",
    "steps",
    "tags",
    "favorites",
    "recents",
];

const validImport = (data) => {
    try {
        const {sex, height, weight, activity, birthdate} = data.person;
        return (
            data.app === APP_NAME &&
            [height, weight, activity, sex, birthdate].every(Number.isFinite) &&
            IMPORT_ARRAYS.every((k) => Array.isArray(data[k])) &&
            data.meals.every(
                (m) =>
                    Number.isFinite(m.created) &&
                    Number.isFinite(m.eaten) &&
                    Array.isArray(m.items),
            )
        );
    } catch {
        return false;
    }
};

const importData = (data) => {
    const payload = Object.fromEntries(IMPORT_ARRAYS.map((k) => [k, data[k]]));
    payload.person = data.person;
    if (!Object.keys(payload).every((k) => write(k, payload[k]))) return;
    loadAll();
    date = new Date();
    calendarDate = new Date(date);
    renderPage("diary");
    gcPhotos();
};

const resetData = async () => {
    STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    loadAll();
    await clearPhotos();
    date = new Date();
    calendarDate = new Date(date);
    renderPage("diary");
};

// ==========================================================================
// 12. PHOTOS (IndexedDB + Yandex Object Storage)
// ==========================================================================

let photoDb = null;
let lastPhotoId = 0;
let syncing = false;
const photoUrls = new Map();
const photoRenderTokens = new WeakMap();

const nextPhotoId = () => (lastPhotoId = Math.max(Date.now(), lastPhotoId + 1));

const openPhotoStore = () =>
    new Promise((resolve) => {
        if (!window.indexedDB) return resolve(null);
        try {
            const request = indexedDB.open("FoodDiaryPhotos", 1);
            request.onupgradeneeded = () =>
                request.result.createObjectStore("photos", {keyPath: "id"});
            request.onsuccess = () => {
                photoDb = request.result;
                document.body.classList.add("photos");
                resolve(photoDb);
            };
            request.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });

const photoStore = (mode, fn) =>
    new Promise((resolve, reject) => {
        const tx = photoDb.transaction("photos", mode);
        const request = fn(tx.objectStore("photos"));
        tx.oncomplete = () => resolve(request?.result);
        tx.onerror = () => reject(tx.error);
    });

const getPhoto = (id) => photoStore("readonly", (s) => s.get(id));
const putPhoto = (record) => photoStore("readwrite", (s) => s.put(record));
const removePhoto = (id) => photoStore("readwrite", (s) => s.delete(id));
const allPhotos = () => photoStore("readonly", (s) => s.getAll());

const loadImage = (file) =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("loadImage"));
        };
        img.src = url;
    });

const compressImage = async (file, maxWidth = 1280, quality = 0.82) => {
    const source = await createImageBitmap(file).catch(() => loadImage(file));
    const scale = Math.min(1, maxWidth / Math.max(source.width, source.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return {blob, width: canvas.width, height: canvas.height};
};

const addPhoto = async (file) => {
    if (!photoDb) return null;
    try {
        const {blob, width, height} = await compressImage(
            file,
            PHOTO_MAX_WIDTH,
            PHOTO_QUALITY,
        );
        const id = nextPhotoId();
        await putPhoto({
            id,
            blob,
            mime: "image/jpeg",
            width,
            height,
            size: blob.size,
            status: "pending",
            attempts: 0,
            objectKey: `photos/${id}.jpg`,
            createdAt: Date.now(),
        });
        syncPhotos();
        return id;
    } catch (e) {
        console.warn("addPhoto", e);
        return null;
    }
};

const presign = async (action, key) => {
    const response = await fetch(PHOTO_API_URL, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({action, key, mime: "image/jpeg"}),
    });
    if (!response.ok) throw new Error(`presign ${response.status}`);
    return (await response.json()).url;
};

const syncPhotos = async () => {
    if (!photoDb || !PHOTO_API_URL || !navigator.onLine || syncing) return;
    syncing = true;
    try {
        for (const record of await allPhotos()) {
            try {
                if (record.status === "deleted") {
                    const url = await presign("delete", record.objectKey);
                    const response = await fetch(url, {method: "DELETE"});
                    if (response.ok || response.status === 404)
                        await removePhoto(record.id);
                } else if (record.status === "pending" || record.status === "error") {
                    const url = await presign("put", record.objectKey);
                    const response = await fetch(url, {
                        method: "PUT",
                        body: record.blob,
                        headers: {"Content-Type": record.mime},
                    });
                    if (!response.ok) throw new Error(`upload ${response.status}`);
                    // Re-read the record: the photo may have been marked deleted during the upload
                    const current = await getPhoto(record.id).catch(() => null);
                    if (current && current.status !== "deleted") {
                        await putPhoto({...current, status: "uploaded"});
                    }
                }
            } catch (e) {
                if (record.status !== "deleted") {
                    const attempts = (record.attempts || 0) + 1;
                    await putPhoto({
                        ...record,
                        attempts,
                        status: attempts >= 5 ? "error" : record.status,
                    });
                }
                console.warn("syncPhotos", e);
            }
        }
    } finally {
        syncing = false;
    }
};

const getPhotoUrl = async (id) => {
    if (photoUrls.has(id)) return photoUrls.get(id);
    let url = null;
    const record = photoDb ? await getPhoto(id).catch(() => null) : null;
    if (record?.blob) {
        url = URL.createObjectURL(record.blob);
        photoUrls.set(id, url);
    } else if (
        PHOTO_API_URL &&
        navigator.onLine &&
        record?.status !== "deleted"
    ) {
        url = await presign("get", `photos/${id}.jpg`).catch(() => null);
    }
    return url;
};

const deletePhoto = async (id) => {
    if (!photoDb || id == null) return;
    const url = photoUrls.get(id);
    if (url) {
        URL.revokeObjectURL(url);
        photoUrls.delete(id);
    }
    const record = await getPhoto(id).catch(() => null);
    if (!record) return;
    if (record.status === "pending" && !record.attempts) await removePhoto(id);
    else await putPhoto({...record, blob: null, status: "deleted"});
    syncPhotos();
};

const referencedPhotos = () =>
    new Set(
        [
            ...meals.map((m) => m.photoId),
            meal?.photoId,
        ].filter((id) => id != null),
    );

const gcPhotos = async () => {
    if (!photoDb) return;
    const used = referencedPhotos();
    for (const record of await allPhotos()) {
        if (record.status !== "deleted" && !used.has(record.id))
            await deletePhoto(record.id);
    }
};

const clearPhotos = async () => {
    if (!photoDb) return;
    for (const record of await allPhotos()) await deletePhoto(record.id);
};

const renderPhoto = async (container, id) => {
    const token = Symbol();
    photoRenderTokens.set(container, token);
    container.classList.toggle("hidden", id == null);
    container.innerHTML = "";
    if (id == null) return;
    const url = await getPhotoUrl(id);
    if (photoRenderTokens.get(container) !== token) return;
    container.innerHTML = `
        ${url ? `<img src="${url}" alt="">` : '<div class="photo-stub"><svg><use href="sprite.svg#camera"></use></svg></div>'}
        <button class="photo-remove" aria-label="${S.removePhoto}"><svg><use href="sprite.svg#close"></use></svg></button>`;
};

// ==========================================================================
// 13. NAVIGATION, SHEETS, MODAL WINDOW
// ==========================================================================

const renderPage = (name, withLink = true) => {
    if (page) page.classList.add("hidden");
    if (link) {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
    }

    page = pages[name];
    link = withLink ? navLinks[name] || null : null;

    page.classList.remove("hidden");
    if (link) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
    }
    navBar.classList.toggle("hidden", name === "meal" || name === "dish");
    window.scrollTo(0, 0);

    if (name === "diary") renderDiary();
    else if (name === "stats") {
        renderRange();
        renderStats();
    } else if (name === "person") {
        renderPerson();
    }
};

const toDiaryPage = () => renderPage("diary");

nav.onclick = (e) => {
    const button = e.target.closest("button");
    if (!button || button === link) return;
    renderPage(button.dataset.page);
};

navLinks.meal.onclick = () => openMeal(newMeal(), true);

let openedSheet = null;

const openSheet = (sheet) => {
    closeSheet();
    openedSheet = sheet;
    overlay.classList.add("open");
    openedSheet.classList.add("open");
};

const closeSheet = () => {
    if (!openedSheet) return;
    openedSheet.classList.remove("open");
    overlay.classList.remove("open");
    openedSheet = null;
};

overlay.onclick = closeSheet;

let onModalYes = null;

const showModal = (text, onYes) => {
    question.textContent = text;
    onModalYes = onYes;
    modalYes.textContent = onYes ? S.yes : "OK";
    modalNo.classList.toggle("hidden", !onYes);
    modal.hidden = false;
};

const showMessage = (text) => showModal(text, null);

const closeModal = () => {
    modal.hidden = true;
    onModalYes = null;
};

modalYes.onclick = () => {
    const callback = onModalYes;
    closeModal();
    if (callback) callback();
};
modalNo.onclick = closeModal;
modal.onclick = (e) => {
    if (e.target === modal) closeModal();
};

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!modal.hidden) closeModal();
    else closeSheet();
});

/* --- Segments --- */

const setSegment = (segment, value, attr) => {
    const buttons = [...segment.querySelectorAll("button")];
    const i = Math.max(
        0,
        buttons.findIndex((b) => b.dataset[attr] === String(value)),
    );
    segment.style.setProperty("--n", String(buttons.length));
    segment.style.setProperty("--i", String(i));
    buttons.forEach((b, j) => b.classList.toggle("active", j === i));
};

const onSegment = (segment, attr, callback) => {
    segment.addEventListener("click", (e) => {
        const button = e.target.closest("button");
        if (!button || button.classList.contains("active")) return;
        setSegment(segment, button.dataset[attr], attr);
        callback(button.dataset[attr]);
    });
};

const healthBar = (score) =>
    score == null
        ? ""
        : `<div class="health-bar" style="--score:${Math.round(score)};--color:${healthColor(score)}"></div>`;

// ==========================================================================
// 14. DIARY
// ==========================================================================

const getMeals = (key) => meals.filter(q => q.key === key);
const sumMeals = (key) => sumItems(getMeals(key).flatMap((m) => m.items));

const getValue = (kind, key) => {
    const res = logs[kind].filter(q => q.key === key);
    if (res.length) return res.at(-1).value;
    if (kind === 'weight') {
        return getPrevValue('weight', key) || getNextValue('weight', key) || person.weight;
    }
    return 0;
}

const getPrevValue = (kind, key) => {
    const res = logs[kind].filter(q => q.key < key);
    return res.length ? res.at(-1).value : null;
};

const getNextValue = (kind, key) => {
    const res = logs[kind].filter(q => q.key > key);
    return res.length ? res[0].value : null;
};

/* --- Calendar --- */

const getMarkHtml = (s) => {
    if (!s) return "";
    const ratio = s.calories / person.goals.calories;
    const size = Math.min(64, 16 + 24 * ratio);
    return `<i style="width:${size}px;height:${size}px;background:${healthColor(s.healthScore)}"></i>`;
};

const addPageMonth = (delta) => {
    const month = calendarDate.getMonth() + delta;
    const year = calendarDate.getFullYear();
    const m = (month + 12) % 12;
    const y = year + delta * (month !== m);
    calendarDate.setDate(1);
    calendarDate.setFullYear(y);
    calendarDate.setMonth(m);
};

const getCalendarPage = (delta = 0) => {
    const month = calendarDate.getMonth() + delta;
    const year = calendarDate.getFullYear();
    const m = (month + 12) % 12;
    const y = year + delta * (month !== m);
    const k = 100 * y + m;

    if (calendarPages[k]) return calendarPages[k];

    const first = (new Date(y, m, 1).getDay() + 6) % 7;
    const last = new Date(y, m + 1, 0).getDate();
    const todayKey = getDateKey(today);
    const dateKey = getDateKey(date);

    const dayHtml = (n) => {
        const key = getDateKey(new Date(y, m, n));
        const s = sumMeals(key);
        const color = key > todayKey ? "--help" : "--text";
        return `<button><span style="color: var(${color})" class="${key === dateKey ? "big" : ""}">${n}</span>${getMarkHtml(s)}</button>`;
    };

    let days =
        S.wds.map((w) => `<span>${w}</span>`).join("") +
        '<span class="empty"></span>'.repeat(first);
    for (let i = 1; i <= last; i++) days += dayHtml(i);

    const dst = document.createElement("DIV");
    dst.className = "calendar";
    dst.innerHTML = `
        <div class="small help center top-20">${S.calendarNorm(getNormStreak())}</div>
        <h2 class="row">
            <button class="prev" aria-label="${S.previous}"><svg><use href="sprite.svg#prev"></use></svg></button>
            <span class="big">${S.months[m]} ${y}</span>
            <button class="next" aria-label="${S.next}"><svg><use href="sprite.svg#next"></use></svg></button>
        </h2>
        <div class="days">${days}</div>`;
    calendarPages[k] = dst;
    return dst;
};

const renderPageCalendar = () => {
    calendar.replaceChildren(getCalendarPage());
    chosenButton = calendar.querySelector(".days .big");
};

calendar.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;

    if (button.classList.contains("prev") || button.classList.contains("next")) {
        addPageMonth(button.classList.contains("prev") ? -1 : 1);
        return renderPageCalendar();
    }

    if (chosenButton) chosenButton.classList.remove("big");
    chosenButton = button.firstElementChild;
    chosenButton.classList.add("big");

    date = new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth(),
        +chosenButton.textContent,
        12,
    );
    renderDay();
});

/* --- Swipe between months --- */

let startX = null;
let dragging = false;
let shift = 0;
let delta = 0;
let width = 0;

const MIN_SHIFT = 10;
const MAX_SHIFT = 40;

const renderCalendars = () => {
    width = calendar.clientWidth + 30;
    calendars.style.setProperty("--width", `${calendar.clientWidth}px`);
    calendars.replaceChildren(
        getCalendarPage(-1),
        getCalendarPage(),
        getCalendarPage(1),
    );
    calendar.replaceChildren(calendars);
    calendars.style.transition = "none";
    calendars.style.transform = `translateX(-${width}px)`;
};

calendars.addEventListener("transitionend", () => {
    addPageMonth(delta);
    renderPageCalendar();
});

calendar.addEventListener("pointerdown", (e) => {
    startX = e.clientX;
    delta = 0;
    dragging = false;
});

calendar.addEventListener("pointermove", (e) => {
    if (startX === null) return;

    shift = e.clientX - startX;

    if (!dragging) {
        if (Math.abs(shift) < MIN_SHIFT) return;
        dragging = true;

        delta = shift > 0 ? -1 : 1;
        startX -= delta * MIN_SHIFT;
        shift += delta * MIN_SHIFT;

        renderCalendars();
        calendar.setPointerCapture(e.pointerId);
    }
    calendars.style.transform = `translateX(${shift - width}px)`;
});

const stopDragging = () => {
    if (startX === null) return;
    startX = null;

    if (!dragging) return;
    dragging = false;

    delta = Math.abs(shift) > MAX_SHIFT ? (shift > 0 ? -1 : 1) : 0;

    calendars.style.transition = `transform 0.2s ease`;
    calendars.style.transform = `translateX(-${width + delta * width}px)`;
};

calendar.addEventListener("pointerup", stopDragging);
calendar.addEventListener("pointercancel", stopDragging);

/* --- Summary, logs, meal list --- */

const mealHtml = (m) => {
    const s = sumItems(m.items);
    const names = m.items.map((i) => clean(i.name)).join(" · ");
    const tagHtml = m.tags
        .map((t) => `<span class="small help">${clean(t)}</span>`)
        .join("");
    const photo =
        m.photoId != null
            ? '<svg class="tool"><use href="sprite.svg#camera"></use></svg>'
            : "";
    return `<button class="meal" data-created="${m.created}">
        ${tagHtml ? `<div class="tags">${tagHtml}</div>` : ""}
        <div class="row gap-10">
            <span class="time mono">${getTimeText(m.eaten)}</span>
            <span class="type small help">${S.mealTypes[m.type]}</span>
            ${photo}
            <span class="cal mono right">${fmt(s.calories)} ${S.kcal}</span>
        </div>
        <div class="items small help">${names}</div>
        ${healthBar(s.healthScore)}
    </button>`;
};

const renderDayMeals = () => {
    const src = getMeals(getDateKey(date));
    dayMeals.innerHTML = src.length
        ? src.map(mealHtml).join("")
        : `<div class="small help center pad-20">${S.noRecords}</div>`;
};

const renderDay = () => {
    chosenDay.textContent = getDateText(date);
    renderDayMeals();
    renderLogRings();
    renderDayRings();
    renderDayMicro();
};

const renderDiary = () => {
    calendarDate = new Date(date);
    calendarDate.setDate(1);
    renderPageCalendar();
    renderDay();
};

dayMeals.onclick = (e) => {
    const button = e.target.closest("button.meal");
    if (!button) return;
    const created = +button.dataset.created;
    openMeal(structuredClone(meals.find((m) => m.created === created)), false);
};

// ==========================================================================
// 15. DAY LOG (#log-sheet)
// ==========================================================================

let logKind = null;

const openLogSheet = (kind) => {
    logKind = kind;
    const {decimals} = LOGS[kind];
    logTitle.textContent = S[kind];
    logUnit.textContent = S.logUnits[kind];
    logValue.value = fmt(getValue(kind, getDateKey(date)), decimals);
    logValue.inputMode = decimals ? "decimal" : "numeric";
    openSheet(logSheet);
};

logValue.addEventListener("input", () => {
    const {max, decimals} = LOGS[logKind];
    logValue.value = normalizeNumber(logValue.value, max, decimals);
});

const shiftLogValue = (diff) => {
    const {max, decimals} = LOGS[logKind];
    let value = parseNumber(logValue.value) || 0;
    value = round(
        Math.max(0, Math.min(value + diff, max)),
        decimals,
    );
    logValue.value = String(value).replace(".", ",");
};

logMinus.onclick = () => shiftLogValue(-LOGS[logKind].step);
logPlus.onclick = () => shiftLogValue(LOGS[logKind].step);

const updatePersonWeight = () => {
    logs.weight.sort((a, b) => a.key - b.key);
    person.weight = logs.weight.at(-1).value;
};

applyLog.onclick = () => {
    const key = getDateKey(date);
    const value = parseNumber(logValue.value);

    logs[logKind] = logs[logKind].filter(q => q.key !== key);
    logs[logKind].push({key, date: new Date().getTime(), value: (value || 0)});

    if (logKind === "weight") {
        updatePersonWeight();
        savePerson();
        renderPerson();
    }
    write(logKind, logs[logKind])

    closeSheet();
    renderDiary();
};

closeLog.onclick = closeSheet;

// ==========================================================================
// 16. DETAILS OF THE DAY (#stats-sheet)
// ==========================================================================

const RING_LENGTH = 2 * Math.PI * 28;

const microEntries = (micro, g = 1) =>
    MICRO_KEYS.map((k) => ({
        label: `${S[k]}`,
        value:
            micro[k] == null ? null : ((micro[k] * g) / MICRO_NORMALS[k]) * 100,
    }));

const microBarsHtml = (entries) =>
    entries
        .map(
            ({label, value}) => `
    <div class="h-col">
        <div class="h-label">${label}</div>
        <div class="h-value" style="--count:${value == null ? 0 : Math.min(150, value)};--total:150">
            ${value == null ? "" : '<div class="h-bar" style="--color:var(--accent)"></div>'}
            <span class="h-number ${value == null ? "help" : ""}">${value == null ? "—" : `${fmt(value)}%`}</span>
        </div>
    </div>`,
        )
        .join("");

const renderDayMicro = () => {
    const d = getDateKey(date);
    const s = sumMeals(d);

    dayMicro.innerHTML = s ? microBarsHtml(microEntries(s.micro)) : '';
};

// ==========================================================================
// 17. MEAL PAGE
// ==========================================================================

let meal = null;
let mealTags = new Set();
let originalPhotoId = null;
let addedPhotos = [];
let typeTouched = false;

const autoType = (eaten) => {
    const h = new Date(eaten).getHours();
    if (h >= 5 && h <= 10) return BREAKFAST;
    if (h >= 11 && h <= 15) return LUNCH;
    if (h >= 16 && h <= 20) return DINNER;
    return SNACK;
};

const newMeal = () => {
    const now = new Date();
    const eaten = new Date(date);
    eaten.setHours(now.getHours(), now.getMinutes(), 0, 0);
    return {
        eaten: eaten.getTime(),
        key: getDateKey(eaten),
        type: autoType(eaten),
        items: [],
        tags: [],
        photoId: null,
        note: "",
    };
};

const openMeal = (m, isNew) => {
    meal = m;
    mealTags = new Set(meal.tags);
    originalPhotoId = meal.photoId;
    addedPhotos = [];
    typeTouched = !isNew;

    mealText.value = "";
    growMealText();
    clearText.classList.add("hidden");
    mealNote.value = meal.note;
    noteBlock.open = !!meal.note;
    mealDelete.classList.toggle("hidden", !meal.created);

    renderPage("meal", isNew);
    renderMeal();
};

const renderMealHeader = () => {
    mealDate.textContent = getDateText(meal.eaten);
    mealTime.textContent = getTimeText(meal.eaten);
    mealType.textContent = S.mealTypes[meal.type];
};

const renderMeal = () => {
    renderMealHeader();
    renderPhoto(mealPhoto, meal.photoId);
    renderItems();
    renderMealTags();
};

mealType.onclick = () => {
    typeTouched = true;
    meal.type =
        MEAL_TYPES[(MEAL_TYPES.indexOf(meal.type) + 1) % MEAL_TYPES.length];
    renderMealHeader();
};

mealDate.onclick = () => openWhenPicker(toDay);
mealTime.onclick = () => openWhenPicker(toHour);

/* --- Text and parsing --- */

const applyParse = () => {
    const parsed = parseMeal(mealText.value);
    const old = meal.items.filter((i) => i.fragment != null);
    const keep = meal.items.filter((i) => i.fragment == null);
    const used = new Set();

    const next = parsed.map((item) => {
        const same = old.find((o) => !used.has(o) && o.fragment === item.fragment);
        if (!same) return item;
        used.add(same);
        return same;
    });

    meal.items = [...keep, ...next];
    renderItems();
};

const parseLater = debounce(applyParse, 400);

// Auto-grow fallback for browsers without CSS field-sizing
const growMealText = () => {
    if (CSS.supports("field-sizing: content")) return;
    mealText.style.height = "auto";
    mealText.style.height = `${mealText.scrollHeight}px`;
};

mealText.addEventListener("input", () => {
    clearText.classList.toggle("hidden", !mealText.value);
    growMealText();
    parseLater();
});

mealText.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        parseLater.flush();
        mealText.blur();
    }
});

clearText.onclick = () => {
    mealText.value = "";
    clearText.classList.add("hidden");
    growMealText();
    applyParse();
    mealText.focus();
};

/* --- Voice --- */

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!Recognition) iconVoice.classList.add("hidden");

iconVoice.onclick = () => {
    // Double tap protection: do not start the second recognition
    if (iconVoice.classList.contains("listening")) return;

    const recognition = new Recognition();
    recognition.lang = S.locale;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        const current = mealText.value.trim();
        mealText.value = current ? `${current}, ${text}` : text;
        clearText.classList.remove("hidden");
        growMealText();
        applyParse();
    };
    recognition.onerror = () => iconVoice.classList.remove("listening");
    recognition.onend = () => iconVoice.classList.remove("listening");
    iconVoice.classList.add("listening");
    recognition.start();
};

/* --- Photo --- */

iconPhoto.onclick = () => photoInput.click();

photoInput.onchange = async () => {
    const file = photoInput.files[0];
    photoInput.value = "";
    if (!file || !meal) return;
    const id = await addPhoto(file);
    if (!meal) return;
    if (id == null) return showMessage(S.photoError);
    if (addedPhotos.includes(meal.photoId)) deletePhoto(meal.photoId);
    addedPhotos.push(id);
    meal.photoId = id;
    renderPhoto(mealPhoto, id);
};

mealPhoto.onclick = (e) => {
    if (!e.target.closest(".photo-remove")) return;
    if (addedPhotos.includes(meal.photoId)) deletePhoto(meal.photoId);
    meal.photoId = null;
    renderPhoto(mealPhoto, null);
};

/* --- Quick search lists --- */

const recentPicks = () =>
    recents
        .map((r) => ({food: findFood(r.foodId), grams: r.grams}))
        .filter((p) => p.food && !p.food.archived)
        .slice(0, 10);

const frequentPicks = () => {
    updateFoodsCounter();
    return [...foodsCounter.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => findFood(id))
        .filter((f) => f && !f.archived)
        .slice(0, 10)
        .map((food) => ({food, grams: food.servingGrams || DEFAULT_SERVING}));
};

/* --- Items --- */

const macrosText = (n, g = 1) =>
    `${fmt(n.calories * g)} ${S.kcal} · ${S.protein[0]} ${fmt(n.protein * g)} · ${S.fat[0]} ${fmt(n.fat * g)} · ${S.carbs[0]} ${fmt(n.carbs * g)}`;

const itemHtml = (item, i) => {
    const n = item.nutrition;
    const g = item.grams / 100;
    const info = n
        ? `<span class="help right">${macrosText(n, g)}</span>`
        : `<span class="red">${S.notFound}</span>`;
    return `<div class="card-item ${isProblem(item) ? "bad" : ""}" data-i="${i}" role="button" tabindex="0">
        <div class="row gap-10">
            <div class="name">${clean(item.name)}</div>
            <div class="grams mono">${item.grams} ${S.g}</div>
        </div>
        <div class="row small mono">${info}</div>
        ${healthBar(item.healthScore)}
    </div>`;
};

const renderItems = () => {
    const s = sumItems(meal.items);
    mealItems.innerHTML = meal.items.map((item, i) => itemHtml(item, i)).join("");

    mealTotal.innerHTML = meal.items.length > 1
        ? `<div class="small help mono">${macrosText(s)}</div><div>${fmt(s.grams)} ${S.g}</div>`
        : "";
    renderCta();
};

const openItemCreation = (i) => {
    const item = meal.items[i];
    openDishPage({name: item.name, action: {type: "replace", index: i}});
};

mealItems.onclick = (e) => {
    const card = e.target.closest(".card-item");
    if (!card) return;
    const i = +card.dataset.i;
    if (meal.items[i].foodId == null) openItemCreation(i);
    else openPortion(i);
};

mealItems.onkeydown = (e) => {
    const card = e.target.closest(".card-item");
    if (card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        const i = +card.dataset.i;
        if (meal.items[i].foodId == null) openItemCreation(i);
        else openPortion(i);
    }
};

/* --- Tags --- */

const renderMealTags = () => {
    const dst = [...tags, ...[...mealTags].filter(tag => !tags.includes(tag))];
    tagButtons.innerHTML = dst
        .map(
            (tag) =>
                `<button class="tap ${mealTags.has(tag) ? "selected" : ""}">${clean(tag)}</button>`,
        )
        .join("");
    [...tagButtons.children].forEach((q, i) => (q.dataset.tag = dst[i]));
};

const addFoodTags = (food) => {
    if (!food.tags?.length) return;
    food.tags.forEach((tag) => mealTags.add(tag));
    renderMealTags();
};

// Shared tag-chip handler for meals and the product editor
const bindTagChips = (container, getSet) =>
    container.addEventListener("click", (e) => {
        const button = e.target.closest("button");
        if (!button) return;
        const tag = button.dataset.tag;
        const set = getSet();
        set.has(tag) ? set.delete(tag) : set.add(tag);
        button.classList.toggle("selected");
    });

bindTagChips(tagButtons, () => mealTags);

/* --- Note --- */

mealNote.addEventListener("input",
    debounce(() => {
        if (meal) meal.note = mealNote.value;
    }, 300),
);

/* --- CTA --- */

const renderCta = () => {
    const n = meal.items.filter(isProblem).length;
    confirmButton.disabled = !meal.items.length;
    confirmButton.setAttribute("aria-label", n ? S.checkItems(n) : S.confirm);
};

const stripFragment = ({fragment, ...item}) => item;

const saveMeal = () => {
    meal.items = meal.items.map(stripFragment);
    meal.tags = [...mealTags];
    meal.note = mealNote.value.trim();

    if (meal.created) {
        const i = meals.findIndex((m) => m.created === meal.created);
        meals[i] = meal;
    } else {
        meal.created = Date.now();
        meals.push(meal);
    }

    saveMeals();
    updateRecents(meal.items);
    if (originalPhotoId != null && originalPhotoId !== meal.photoId) deletePhoto(originalPhotoId);

    date = new Date(meal.eaten);
    meal = null;
    mealText.value = "";
    toDiaryPage();
};

confirmButton.onclick = () => {
    const i = meal.items.findIndex(isProblem);
    if (i < 0) return saveMeal();
    const card = mealItems.querySelector(`[data-i="${i}"]`);
    card.scrollIntoView({behavior: "smooth", block: "center"});
    card.classList.add("flash");
    setTimeout(() => card.classList.remove("flash"), 1000);
};

cancelButton.onclick = () => {
    addedPhotos.forEach(deletePhoto);
    meal = null;
    toDiaryPage();
};

mealDelete.onclick = () => showModal(S.deleteMealQuestion, () => {
    meals = meals.filter((m) => m.created !== meal.created);
    saveMeals();
    addedPhotos.forEach(deletePhoto);
    if (originalPhotoId != null) deletePhoto(originalPhotoId);
    meal = null;
    toDiaryPage();
});

// ==========================================================================
// 18. SEARCH (#search-sheet)
// ==========================================================================

let searchContext = {type: "meal"};
let searchTab = "all";

const SEARCH_TABS = ["all", "product", "dish", "recipe"];
const QUICK_TABS = ["recent", "frequent", "favorites", "my"];

const openSearch = (type, options = {}) => {
    searchContext = {type, ...options};
    searchTab = options.tab || "all";
    searchInput.value = options.query || "";
    renderSearchTabs();
    renderSearchResults();
    openSheet(searchSheet);
    setTimeout(() => searchInput.focus(), 250);
};

const openQuickPicks = () => {
    const tab = recentPicks().length
        ? "recent"
        : frequentPicks().length
            ? "frequent"
            : "favorites";
    openSearch("meal", {tab, quick: true});
};

const renderSearchTabs = () => {
    const quick = searchContext.quick;
    const tabs = quick ? QUICK_TABS : SEARCH_TABS;
    searchTabs.innerHTML = tabs
        .map((tab) => {
            const label = quick ? S[tab] : S.searchTabs[tab];
            return `<button class="tap chip ${tab === searchTab ? "selected" : ""}" data-tab="${tab}">${label}</button>`;
        })
        .join("");
};

const searchActiveFoods = () => {
    if (searchContext.quick && searchTab === "recent")
        return recentPicks().map((p) => p.food);
    if (searchContext.quick && searchTab === "frequent")
        return frequentPicks().map((p) => p.food);
    if (searchContext.quick && searchTab === "my")
        return foods.filter((f) => !f.archived);

    let dst = getActiveFoods();
    if (searchTab === "favorites") {
        dst = dst.filter((f) => favorites.includes(f.id));
    } else if (searchTab !== "all") {
        dst = dst.filter((f) => f.kind === searchTab);
    }
    if (searchContext.type === "ingredient" && dish?.editing) {
        dst = dst.filter((f) => f.id !== dish.editing.id);
    }
    return dst;
};

const searchFoods = (query) => {
    const dst = searchActiveFoods();
    if (!query.trim()) {
        if (
            searchContext.quick &&
            (searchTab === "recent" || searchTab === "frequent")
        ) {
            return dst.slice(0, 50);
        }
        return dst
            .sort((a, b) => a[lang].localeCompare(b[lang], S.locale))
            .slice(0, 50);
    }
    return rankFoods(query, dst)
        .slice(0, 50)
        .map((m) => m.food);
};

const resultHtml = (food) => {
    const favorite = favorites.includes(food.id);
    const act = food.custom && searchContext.type === "meal"
        ? `<button class="icon-button" data-act="edit" aria-label="${S.edit}"><svg class="tool"><use href="sprite.svg#edit"></use></svg></button>`
        : `<button class="icon-button" data-act="fav" aria-label="${S.favorites}" aria-pressed="${favorite}">
            <svg class="tool ${favorite ? "starred" : ""}"><use href="sprite.svg#star"></use></svg>
        </button>`;
    return `<div class="result" data-id="${food.id}" role="button" tabindex="0">
        <div class="col grow">
            <span>${clean(food[lang])}</span>
            <span class="small help mono">${fmt(food.nutrition.calories)} ${S.kcal}</span>
            ${healthBar(food.healthScore)}
        </div>
        ${act}
    </div>`;
};

const renderSearchResults = () => {
    const dst = searchFoods(searchInput.value);
    searchResults.innerHTML = dst.length
        ? dst.map(resultHtml).join("")
        : `<div class="empty">${S.nothingFound}</div>`;
};

searchInput.addEventListener("input", debounce(renderSearchResults, 150));

searchClear.onclick = () => {
    searchInput.value = "";
    renderSearchResults();
    searchInput.focus();
};

searchTabs.onclick = (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    searchTab = button.dataset.tab;
    renderSearchTabs();
    renderSearchResults();
};

const toggleFavorite = (id) => {
    favorites = favorites.includes(id)
        ? favorites.filter((x) => x !== id)
        : [...favorites, id];
    saveFavorites();
};

const pickFood = (food) => {
    const {type} = searchContext;
    closeSheet();

    if (type === "ingredient") {
        dish.ingredients.push({
            foodId: food.id,
            grams: food.servingGrams || DEFAULT_SERVING,
        });
        renderIngredients();
        return updateDish();
    }

    const source = searchTab === "favorites"
        ? "favorite"
        : searchContext.quick ? searchTab : "search";

    const q = source === "recent" && recentPicks().find((p) => p.food.id === food.id);

    const grams = q?.grams || food.servingGrams || DEFAULT_SERVING;
    meal.items.push(makeItem(food, grams, source));

    addFoodTags(food);
    renderItems();
};

searchResults.onclick = (e) => {
    const q = e.target.closest(".result");
    if (!q) return;
    const food = findFood(+q.dataset.id);
    const act = e.target.closest("button")?.dataset.act;

    if (act === "fav") {
        toggleFavorite(food.id);
        return renderSearchResults();
    }
    if (act === "edit") {
        closeSheet();
        return openDishPage({food, action: {type: "edit"}});
    }
    pickFood(food);
};

searchResults.onkeydown = (e) => {
    const q = e.target.closest(".result");
    if (q && e.target === q && e.key === "Enter")
        pickFood(findFood(+q.dataset.id));
};

searchBack.onclick = closeSheet;
iconSearch.onclick = () => openSearch("meal");
iconStar.onclick = openQuickPicks;
iconPlus.onclick = () => openDishPage({action: {type: "add"}});

// ==========================================================================
// 19. PORTION (#portion-sheet)
// ==========================================================================

let portionIndex = null;
let portionSource = "meal";

const portionItem = () =>
    portionSource === "ingredient"
        ? dish.ingredients[portionIndex]
        : meal.items[portionIndex];

const openPortion = (i, source = "meal") => {
    portionIndex = i;
    portionSource = source;
    const item = portionItem();
    const food = findFood(item.foodId);

    portionTitle.textContent = source === "ingredient" ? food[lang] : item.name;
    portionGrams.value = String(item.grams);

    const exists = item.foodId != null;
    portionCreate.classList.toggle("hidden", source === "ingredient" || exists);
    portionConfirm.classList.toggle("hidden", source !== "ingredient" && !exists);

    openSheet(portionSheet);
};

maskNumber(portionGrams, MAX_GRAMS, 0);

const shiftPortion = (direction) => {
    const step = findFood(portionItem().foodId)?.servingGrams || DEFAULT_SERVING;
    const grams = (parseNumber(portionGrams.value) || 0) + direction * step;
    portionGrams.value = String(Math.max(0, Math.min(grams, MAX_GRAMS)));
};

portionMinus.onclick = () => shiftPortion(-1);
portionPlus.onclick = () => shiftPortion(1);

const savePortion = () => {
    const item = portionItem();
    item.grams = Math.max(1, parseNumber(portionGrams.value) || item.grams);
    closeSheet();
    if (portionSource === "ingredient") {
        renderIngredients();
        updateDish();
    } else {
        renderItems();
    }
};

portionConfirm.onclick = savePortion;

portionDelete.onclick = () => {
    closeSheet();
    if (portionSource === "ingredient") {
        dish.ingredients.splice(portionIndex, 1);
        renderIngredients();
        updateDish();
    } else {
        meal.items.splice(portionIndex, 1);
        renderItems();
    }

};

portionCreate.onclick = () => {
    const index = portionIndex;
    closeSheet();
    openItemCreation(index);
};

// ==========================================================================
// 20. TAG EDITOR (#tags-sheet)
// ==========================================================================

const openTagEditor = () => {
    tagActions.innerHTML = tags
        .map((tag) => `<button class="tap red">${clean(tag)}</button>`)
        .join("");
    [...tagActions.children].forEach((el, i) => (el.dataset.tag = tags[i]));
    tagInput.value = "";
    openSheet(tagsSheet);
};

const applyTagEditor = () => {
    tags = [...tagActions.children].map(q => q.dataset.tag);
    saveTags();
    closeSheet();
    renderMealTags();
};

editTagsButton.onclick = openTagEditor;
closeTags.onclick = closeSheet;
applyTags.onclick = applyTagEditor;

createTagButton.onclick = (e) => {
    e.preventDefault();
    const tag = tagInput.value.trim();
    if (!tag || [...tagActions.children].some(q => q.dataset.tag === tag))
        return;

    const button = document.createElement("BUTTON");
    button.className = "tap red";
    button.textContent = tag;
    button.dataset.tag = tag;

    tagInput.value = "";
    tagInput.focus();

    tagActions.appendChild(button);
};

tagActions.onclick = (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    tagInput.value = button.dataset.tag;
    button.remove();
};

// ==========================================================================
// 21. DATE PICKER/TIME (#when-picker)
// ==========================================================================

const CX = 125;
const CY = 125;
const R_OUT = 100;
const R_IN = 70;
const HAND_RADIUS = 16;

const MINUTE_LABELS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const HOUR_LABELS_AM = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
const HOUR_LABELS_PM = ["12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"];

let add = null;
let update = null;
let whenDate = new Date();
let whenMonth = new Date();
let hour = 0;
let minute = 0;

const setDay = () => (dayButton.textContent = getDateText(whenDate));
const setHour = () => (hourButton.textContent = pad(hour));
const setMinute = () => (minuteButton.textContent = pad(minute));

const updateHand = (angle, radius) => {
    const x = CX + radius * Math.cos(angle);
    const y = CY + radius * Math.sin(angle);
    hand.style.left = `${x - HAND_RADIUS}px`;
    hand.style.top = `${y - HAND_RADIUS}px`;
    line.style.width = `${radius}px`;
    line.style.transform = `rotate(${angle}rad)`;
    white.style.clipPath = `circle(${HAND_RADIUS}px at ${x}px ${y}px)`;
};

const createTicks = (labels, radius) =>
    labels
        .map((label, i) => {
            const angle = (i / 6 - 0.5) * Math.PI;
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);
            return `<div class="tick" style="left:${x}%;top:${y}%">${label}</div>`;
        })
        .join("");

const getMinute = (angle) => (Math.round((30 * angle) / Math.PI) + 75) % 60;
const getHour = (angle) => (Math.round((6 * angle) / Math.PI) + 15) % 12;

const clockPoint = (e) => {
    const rect = clock.getBoundingClientRect();
    return {x: e.clientX - rect.left - CX, y: e.clientY - rect.top - CY};
};

const updateMinute = (e) => {
    const {x, y} = clockPoint(e);
    const angle = Math.atan2(y, x);
    updateHand(angle, R_OUT);
    minute = getMinute(angle);
    setMinute();
};

const updateHour = (e) => {
    const {x, y} = clockPoint(e);
    const angle = Math.atan2(y, x);
    const pm = 4 * (x * x + y * y) < (R_IN + R_OUT) ** 2;
    updateHand(angle, pm ? R_IN : R_OUT);
    hour = getHour(angle) + 12 * pm;
    setHour();
};

const selectWhen = (button) =>
    [dayButton, hourButton, minuteButton].forEach((b) =>
        b.classList.toggle("selected", b === button),
    );

const toMinute = () => {
    whenCalendar.style.display = "none";
    clock.style.display = "block";
    white.innerHTML = black.innerHTML = createTicks(MINUTE_LABELS, 40);
    updateHand((minute / 30 - 0.5) * Math.PI, R_OUT);
    update = updateMinute;
    add = addMinute;
    selectWhen(minuteButton);
};

const toHour = () => {
    whenCalendar.style.display = "none";
    clock.style.display = "block";
    white.innerHTML = black.innerHTML =
        createTicks(HOUR_LABELS_AM, 40) + createTicks(HOUR_LABELS_PM, 28);
    updateHand((hour / 6 - 0.5) * Math.PI, hour >= 12 ? R_IN : R_OUT);
    update = updateHour;
    add = addHour;
    selectWhen(hourButton);
};

const toDay = () => {
    clock.style.display = "none";
    whenCalendar.style.display = "block";
    selectWhen(dayButton);
    add = addMonth;
    update = null;
    whenMonth = new Date(whenDate);
    whenMonth.setDate(1);
    renderWhenCalendar();
};

const renderWhenCalendar = () => {
    const y = whenMonth.getFullYear();
    const m = whenMonth.getMonth();
    const first = (new Date(y, m, 1).getDay() + 6) % 7;
    const last = new Date(y, m + 1, 0).getDate();
    const todayKey = getDateKey(new Date());
    const dateKey = getDateKey(whenDate);

    const getDayType = (n) => {
        const key = getDateKey(new Date(y, m, n));
        if (key === dateKey) return "selected";
        if (key === todayKey) return "today";
        if (key > todayKey) return "future";
        return "";
    };

    let days = '<span class="empty"></span>'.repeat(first);
    for (let i = 1; i <= last; i++)
        days += `<button class="${getDayType(i)}">${i}</button>`;

    whenDays.innerHTML = days;
};

const openWhenPicker = (to) => {
    whenDate = new Date(meal.eaten);
    hour = whenDate.getHours();
    minute = whenDate.getMinutes();

    setDay();
    setHour();
    setMinute();

    to();
    openSheet(whenPicker);
};

const applyWhenPicker = () => {
    const eaten = new Date(whenDate);
    eaten.setHours(hour, minute, 0, 0);
    meal.eaten = eaten.getTime();
    meal.key = getDateKey(whenDate);
    if (!typeTouched) meal.type = autoType(meal.eaten);
    renderMealHeader();
    closeSheet();
};

const addMinute = (d) => {
    minute = (minute + 60 + d) % 60;
    updateHand((minute / 30 - 0.5) * Math.PI, R_OUT);
    setMinute();
};

const addHour = (d) => {
    hour = (hour + 24 + d) % 24;
    updateHand((hour / 6 - 0.5) * Math.PI, hour >= 12 ? R_IN : R_OUT);
    setHour();
};

const addMonth = (d) => {
    whenMonth.setMonth(whenMonth.getMonth() + d);
    renderWhenCalendar();
};

dayButton.onclick = toDay;
hourButton.onclick = toHour;
minuteButton.onclick = toMinute;

$("when-prev").onclick = () => add(-1);
$("when-next").onclick = () => add(1);

whenDays.onclick = (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    whenDate = new Date(
        whenMonth.getFullYear(),
        whenMonth.getMonth(),
        +button.textContent,
    );
    setDay();
    toHour();
};

clock.addEventListener("pointerdown", (e) => {
    hand.setPointerCapture(e.pointerId);
    update(e);
});

clock.addEventListener("pointermove", (e) => {
    if (hand.hasPointerCapture(e.pointerId)) update(e);
});

clock.addEventListener("pointerup", (e) => {
    if (!hand.hasPointerCapture(e.pointerId)) return;
    update(e);
    hand.releasePointerCapture(e.pointerId);
    if (update === updateHour) toMinute();
});

clock.addEventListener("pointercancel", (e) => {
    if (hand.hasPointerCapture(e.pointerId))
        hand.releasePointerCapture(e.pointerId);
});

closeWhen.onclick = closeSheet;
applyWhen.onclick = applyWhenPicker;

// ==========================================================================
// 22. PRODUCT / DISH / RECIPE (#dish-page)
// ==========================================================================

let dish = null;
let microMode = "amount";
const dishMicroInputs = {};

const CUSTOM_ID_START = 1000000;

const nextFoodId = () => Math.max(CUSTOM_ID_START - 1, ...foods.map((f) => f.id)) + 1;

const DISH_LIMITS = {
    calories: {max: 900, decimals: 1},
    protein: {max: 100, decimals: 1},
    fat: {max: 100, decimals: 1},
    carbs: {max: 100, decimals: 1},
    fiber: {max: 100, decimals: 1},
    sugar: {max: 100, decimals: 1},
    salt: {max: 100, decimals: 2},
    satFat: {max: 100, decimals: 1},
    transFat: {max: 100, decimals: 1},
    freeSugar: {max: 100, decimals: 1},
};
const PREFILLED = ["fiber", "sugar", "salt", "satFat"];

const renderDishMicro = (micro = dish.micro || emptyMicro()) => {
    dishMicroFields.innerHTML = MICRO_KEYS.map((k) => {
        const unit = microMode === "pct" ? "%" : MICRO_UNITS[k];
        return `<label class="field">
            <span class="label">${clean(S[k])}</span>
            <span class="unit-field">
                <input id="dish-micro-${k}" class="input mono" type="text" inputmode="decimal">
                <span class="unit">${unit}</span>
            </span>
        </label>`;
    }).join("");

    MICRO_KEYS.forEach((k) => {
        const input = $(`dish-micro-${k}`);
        dishMicroInputs[k] = input;
        const normal = MICRO_NORMALS[k];
        const value = micro[k] || 0;
        input.value = fmt(
            microMode === "pct" && normal ? (value / normal) * 100 : value,
            1,
        );
        input.readOnly = dish.kind === "recipe";
        if (!input.readOnly) input.removeAttribute("readonly");
        input.closest(".unit-field").addEventListener(
            "click",
            () => input.focus(),
        );
        maskNumber(input, 100000, 1);
        input.addEventListener("input", () => {
            const amount = parseNumber(input.value) || 0;
            dish.micro[k] = microMode === "pct" && normal
                ? (amount / 100) * normal
                : amount;
            updateDish();
        });
    });

    setSegment(dishMicroMode, microMode, "mode");
};

const openDishPage = ({food = null, name = "", action}) => {

    dish = food
        ? {
            editing: food,
            action,
            kind: food.kind,
            basis: "100",
            ingredients: food.ingredients.map((i) => ({...i})),
            micro: food.micro ? {...food.micro} : emptyMicro(),
            tags: new Set(food.tags || []),
        }
        : {
            action,
            kind: "product",
            basis: "100",
            ingredients: [],
            micro: emptyMicro(),
            tags: new Set(),
        };

    dishName.value = food ? food[lang] : name;
    Object.entries(dishInputs).forEach(([k, input]) => {
        input.value = food ? fmt(food.nutrition[k], DISH_LIMITS[k].decimals) : "";
        delete input.dataset.auto;
    });
    dishServing.value = food ? String(food.servingGrams) : "";
    delete dishServing.dataset.auto;
    dishYield.value = food?.yieldGrams ? String(food.yieldGrams) : "";
    dishMicro.classList.add("hidden");
    toggleMicro.textContent = S.showMicro;
    dishArchive.classList.toggle("hidden", !food);

    microMode = "amount";
    setSegment(dishKind, dish.kind, "kind");
    setSegment(dishBasis, dish.basis, "basis");
    setSegment(dishMicroMode, microMode, "mode");

    renderPage("dish", false);
    renderDishKind();
    renderDishMicro();
    renderIngredients();
    renderDishTags();
    updateDish();
};

const closeDishPage = (food) => {
    const action = dish.action;

    if (action.type === "ingredientAdd") {
        const recipe = action.recipe;
        dish = recipe.dish;
        if (food) {
            dish.ingredients.push({
                foodId: food.id,
                grams: food.servingGrams || DEFAULT_SERVING,
            });
        }

        renderPage("dish", false);
        dishName.value = recipe.name;
        dishServing.value = recipe.serving;
        dishYield.value = recipe.yield;
        microMode = recipe.microMode;
        dishMicro.classList.toggle("hidden", recipe.microHidden);
        toggleMicro.textContent = recipe.microHidden ? S.showMicro : S.hideMicro;
        dishArchive.classList.toggle("hidden", !dish.editing);
        setSegment(dishKind, dish.kind, "kind");
        setSegment(dishBasis, dish.basis, "basis");
        renderDishKind();
        renderDishMicro();
        renderIngredients();
        renderDishTags();
        updateDish();
        document.querySelector("#dish-page .scroll").scrollTop = recipe.scroll;
        return;
    }

    dish = null;
    renderPage("meal", false);

    if (food && action.type === "add") {
        meal.items.push(makeItem(food, food.servingGrams, "manual"));
        addFoodTags(food);
    }
    if (food && action.type === "replace") {
        const old = meal.items[action.index];
        meal.items[action.index] = {
            ...makeItem(food, old.grams, "manual"),
            fragment: old.fragment,
        };
        addFoodTags(food);
    }
    renderMeal();
};

const renderDishKind = () => {
    const recipe = dish.kind === "recipe";
    dishBasis.classList.toggle("hidden", recipe);
    dishYieldField.classList.toggle("hidden", !recipe);
    ingredientsBlock.classList.toggle("hidden", !recipe);
    Object.values(dishInputs).forEach((input) => (input.readOnly = recipe));
    Object.values(dishMicroInputs).forEach((input) => (input.readOnly = recipe));
};

onSegment(dishKind, "kind", (kind) => {
    dish.kind = kind;
    renderDishKind();
    if (dish.editing && kind !== "recipe") matchRef();
    updateDish();
});

onSegment(dishBasis, "basis", (basis) => {
    dish.basis = basis;
    updateDish();
});

onSegment(dishMicroMode, "mode", (mode) => {
    microMode = mode;
    renderDishMicro();
});

/* --- Micronutrients and portion prefill from REFS --- */

const prefill = (input, value, decimals) => {
    if (input.value !== "" && !input.dataset.auto) return;
    input.value = fmt(value, decimals);
    input.dataset.auto = "1";
};

const matchRef = () => {
    const match = matchFood(dishName.value, REFS);
    dish.refName = match ? match.food[lang] : null;

    if (match) {
        const f = match.food;
        dish.micro = {...(f.micro || emptyMicro())};
        renderDishMicro();
        prefill(dishServing, f.servingGrams, 0);
        PREFILLED.forEach((k) =>
            prefill(dishInputs[k], f.nutrition[k], DISH_LIMITS[k].decimals),
        );
    }
    updateDish();
};

const matchRefLater = debounce(() => {
    if (dish?.editing && dish.kind !== "recipe") matchRef();
}, 400);

dishName.addEventListener("input", () => {
    if (dish.editing) matchRefLater();
    updateDish();
});

Object.entries(dishInputs).forEach(([k, input]) => {
    const {max, decimals} = DISH_LIMITS[k];
    maskNumber(input, max, decimals);
    input.addEventListener("input", () => {
        delete input.dataset.auto;
        updateDish();
    });
});

[dishServing, dishYield].forEach((input) => {
    maskNumber(input, MAX_GRAMS, 0);
    input.addEventListener("input", () => {
        delete input.dataset.auto;
        updateDish();
    });
});

/* --- Reading and validating the form --- */

const readDish = () => {
    const name = dishName.value.trim();
    const serving = parseNumber(dishServing.value);

    if (dish.kind === "recipe") {
        const yieldGrams = parseNumber(dishYield.value);
        const recipe = computeFromIngredients(dish.ingredients, yieldGrams);
        const grams = yieldGrams || recipe.grams;
        return {
            valid: !!name && dish.ingredients.length > 0 && recipe.grams > 0,
            nutrition: recipe.nutrition,
            micro: recipe.micro,
            grams: recipe.grams,
            servingGrams: serving || grams || DEFAULT_SERVING,
            yieldGrams: grams || null,
            recipe,
        };
    }

    const values = Object.fromEntries(
        NUTRIENT_KEYS.map((k) => [k, parseNumber(dishInputs[k].value) || 0]),
    );
    const base = dish.basis === "serving" ? serving : 100;
    const nutrition = Object.fromEntries(
        NUTRIENT_KEYS.map((k) => [
            k,
            base > 0 ? ((values[k] || 0) / base) * 100 : 0,
        ]),
    );
    return {
        valid:
            !!name &&
            values.calories != null &&
            base > 0 &&
            nutrition.protein + nutrition.fat + nutrition.carbs <= 100,
        nutrition,
        micro: dish.micro || emptyMicro(),
        servingGrams: serving || DEFAULT_SERVING,
        yieldGrams: null,
    };
};

const updateDish = () => {
    if (!dish) return;
    const dst = readDish();

    if (dish.kind === "recipe") {
        dish.micro = dst.micro;
        Object.entries(dishInputs).forEach(([k, input]) => {
            input.value = fmt(dst.nutrition[k], DISH_LIMITS[k].decimals);
        });
        ingredientsTotal.innerHTML = dish.ingredients.length > 1
            ? `<div class="small help mono">${macrosText(dst.nutrition, dst.grams / 100)}</div><div>${fmt(dst.grams)} ${S.g}</div>`
            : "";
        renderDishMicro();
    }
    dishServing.placeholder = String(
        dish.kind === "recipe" && dst.yieldGrams ? dst.yieldGrams : 100,
    );

    dishSave.disabled = !dst.valid;
    dishMicroSource.textContent =
        dish.kind !== "recipe" && dish.refName ? S.microFrom(dish.refName) : "";
};

toggleMicro.onclick = () => {
    const hidden = dishMicro.classList.toggle("hidden");
    toggleMicro.textContent = hidden ? S.showMicro : S.hideMicro;
};

/* --- Ingredients --- */

const renderIngredients = () => {
    ingredientsList.innerHTML = dish.ingredients
        .map(({foodId, grams}, i) => {
            const food = findFood(foodId);
            if (!food) return "";
            return itemHtml(makeItem(food, grams, "ingredient"), i);
        })
        .join("");
};

ingredientsList.onclick = (e) => {
    const card = e.target.closest(".card-item");
    if (card) openPortion(+card.dataset.i, "ingredient");
};

ingredientsList.onkeydown = (e) => {
    const card = e.target.closest(".card-item");
    if (card && e.target === card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        openPortion(+card.dataset.i, "ingredient");
    }
};

addIngredient.onclick = () => openSearch("ingredient");

/* --- Tags and photo --- */

const renderDishTags = () => {
    dishTags.innerHTML = tags
        .map((tag) =>
            `<button class="tap ${dish.tags.has(tag) ? "selected" : ""}">${clean(tag)}</button>`,
        )
        .join("");
    [...dishTags.children].forEach((q, i) => (q.dataset.tag = tags[i]));
};

bindTagChips(dishTags, () => dish.tags);

/* --- Save --- */

dishSave.onclick = () => {
    const r = readDish();
    if (!r.valid) return;

    const food = {
        id: dish.editing ? dish.editing.id : nextFoodId(),
        kind: dish.kind,
        ru: dishName.value.trim(),
        aliases: [],
        nutrition: r.nutrition,
        micro: r.micro,
        ingredients: dish.kind === "recipe" ? dish.ingredients.filter((i) => i.grams > 0) : [],
        yieldGrams: dish.kind === "recipe" ? r.yieldGrams : null,
        servingGrams: Math.round(r.servingGrams),
        pieceGrams: null,
        healthScore: computeHealth(r.nutrition, r.micro),
        tags: [...dish.tags],
        custom: true,
        archived: false,
    };

    const i = foods.findIndex(({id}) => id === food.id);
    if (i >= 0) foods[i] = food;
    else foods.push(food);
    saveFoods();

    closeDishPage(food);
};

dishCancel.onclick = () => closeDishPage(null);

dishArchive.onclick = () =>
    showModal(S.deleteFoodQuestion, () => {
        const i = foods.findIndex(({id}) => id === dish.editing.id);
        foods[i] = {...foods[i], archived: true};
        saveFoods();
        favorites = favorites.filter((id) => id !== foods[i].id);
        saveFavorites();
        closeDishPage(null);
    });

// ==========================================================================
// 23. PROFILE
// ==========================================================================

const birthdate = {digits: "", cursor: 0};

/* --- Daily log rings --- */

const ringHtml = ({kind, value, delta, target, label, color}) => {
    let ring;
    let tick = '';

    if (Math.abs(delta) > target) {
        const d = delta > 0 ? "M 29 0 L 32 4 L 29 9" : "M 35 0 L 32 4 L 35 9";
        ring = `<circle class="fill" cx="32" cy="32" r="28" stroke="var(${color})" />`;
        tick = `<path d="${d}" stroke="var(--bg)" stroke-width="2" transform="rotate(${360 * delta / target} 32 32)"/>`;
    } else {
        const ratio = Math.abs(delta / target);
        const length = RING_LENGTH * ratio;
        const angle = 90 + (delta < 0) * 360 * ratio;
        ring = `<circle class="fill" cx="32" cy="32" r="28"
            style="stroke:var(${color});stroke-dasharray:${length} ${RING_LENGTH}"
            transform="rotate(-${angle} 32 32)"/>`
    }

    return `<button class="ring" data-kind="${kind}" aria-label="${label}">
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle class="track" cx="32" cy="32" r="28"></circle>
            ${ring}
            ${tick}
        </svg>
        <div class="ring-value mono">${fmt(value, 1)}</div>
        <div class="small help center">${label}</div>
    </button>`;
};

const renderLogRings = () => {
    const key = getDateKey(date);
    const t = person.targets;
    const weight = getValue('weight', key);
    const prevWeight = getPrevValue('weight', key);
    const delta = prevWeight ? weight - prevWeight : 0;
    const steps = getValue('steps', key);
    const sleep = getValue('sleep', key);
    const water = getValue('water', key);

    logRings.innerHTML = [
        {
            kind: "weight",
            target: 1,
            delta: delta,
            value: weight,
            label: S.weight,
            unit: S.kg,
            color: "--red",
        },
        {
            kind: "steps",
            target: t.steps,
            delta: steps,
            value: steps,
            label: S.steps,
            unit: S.logUnits.steps,
            color: "--yellow",
        },
        {
            kind: "sleep",
            target: t.sleep,
            delta: sleep,
            value: sleep,
            label: S.sleep,
            unit: S.h,
            color: "--green",
        },
        {
            kind: "water",
            target: t.water,
            delta: water,
            value: round(water / 1000, 1),
            label: S.water,
            unit: S.l,
            color: "--blue",
        },
    ]
        .map(ringHtml)
        .join("");
};

const renderDayRings = () => {
    const s = sumMeals(getDateKey(date));
    if (!s) {
        dayRings.innerHTML = "";
        return;
    }
    const g = person.goals;

    dayRings.innerHTML = [
        {
            kind: "calories",
            target: g.calories,
            delta: s.calories,
            value: round(s.calories),
            label: S.calories,
            unit: S.kcal,
            color: "--red",
        },
        {
            kind: "protein",
            target: g.protein,
            delta: s.protein,
            value: round(s.protein),
            label: S.protein,
            unit: S.g,
            color: "--blue",
        },
        {
            kind: "fat",
            target: g.fat,
            delta: s.fat,
            value: round(s.fat),
            label: S.fat,
            unit: S.g,
            color: "--yellow",
        },
        {
            kind: "carbs",
            target: g.carbs,
            delta: s.carbs,
            value: round(s.carbs),
            label: S.carbs,
            unit: S.g,
            color: "--green",
        },
    ]
        .map(ringHtml)
        .join("");
};

logRings.onclick = (e) => {
    const ring = e.target.closest("[data-kind]");
    if (ring) openLogSheet(ring.dataset.kind);
};

const labelFor = (key) => calculatedInputs[key].closest('.field').firstElementChild;

const setManual = (key, manual) => {
    person.manual = person.manual.filter((k) => k !== key);
    if (manual) person.manual.push(key);
    labelFor(key).classList.toggle("accent", manual);
};

const renderPerson = () => {
    if (person.birthdate) {
        const s = String(person.birthdate);
        birthdate.digits = s.slice(6, 8) + s.slice(4, 6) + s.slice(0, 4);
        birthdate.cursor = birthdate.digits.length;
        birthdateInput.value = formatDate();
    } else {
        birthdate.digits = "";
        birthdate.cursor = 0;
        birthdateInput.value = "";
    }

    setSegment(sexInput, person.sex ? "male" : "female", "sex");
    activityInput.value = person.activity;
    renderActivityLevel();

    heightInput.value = fmt(person.height, 0);
    weightInput.value = fmt(person.weight, 1);

    const t = person.targets;
    targetInput.sleep.value = fmt(t.sleep, 1);
    targetInput.steps.value = String(t.steps);
    targetInput.water.value = String(t.water);
    targetInput.weight.value = fmt(t.weight, 1);

    GOAL_KEYS.forEach(k => goalInput[k].value = fmt(person.goals[k], 0));
    Object.keys(calculatedInputs).forEach((key) => labelFor(key).classList.toggle("accent", person.manual.includes(key)));
};

/* --- Save on blur --- */

const updateLogsWeight = () => {
    const key = getDateKey(Date.now());
    logs.weight = logs.weight.filter(q => q.key !== key);
    logs.weight.push({key, value: person.weight});
    write('weight', logs.weight);
}

const applyPersonForm = () => {
    person.birthdate = getBirthdate();
    person.height = parseNumber(heightInput.value) || person.height;

    const weight = parseNumber(weightInput.value);
    if (weight && weight !== person.weight) {
        person.weight = weight;
        updateLogsWeight();
    }
    TARGET_KEYS.forEach(name =>
        person.targets[name] = parseNumber(targetInput[name].value) || person.targets[name]);

    GOAL_KEYS.forEach(name =>
        person.goals[name] = parseNumber(goalInput[name].value) || person.goals[name]);

    savePerson();
    renderPerson();
};

[
    birthdateInput,
    heightInput,
    weightInput,
    ...targetInputs,
    ...goalInputs,
].forEach((input) => input.addEventListener("blur", applyPersonForm));

Object.entries(calculatedInputs).forEach(([key, input]) => {
    input.addEventListener("input", () => setManual(key, true));
    labelFor(key).addEventListener("click", (e) => {
        if (!person.manual.includes(key)) return;
        e.preventDefault();
        setManual(key, false);
        savePerson();
        renderPerson();
    });
});

onSegment(sexInput, "sex", (value) => {
    person.sex = value === "male" ? 1 : 0;
    savePerson();
    renderPerson();
});

/* --- Activity slider --- */

const ACTIVITY_LEVELS = [1.2, 1.375, 1.55, 1.725, 1.9];

const renderActivityLevel = () => {
    const i = ACTIVITY_LEVELS.reduce(
        (best, l, j) =>
            Math.abs(person.activity - l) <
            Math.abs(person.activity - ACTIVITY_LEVELS[best])
                ? j
                : best,
        0,
    );
    activityLevel.textContent = `${S.activityLevels[i]}`;
    activityInput.style.setProperty("--value", `${person.activity * 100 - 100}%`);
};

activityInput.addEventListener("input", () => {
    person.activity = +activityInput.value;
    renderActivityLevel();
});

// Плавный слайдер: сохраняем при отпускании, как остальные поля
activityInput.addEventListener("change", () => {
    savePerson();
    renderPerson();
});


maskNumber(heightInput, 250, 0);
maskNumber(weightInput, 500, 1);
maskNumber(targetInput.sleep, 24, 1);
maskNumber(targetInput.steps, 100000, 0);
maskNumber(targetInput.water, 20000, 0);
maskNumber(targetInput.weight, 500, 1);
maskNumber(goalInput.calories, 10000, 0);
maskNumber(goalInput.protein, 1000, 1);
maskNumber(goalInput.fat, 1000, 1);
maskNumber(goalInput.carbs, 1000, 1);
maskNumber(goalInput.fiber, 200, 1);
maskNumber(goalInput.sugar, 500, 1);
maskNumber(goalInput.salt, 50, 1);
maskNumber(goalInput.satFat, 200, 1);

/* --- Birthdate --- */

const YY = new Date().getFullYear() % 100;

const formatDate = () => {
    if (!birthdate.digits) return "";
    const d =
        birthdate.digits.slice(0, 2) + (birthdate.digits.length >= 2 ? "." : "");
    const m =
        birthdate.digits.slice(2, 4) + (birthdate.digits.length >= 4 ? "." : "");
    const y = birthdate.digits.slice(4);
    return d + m + y;
};

const normalize = () => {
    if (birthdate.cursor < birthdate.digits.length)
        birthdate.digits = birthdate.digits.slice(0, birthdate.cursor);

    if (+birthdate.digits[0] > 3) birthdate.digits = "0" + birthdate.digits;

    if (birthdate.digits.length >= 2) {
        const d = +birthdate.digits.slice(0, 2);
        if (d > 31) birthdate.digits = "0" + birthdate.digits;
        else if (d === 0) birthdate.digits = "01" + birthdate.digits.slice(2);
    }

    if (birthdate.digits.length >= 3 && +birthdate.digits[2] > 1)
        birthdate.digits =
            birthdate.digits.slice(0, 2) + "0" + birthdate.digits.slice(2);

    if (birthdate.digits.length >= 4) {
        const d = birthdate.digits.slice(0, 2);
        const m = +birthdate.digits.slice(2, 4);
        if (m > 12) birthdate.digits = d + "0" + birthdate.digits.slice(2);
        else if (m === 0) birthdate.digits = d + "01" + birthdate.digits.slice(4);
    }

    if (birthdate.digits.length >= 6) {
        const y = birthdate.digits.slice(4, 6);
        if (y !== "19" && y !== "20") {
            birthdate.digits =
                birthdate.digits.slice(0, 4) + (+y <= YY ? "20" : "19") + y;
        }
    }

    birthdate.digits = birthdate.digits.slice(0, 8);
    birthdate.cursor = birthdate.digits.length;
};

const setValue = () => {
    birthdateInput.value = formatDate();
    let p = birthdate.cursor;
    if (birthdate.cursor >= 2) p++;
    if (birthdate.cursor >= 4) p++;
    p = Math.min(p, birthdateInput.value.length);
    birthdateInput.setSelectionRange(p, p);
};

const rawPosition = (p) =>
    birthdateInput.value.slice(0, p).replace(/\D/g, "").length;

birthdateInput.addEventListener("beforeinput", (e) => {
    if (e.inputType === "insertText" && e.data === ".") {
        e.preventDefault();
        if (birthdate.cursor === 1) {
            birthdate.digits = "0" + birthdate.digits;
            birthdate.cursor = 2;
            setValue();
        } else if (birthdate.cursor === 3) {
            birthdate.digits =
                birthdate.digits.slice(0, 2) + "0" + birthdate.digits.slice(2);
            birthdate.cursor = 4;
            setValue();
        }
        return;
    }

    if (e.inputType === "insertText" || e.inputType === "insertFromPaste") {
        e.preventDefault();
        const p = (e.data || "").replace(/\D/g, "");
        if (!p || birthdate.cursor >= 8) return;

        birthdate.digits =
            birthdate.digits.slice(0, birthdate.cursor) +
            p +
            birthdate.digits.slice(birthdate.cursor);
        birthdate.cursor += p.length;
        normalize();
        setValue();
        return;
    }

    if (e.inputType === "deleteContentBackward") {
        e.preventDefault();
        if (!birthdate.cursor) return;

        if (birthdate.cursor === 8 && birthdate.digits.length === 8) {
            const y = birthdate.digits.slice(4);
            if (y.slice(0, 2) !== "19" && y.slice(0, 2) !== "20") {
                birthdate.digits = birthdate.digits.slice(0, 4) + y.slice(2);
                birthdate.cursor = 6;
                setValue();
                return;
            }
        }

        birthdate.digits =
            birthdate.digits.slice(0, birthdate.cursor - 1) +
            birthdate.digits.slice(birthdate.cursor);
        birthdate.cursor--;
        normalize();
        setValue();
    }
});

birthdateInput.addEventListener("click", () => {
    birthdate.cursor = rawPosition(birthdateInput.selectionStart);
});

birthdateInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
        e.preventDefault();
        birthdate.cursor = Math.max(0, birthdate.cursor - 1);
        setValue();
    }
    if (e.key === "ArrowRight") {
        e.preventDefault();
        birthdate.cursor = Math.min(8, birthdate.cursor + 1);
        setValue();
    }
});

birthdateInput.addEventListener("paste", (e) => {
    e.preventDefault();
    const value = e.clipboardData.getData("text").trim();
    const parts = value.split(/[.\-/\s]+/);

    if (parts.length >= 3) {
        let [d, m, y] = parts;
        d = d.replace(/\D/g, "");
        m = m.replace(/\D/g, "");
        y = y.replace(/\D/g, "");

        if (d.length === 1) d = "0" + d;
        if (m.length === 1) m = "0" + m;

        if (y.length === 1) y = "200" + y;
        else if (y.length === 2) y = (+y <= YY ? "20" : "19") + y;
        else y = y.slice(0, 4);

        birthdate.digits = (d + m + y).slice(0, 8);
    } else {
        birthdate.digits = value.replace(/\D/g, "").slice(0, 8);
        normalize();
    }

    birthdate.cursor = birthdate.digits.length;
    setValue();
});

const getBirthdate = () => {
    if (birthdate.digits.length !== 8) return false;

    const d = +birthdate.digits.slice(0, 2);
    const m = +birthdate.digits.slice(2, 4);
    const y = +birthdate.digits.slice(4, 8);
    const dst = new Date(y, m - 1, d);

    if (dst.getFullYear() !== y ||
        dst.getMonth() !== m - 1 ||
        dst.getDate() !== d ||
        dst > new Date()) return null;

    return y * 10000 + m * 100 + d;
};

/* --- Export, Import, Reset --- */

exportButton.onclick = exportData;
importButton.onclick = () => importInput.click();

importInput.onchange = async () => {
    const file = importInput.files[0];
    importInput.value = "";
    if (!file) return;
    let data = null;
    try {
        data = JSON.parse(await file.text());
    } catch {
        data = null;
    }
    if (!validImport(data)) return showMessage(S.importError);
    showModal(S.importQuestion, () => importData(data));
};

resetButton.onclick = () => showModal(S.resetQuestion, resetData);

// ==========================================================================
// 24. STATISTICS: PERIOD AND BUCKETS
// ==========================================================================

let period = WEEK;
let currentDate = new Date();
let nutrientMode = "sum";

const getRange = (d, p) => {
    d = startOfDay(d);
    if (p === DAY) return [d, addDays(d, 1)];
    if (p === WEEK) {
        const start = getMonday(d);
        return [start, addDays(start, 7)];
    }
    const start = getMonday(new Date(d.getFullYear(), d.getMonth(), 1));
    const end = addDays(
        getMonday(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
        7,
    );
    return [start, end];
};

const getBuckets = (start, end, p) => {
    const buckets = [];
    if (p === DAY) {
        for (let h = 0; h < 24; h += 6) {
            const s = new Date(start);
            s.setHours(h);
            const e = new Date(start);
            e.setHours(h + 6);
            buckets.push({
                label: String(h),
                title: `${pad(h)}:00–${pad(h + 6)}:00`,
                start: s,
                end: e,
            });
        }
    } else if (p === WEEK) {
        for (let i = 0; i < 7; i++) {
            const d = addDays(start, i);
            buckets.push({
                label: S.wds[i],
                title: `${S.wds[i]}, ${getDateText(d)}`,
                start: d,
                end: addDays(start, i + 1),
            });
        }
    } else {
        for (let s = new Date(start); s < end; s = addDays(s, 7)) {
            buckets.push({
                label: String(s.getDate()),
                title: `${getDateText(s)} — ${getDateText(addDays(s, 6))}`,
                start: new Date(s),
                end: addDays(s, 7),
            });
        }
    }
    return buckets;
};

const renderRange = () => {
    const [start, end] = getRange(currentDate, period);
    if (period === DAY) rangeLabel.textContent = getDateText(start);
    else if (period === WEEK) {
        rangeLabel.innerHTML = `<span>${getDateText(start)}</span><span>—</span><span>${getDateText(addDays(end, -1))}</span>`;
    } else
        rangeLabel.textContent = `${S.months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
};

const shiftRange = (direction) => {
    if (period === DAY) currentDate = addDays(currentDate, direction);
    else if (period === WEEK) currentDate = addDays(currentDate, direction * 7);
    else {
        currentDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + direction,
            1,
        );
    }
    renderRange();
};

/* --- Aggregation --- */

// Bucket days that have already passed
const pastDays = (start, end) => {
    const days = [];
    const limit = startOfDay(new Date());
    for (let d = startOfDay(start); d < end && d <= limit; d = addDays(d, 1)) {
        days.push(d);
    }
    return days;
};

const DAY_SUM_KEYS = [
    "calories",
    "protein",
    "fat",
    "carbs",
    "fiber",
    "sugar",
    "salt",
    "satFat",
];

const daySummaryOf = (list) => {
    // Group items by meal type in one pass, without repeated filtering
    const all = [];
    const byType = {};
    for (const m of list) {
        all.push(...m.items);
        (byType[m.type] ??= []).push(...m.items);
    }
    const s = sumItems(all);
    return {
        ...Object.fromEntries(DAY_SUM_KEYS.map((k) => [k, s[k]])),
        health: s.healthScore,
        count: list.length,
        ...Object.fromEntries(
            MEAL_TYPES.map((t) => [t, byType[t] ? sumItems(byType[t]).calories : 0]),
        ),
    };
};

const SUMMARY_KEYS = [...NUTRIENT_KEYS, "health", "count", ...MEAL_TYPES];

const averageSummaries = (list) => {
    if (!list.length) return null;
    const dst = {};
    SUMMARY_KEYS.forEach((k) => {
        const values = list.map((x) => x[k]).filter((v) => v != null);
        dst[k] = values.length
            ? values.reduce((a, v) => a + v, 0) / values.length
            : null;
    });
    return dst;
};

// Day/Week/Month at day level: the average day that has entries
const aggregateDays = (b) =>
    averageSummaries(
        pastDays(b.start, b.end)
            .map((d) => getMeals(getDateKey(d)))
            .filter((list) => list.length)
            .map(daySummaryOf),
    );

const aggregate = (b) => {
    if (b.start > new Date()) return null;
    if (period !== DAY) return aggregateDays(b);
    const list = meals.filter((m) => m.eaten >= b.start && m.eaten < b.end);
    return list.length ? daySummaryOf(list) : null;
};

const aggregateWater = (b) => {
    if (b.start > new Date()) return null;
    // Water is logged as a daily total
    if (period === DAY) return getValue('water', getDateKey(b.start));
    const values = pastDays(b.start, b.end)
        .map(d => getValue('water', getDateKey(d)))
        .filter((v) => v > 0);
    return values.length
        ? values.reduce((a, v) => a + v, 0) / values.length
        : null;
};

const cumulative = (values, buckets) => {
    let acc = 0;
    return values.map((v, i) => {
        if (buckets[i].start > new Date()) return null;
        acc += v || 0;
        return acc;
    });
};

const inNorm = (key) => {
    if (!getMeals(key).length) return false;
    const ratio = sumMeals(key).calories / person.goals.calories;
    return ratio >= 0.8 && ratio <= 1.1;
};

const getNormStreak = () => {
    let days = 0;
    let d = addDays(today, -1);
    while (inNorm(getDateKey(d))) {
        days++;
        d = addDays(d, -1);
    }
    return days;
};

// ==========================================================================
// 25. STATISTICS: UNIVERSAL RENDERERS (SVG)
// ==========================================================================

const CHART_HEIGHT = 200;
const PAD = {l: 40, r: 10, t: 12, b: 24};
const chartTips = new Map();

const empty = (id) => {
    $(id).innerHTML = `<div class="empty">${S.noData}</div>`;
};

const niceStep = (range) => {
    let step = range / 4;
    const p = 10 ** Math.floor(Math.log10(step || 1));
    return [1, 2, 2.5, 5, 10].find(k => k * p >= step) * p;
};


const scaleY = (min, max) => {
    const step = niceStep(max - min);
    const lo = Math.floor(min / step) * step;
    const hi = Math.max(lo + step, Math.ceil(max / step) * step);
    const ticks = [];
    for (let i = lo; i <= hi + step / 2; i += step) {
        ticks.push(i);
    }
    return {lo, hi, ticks};
};

const tickFormat = (ticks) => {
    const max = Math.max(...ticks.map(Math.abs));
    if (max >= 10000) return i => `${fmt(i / 1000)}k`;
    return i => fmt(i, max < 10 ? 1 : 0);
};

const frame = (id, height = CHART_HEIGHT) => {
    const q = $(id);
    const w = Math.max(260, q.clientWidth || 320);
    const plot = {x0: PAD.l, x1: w - PAD.r, y0: height - PAD.b, y1: PAD.t};
    return {q, w, h: height, plot};
};

const chartFrame = (id, height, buckets, scale) => {
    const {q, w, h, plot} = frame(id, height);
    const {x0, x1, y0, y1} = plot;
    const slot = (x1 - x0) / buckets.length;
    const {lo, hi} = scale;
    return {
        id, q, w, h, plot, scale, buckets, slot,
        x: i => x0 + slot * (i + 0.5),
        y: j => y0 - ((j - lo) / (hi - lo)) * (y0 - y1)
    };
};

const gridHtml = ({x0, x1}, {ticks}, y) => {
    const format = tickFormat(ticks);
    return ticks.map(j => `
        <line class="grid" x1="${x0}" x2="${x1}" y1="${y(j)}" y2="${y(j)}"></line>
        <text class="tick" x="${x0 - 6}" y="${y(j) + 4}" text-anchor="end">${format(j)}</text>`)
        .join("");
};

const xLabelsHtml = (buckets, x, {y0}) => buckets.map(
    (b, i) => `<text class="tick" x="${x(i)}" y="${y0 + 16}" text-anchor="middle">${clean(b.label)}</text>`
).join("");

const legendHtml = src => {
    if (!src.length) return "";
    const dst = src.map(({label, color, kind}) =>
        `<span class="legend-item"><i class="key ${kind}" style="--color:var(${color})"></i>${label}</span>`
    ).join("");
    return `<div class="legend">${dst}</div>`;
};

const normalLine = ({x0, x1}, y, value) => value == null
    ? ""
    : `<line class="normal" x1="${x0}" x2="${x1}" y1="${y(value)}" y2="${y(value)}"></line>`;

// Tip: title and lines {label, value, color}
const setTips = (id, tips) => chartTips.set(id, tips);

const hitRects = (id, n, x, {y0, y1}, slot) => {
    let dst = "";
    for (let i = 0; i < n; i++) {
        dst += `<rect class="hit" data-tip="${id}:${i}" x="${x(i) - slot / 2}" y="${y1}" width="${slot}" height="${y0 - y1}"></rect>`;
    }
    return dst;
};

const barPath = (x, y, w, h, up = true) => {
    if (h <= 0) return "";
    const r = Math.min(4, h, w / 2);
    const b = y + h;
    return up
        ? `M${x},${b}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${b}Z`
        : `M${x},${y}V${b - r}Q${x},${b} ${x + r},${b}H${x + w - r}Q${x + w},${b} ${x + w},${b - r}V${y}Z`;
};

const svg = (w, h, body) =>
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${body}</svg>`;

const chartSvg = ({id, w, h, plot, scale, buckets, x, y, slot}, marks) => svg(w, h,
    gridHtml(plot, scale, y) +
    marks +
    xLabelsHtml(buckets, x, plot) +
    hitRects(id, buckets.length, x, plot, slot)
);

const normalTips = (normal, decimals, unit, label) => normal == null
    ? []
    : [{label, value: `${fmt(normal, decimals)} ${unit}`, color: "--line"}];

const normalLegend = (normal, label) =>
    normal == null ? [] : [{label, color: "--line", kind: "dash"}];

const renderLine = (
    id,
    buckets,
    series,
    normal = {},
    auto = false,
    unit = "",
    decimals = 0
) => {
    const values = series.flatMap((s) => s.values).filter((v) => v != null);
    if (!values.length) return empty(id);

    const lo = auto ? Math.min(...values) : 0;
    const hi = Math.max(...values, normal.value || 0);
    const scale = auto
        ? scaleY(
            lo - Math.max(0.5, (hi - lo) * 0.2),
            hi + Math.max(0.5, (hi - lo) * 0.2),
        )
        : scaleY(0, hi * 1.08 || 1);

    const chart = chartFrame(id, CHART_HEIGHT, buckets, scale);
    const {q, plot, x, y} = chart;

    const paths = series
        .map((s) => {
            let d = "";
            let open = false;
            const dots = [];
            s.values.forEach((v, i) => {
                if (v == null) {
                    open = false;
                    return;
                }
                d += `${open ? "L" : "M"}${x(i)},${y(v)}`;
                const isolated = s.values[i - 1] == null && s.values[i + 1] == null;
                if (!s.thin && (isolated || i === s.values.length - 1 || s.values[i + 1] == null)) {
                    dots.push(i);
                }
                open = true;
            });
            return (
                `<path class="series ${s.dash ? "dash" : ""} ${s.thin ? "thin" : ""}" d="${d}" style="stroke:var(${s.color})"></path>` +
                dots.map(i => `<circle class="dot" cx="${x(i)}" cy="${y(s.values[i])}" r="4" style="fill:var(${s.color})"></circle>`).join("")
            );
        })
        .join("");

    setTips(
        id,
        buckets.map((b, i) => ({
            title: b.title || b.label,
            rows: [
                ...series
                    .filter((s) => s.values[i] != null)
                    .map((s) => ({
                        label: s.label,
                        value: `${fmt(s.values[i], decimals)} ${unit}`,
                        color: s.color,
                    })),
                ...normalTips(normal.value, decimals, unit, normal.label || S.norm),
            ],
        })),
    );

    q.innerHTML =
        chartSvg(chart, normalLine(plot, y, normal.value) + paths) +
        legendHtml([
            ...series.map((s) => ({
                label: s.label,
                color: s.color,
                kind: s.dash ? "dash" : "line",
            })),
            ...normalLegend(normal.value, normal.label || S.norm),
        ]);
};

const stackedTotals = (data, keys) =>
    data.map((row) =>
        row ? keys.reduce((sum, k) => sum + (row[k] || 0), 0) : 0,
    );

const setStackedTips = (id, buckets, keys, data, colors, labels, unit) =>
    setTips(
        id,
        buckets.map((b, i) => ({
            title: b.title || b.label,
            rows: keys.map((k) => ({
                label: labels[k],
                value: data[i] ? `${fmt(data[i][k])} ${unit}` : "—",
                color: colors[k],
            })),
        })),
    );

const stackedLegend = (keys, labels, colors) =>
    legendHtml(
        keys.map((k) => ({label: labels[k], color: colors[k], kind: "rect"})),
    );

const renderAreaStacked = (
    id,
    buckets,
    keys,
    data,
    colors,
    labels,
    unit = ""
) => {
    const totals = stackedTotals(data, keys);
    if (!totals.some((v) => v > 0)) return empty(id);

    const scale = scaleY(0, Math.max(...totals) * 1.08);
    const chart = chartFrame(id, CHART_HEIGHT, buckets, scale);
    const {q, x, y, slot} = chart;

    // One filled band per key, broken at buckets without data
    const stacks = data.map((row) => {
        let total = 0;
        return keys.map((k) => (total += row?.[k] || 0));
    });
    const runs = [];
    let run = [];
    data.forEach((row, i) => {
        if (row) run.push(i);
        else if (run.length) {
            runs.push(run);
            run = [];
        }
    });
    if (run.length) runs.push(run);

    const areas = runs
        .flatMap((indices) =>
            keys.map((key, j) => {
                const first = indices[0];
                const last = indices.at(-1);
                const lower = (i) => y(j ? stacks[i][j - 1] : 0);
                const top = [
                    `${x(first) - slot / 2},${y(stacks[first][j])}`,
                    ...indices.map((i) => `${x(i)},${y(stacks[i][j])}`),
                    `${x(last) + slot / 2},${y(stacks[last][j])}`,
                ];
                const bottom = [
                    `${x(last) + slot / 2},${lower(last)}`,
                    ...indices.map((i) => `${x(i)},${lower(i)}`).reverse(),
                    `${x(first) - slot / 2},${lower(first)}`,
                ];
                return `<path class="area" d="M${top.join("L")}L${bottom.join("L")}Z" style="fill:var(${colors[key]})"></path>`;
            }),
        )
        .join("");

    setStackedTips(id, buckets, keys, data, colors, labels, unit);
    q.innerHTML = chartSvg(chart, areas) + stackedLegend(keys, labels, colors);
};

const renderVBars = (
    id,
    buckets,
    series,
    normal = null,
    unit = "",
    decimals = 0,
    height = CHART_HEIGHT,
    legend = null
) => {
    const values = series.flatMap((s) => s.values).filter((v) => v != null && v !== 0);
    if (!values.length) return empty(id);

    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values, normal || 0);
    const scale = scaleY(lo * 1.08, hi * 1.08 || 1);
    const chart = chartFrame(id, height, buckets, scale);
    const {q, plot, x, y, slot} = chart;
    const bw = Math.min(24, (slot * 0.6) / series.length);

    const bars = series
        .map((s, j) =>
            s.values
                .map((v, i) => {
                    if (v == null || v === 0) return "";
                    const color = typeof s.color === "function" ? s.color(v) : s.color;
                    const x0 =
                        x(i) -
                        (bw * series.length) / 2 -
                        (series.length - 1) +
                        j * (bw + 2);
                    const top = Math.min(y(0), y(v));
                    const barHeight = Math.abs(y(v) - y(0));
                    return `<path d="${barPath(x0, top, bw, barHeight, v > 0)}" style="fill:var(${color})"></path>`;
                })
                .join(""),
        )
        .join("");

    const zero = lo < 0
        ? `<line class="axis" x1="${plot.x0}" x2="${plot.x1}" y1="${y(0)}" y2="${y(0)}"></line>`
        : "";

    setTips(
        id,
        buckets.map((b, i) => ({
            title: b.title || b.label,
            rows: [
                ...series
                    .filter((s) => s.values[i] != null)
                    .map((s) => ({
                        label: s.label,
                        value: `${s.values[i] > 0 && lo < 0 ? "+" : ""}${fmt(s.values[i], decimals)} ${unit}`,
                        color: typeof s.color === "function" ? s.color(s.values[i]) : s.color,
                    })),
                ...normalTips(normal, decimals, unit, S.norm),
            ],
        })),
    );

    if (!legend) {
        legend = series.map((s) => ({label: s.label, color: s.color, kind: "rect"}));
        if (normal != null) {
            legend.push({label: S.norm, color: "--line", kind: "dash"});
        }
    }
    q.innerHTML = chartSvg(chart, zero + bars + normalLine(plot, y, normal)) + legendHtml(legend);
};

const renderHeatmap = (id, matrix, max) => {
    if (!max) return empty(id);
    const q = $(id);
    const w = Math.max(260, q.clientWidth || 320);
    const left = 16;
    const cell = (w - left - 4) / 24;
    const ch = cell - 2; // square cell with a 2px gutter on both axes
    const h = 7 * (ch + 2) + 20;

    const cells = matrix.map((row, d) => row.map((v, hr) => {
        const alpha = v ? Math.max(0.12, v / max) : 0;
        return `<rect class="cell ${v ? "" : "zero"}" x="${left + hr * cell}" y="${d * (ch + 2)}" width="${cell - 2}" height="${ch}" rx="2"
                    style="${v ? `fill:var(--accent);fill-opacity:${alpha}` : ""}" data-tip="${id}:${d * 24 + hr}"></rect>`;
    }).join("")).join("");

    const rows = [...S.Ws].map((w, d) =>
        `<text class="tick" x="${left - 6}" y="${d * (ch + 2) + ch / 2}" dominant-baseline="middle" text-anchor="end">${w}</text>`,
    ).join("");
    const cols = [0, 3, 6, 9, 12, 15, 18, 21].map((hr) =>
        `<text class="tick" x="${left + hr * cell}" y="${h - 4}" dominant-baseline="auto" text-anchor="start">${hr}</text>`,
    ).join("");

    setTips(
        id,
        matrix.flatMap((row, d) =>
            row.map((v, hr) => ({
                title: `${S.wds[d]} ${pad(hr)}:00`,
                rows: [
                    {
                        label: S.calories,
                        value: `${fmt(v)} ${S.kcal}`,
                        color: "--accent",
                    },
                ],
            })),
        ),
    );

    q.innerHTML = svg(w, h, cells + rows + cols);
};

/* --- Tip --- */

const showTip = (target, x, y) => {
    const [id, i] = target.dataset.tip.split(":");
    const tip = chartTips.get(id)?.[+i];
    if (!tip) return;
    chartTip.replaceChildren();
    const title = document.createElement("div");
    title.className = "tip-title";
    title.textContent = tip.title;
    chartTip.appendChild(title);
    tip.rows.forEach((r) => {
        const row = document.createElement("div");
        row.className = "tip-row";
        const key = document.createElement("i");
        key.style.setProperty("--color", `var(${r.color})`);
        const value = document.createElement("b");
        value.textContent = r.value;
        const label = document.createElement("span");
        label.textContent = r.label;
        row.append(key, value, label);
        chartTip.appendChild(row);
    });
    chartTip.hidden = false;
    const rect = chartTip.getBoundingClientRect();
    chartTip.style.left = `${Math.min(window.innerWidth - rect.width - 8, Math.max(8, x - rect.width / 2))}px`;
    chartTip.style.top = `${Math.max(8, y - rect.height - 16)}px`;
    document
        .querySelectorAll(".hovered")
        .forEach((el) => el.classList.remove("hovered"));
    target.classList.add("hovered");
};

const hideTip = () => {
    chartTip.hidden = true;
    document
        .querySelectorAll(".hovered")
        .forEach((el) => el.classList.remove("hovered"));
};

pages.stats.addEventListener("pointerover", (e) => {
    const target = e.target.closest("[data-tip]");
    if (target) showTip(target, e.clientX, e.clientY);
});
pages.stats.addEventListener("pointerout", (e) => {
    if (e.target.closest("[data-tip]") && e.pointerType === "mouse") hideTip();
});
pages.stats.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("[data-tip]")) hideTip();
});
window.addEventListener("scroll", hideTip, {passive: true});

// ==========================================================================
// 26. STATISTICS: 15 CHARTS
// ==========================================================================

const setChartValue = (id, text) => {
    const q = $(id).closest(".card").querySelector(".value");
    if (q) q.textContent = text || "";
};

const setDayAverage = (id, value, unit, decimals = 0) => {
    setChartValue(
        id,
        value == null ? "" : `${fmt(value, decimals)} ${unit} / ${S.dayShort}`,
    );
};

const average = (values) => {
    const list = values.filter((v) => v != null);
    return list.length ? list.reduce((a, v) => a + v, 0) / list.length : null;
};

const dayCalories = (d) => {
    const key = getDateKey(d);
    return getMeals(key).length ? sumMeals(key).calories : null;
};

const averageLog = (kind, bucket) =>
    average(
        pastDays(bucket.start, bucket.end).map(
            (d) => logs[kind].find((e) => e.key === getDateKey(d))?.value,
        ),
    );

// Calories that would need to move between macros to match the goal ratio
const macroImbalance = (sum, goals) => {
    const actual = Object.entries(KCAL_PER_GRAM).map(([k, f]) => sum[k] * f);
    const target = Object.entries(KCAL_PER_GRAM).map(([k, f]) => goals[k] * f);
    const actualTotal = actual.reduce((a, v) => a + v, 0);
    const targetTotal = target.reduce((a, v) => a + v, 0);
    if (!actualTotal || !targetTotal) return null;

    const deviation = actual.reduce(
        (acc, v, i) => acc + Math.abs(v / actualTotal - target[i] / targetTotal),
        0,
    );
    return (deviation * actualTotal) / 2;
};

const MACRO_COLORS = {protein: "--blue", fat: "--yellow", carbs: "--green"};
const MEAL_COLORS = {
    [SNACK]: "--red",
    [BREAKFAST]: "--blue",
    [LUNCH]: "--green",
    [DINNER]: "--yellow",
};
const NUTRIENT_CHARTS = ["fiber", "sugar", "salt", "satFat"];
const NUTRIENT_COLORS = {
    fiber: "--green",
    sugar: "--red",
    salt: "--blue",
    satFat: "--yellow",
};

const renderStats = () => {
    hideTip();
    const [start, end] = getRange(currentDate, period);
    const buckets = getBuckets(start, end, period);
    const sums = buckets.map(aggregate);
    const days = pastDays(start, end);
    const logged = days.filter((d) => getMeals(getDateKey(d)).length);
    const rangeMeals = meals.filter(
        (m) => m.eaten >= start && m.eaten < end && m.eaten <= Date.now(),
    );
    const field = (k) => sums.map((s) => s?.[k] ?? null);
    const dayBuckets =
        period === DAY ? [{label: getDateText(start), start, end}] : buckets;

    /* Calories */
    const calories =
        period === DAY ? cumulative(field("calories"), buckets) : field("calories");
    const weekAverage = (b) =>
        b.start > new Date()
            ? null
            : average(pastDays(addDays(b.start, -6), b.end).map(dayCalories));
    const series = [
        {values: calories, color: "--red", label: S.consumed},
        ...(period === WEEK
            ? [{values: buckets.map(weekAverage), color: "--green", label: S.sevenDaysAverage, thin: true}]
            : []),
    ];
    renderLine("calories-chart", buckets, series, {value: person.goals.calories, label: S.target}, false, S.kcal);

    const averageCalories = average(logged.map(dayCalories));
    setDayAverage("calories-chart", averageCalories, S.kcal);

    /* PFC */
    const macroKeys = ["protein", "fat", "carbs"];
    renderAreaStacked(
        "macros-chart", buckets, macroKeys, sums,
        MACRO_COLORS, {protein: S.protein, fat: S.fat, carbs: S.carbs}, S.g
    );
    const macroDays = logged
        .map((d) => sumMeals(getDateKey(d)))
        .filter(Boolean);
    const macroAverages = macroKeys.map((k) =>
        average(macroDays.map((day) => day[k])),
    );
    const macroText = macroKeys
        .map((k, i) => `${S[k][0]} ${fmt(macroAverages[i])}`)
        .join(" · ");
    setChartValue("macros-chart", logged.length ? `${macroText} ${S.g}` : "");

    /* PFC imbalance */
    const daySums = dayBuckets.map(aggregateDays);
    const imbalance = daySums.map((s) => (s ? macroImbalance(s, person.goals) : null));
    renderLine(
        "balance-chart",
        dayBuckets,
        [{values: imbalance, color: "--yellow", label: S.macroImbalance}],
        {},
        false,
        S.kcal,
    );
    const averageImbalance = average(imbalance);
    setChartValue(
        "balance-chart",
        averageImbalance == null ? "" : `${fmt(averageImbalance)} ${S.kcal}`,
    );

    /* Calories by meal */
    renderAreaStacked(
        "meal-type-chart", buckets, MEAL_TYPES, sums,
        MEAL_COLORS, S.mealTypes, S.kcal
    );
    const mealCalories = Object.fromEntries(MEAL_TYPES.map((type) => [type, 0]));
    rangeMeals.forEach((meal) => {
        mealCalories[meal.type] += sumItems(meal.items)?.calories || 0;
    });
    const totalMealCalories = Object.values(mealCalories).reduce(
        (sum, value) => sum + value,
        0,
    );
    const mealShares = MEAL_TYPES
        .filter((type) => mealCalories[type] > 0)
        .map((type) =>
            `${S.mealTypes[type][0]} ${fmt((mealCalories[type] / totalMealCalories) * 100)}`,
        )
        .join(" · ");
    setChartValue("meal-type-chart", totalMealCalories ? `${mealShares} %` : "");

    /* Water */
    const water = dayBuckets.map(aggregateWater);
    renderVBars(
        "water-chart",
        dayBuckets,
        [{values: water, color: "--blue", label: S.water}],
        person.targets.water,
        S.ml,
        0,
        140,
    );
    const averageWater = average(water.filter((v) => v > 0));
    setDayAverage("water-chart", averageWater, S.ml);

    /* Health score */
    const allItems = rangeMeals.flatMap((m) => m.items);
    const averageHealth = sumItems(allItems)?.healthScore;
    renderLine(
        "health-chart",
        buckets,
        [{values: field("health"), color: "--green", label: S.healthScore}],
        {value: averageHealth, label: S.average},
        false,
    );
    setChartValue("health-chart", averageHealth == null ? "" : fmt(averageHealth));

    /* Nutrients */
    const pct = nutrientMode === "pct";
    const nutrientSeries = NUTRIENT_CHARTS.map((k) => ({
        values: field(k).map((v) =>
            v == null ? null : pct ? (v / person.goals[k]) * 100 : v,
        ),
        color: NUTRIENT_COLORS[k],
        label: S[k],
    }));
    renderLine(
        "nutrient-chart",
        buckets,
        nutrientSeries,
        {},
        false,
        pct ? "%" : S.g,
        pct ? 0 : 1,
    );
    const nutrientUnit = pct ? "%" : S.g;
    const nutrientStats = nutrientSeries
        .map((nutrient) => {
            const avg = average(nutrient.values);
            return avg == null ? "" : `${nutrient.label[0]} ${fmt(avg)}`;
        })
        .filter(Boolean)
        .join(" · ");
    setChartValue(
        "nutrient-chart",
        nutrientStats ? `${nutrientStats} ${nutrientUnit}` : "",
    );

    /* Weight */
    const weights = buckets.map((b) => {
        if (period === DAY) {
            const entries = logs.weight.filter(
                (e) => e.date >= b.start && e.date < b.end,
            );
            return entries.length
                ? average(entries.map((e) => e.weight))
                : getValue('weight', getDateKey(b.start));
        }
        return average(pastDays(b.start, b.end).map((d) => getValue('weight', getDateKey(d))));
    });
    const weightPoints = weights
        .map((y, x) => ({x, y}))
        .filter((p) => p.y != null);
    const trend = linearRegression(weightPoints);
    const [first, last] = [weightPoints[0]?.x, weightPoints.at(-1)?.x];
    renderLine(
        "weight-chart",
        buckets,
        [
            {values: weights, color: "--red", label: S.weight},
            ...(trend
                ? [
                    {
                        values: buckets.map((_, i) =>
                            i >= first && i <= last ? trend.a + trend.b * i : null,
                        ),
                        color: "--help",
                        dash: true,
                        thin: true,
                        label: S.trend,
                    },
                ]
                : []),
        ],
        {},
        true,
        S.kg,
        1,
    );
    const known = weights.filter((v) => v != null);
    const weightChange = known.length >= 2 ? known.at(-1) - known[0] : null;
    const changeText = weightChange == null
        ? ""
        : `${weightChange > 0 ? "+" : ""}${fmt(weightChange, 1)} ${S.kg}`;
    setChartValue("weight-chart", changeText);

    /* Sleep */
    const sleep = dayBuckets.map((b) => averageLog("sleep", b));
    renderVBars(
        "sleep-chart",
        dayBuckets,
        [{values: sleep, color: "--green", label: S.sleep}],
        person.targets.sleep,
        S.h,
        1,
        140,
    );
    const averageSleep = average(sleep);
    setDayAverage("sleep-chart", averageSleep, S.h, 1);

    /* Steps */
    const steps = dayBuckets.map((b) => averageLog("steps", b));
    renderVBars(
        "steps-chart",
        dayBuckets,
        [{values: steps, color: "--yellow", label: S.steps}],
        person.targets.steps,
        "",
        0,
        140,
    );
    const averageSteps = average(steps);
    setDayAverage("steps-chart", averageSteps, S.st);

    /* Rhythm */
    const matrix = Array.from({length: 7}, () => Array(24).fill(0));
    rangeMeals.forEach((m) => {
        const d = new Date(m.eaten);
        matrix[getWeekday(d)][d.getHours()] += sumItems(m.items).calories;
    });
    renderHeatmap("hour-heatmap", matrix, Math.max(...matrix.flat()));

    /* Micronutrients */
    const micro = Object.fromEntries(
        MICRO_KEYS.map((k) => {
            const values = logged
                .map((d) => sumMeals(getDateKey(d)).micro[k])
                .filter((v) => v != null);
            return [
                k,
                values.length
                    ? (values.reduce((a, v) => a + v, 0) /
                        logged.length /
                        MICRO_NORMALS[k]) *
                    100
                    : null,
            ];
        }),
    );
    if (!logged.length) {
        empty("micro-chart");
    } else {
        const sorted = MICRO_KEYS.map((k) => ({
            label: S[k],
            value: micro[k],
        })).sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
        $("micro-chart").innerHTML =
            `<div class="h-list">${microBarsHtml(sorted)}</div>`;
    }
};

/* --- Toggles --- */

rangeArea.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    shiftRange(+button.dataset.add);
    renderStats();
});

let activePeriod = null;

periodArea.onclick = (e) => {
    const button = e.target.closest("button");
    if (!button || button === activePeriod) return;

    activePeriod.classList.remove("active");
    activePeriod = button;
    activePeriod.classList.add("active");
    periodArea.firstElementChild.style.transform = `translateX(${activePeriod.dataset.i * 100}%)`;

    period = +button.dataset.i;
    currentDate = new Date();
    renderRange();
    renderStats();
};

onSegment($("nutrient-mode"), "mode", (v) => {
    nutrientMode = v;
    renderStats();
});

let lastWidth = window.innerWidth;
window.addEventListener(
    "resize",
    debounce(() => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        if (page === pages.stats) renderStats();
    }, 200),
);

// ==========================================================================
// 27. INIT
// ==========================================================================

document.querySelectorAll("input:not([type=file])").forEach((input) => {
    input.setAttribute("readonly", "true");
    input.addEventListener("focus", () => input.removeAttribute("readonly"));
});

(() => {
    setLanguage();
    prepareRefs();
    loadAll();

    page = pages.diary;
    link = navLinks.diary;
    activePeriod = periodArea.querySelector(".active");

    renderDiary();

    openPhotoStore().then((db) => {
        if (!db) return;
        gcPhotos();
        syncPhotos();
    });
    window.addEventListener("online", syncPhotos);

    // today is frozen at load: refresh it when the tab becomes visible (date change)
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) return;
        const now = new Date();
        if (getDateKey(now) === getDateKey(today)) return;
        today = now;
        calendarPages = {};
        if (page === pages.diary) renderDiary();
    });
})();
