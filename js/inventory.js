// ============================================================
// inventory.js  (Owner: Member 3)
// Purpose: ALL inventory logic lives here. Other members just
// import these functions. They never touch LocalStorage directly.
//
// HOW TO USE (Members 1 & 2):
//   import { getItems, stockIn } from "./inventory.js";
//
// ERROR RULE: functions throw an Error with a readable message when
// input is invalid. Wrap calls in try/catch and show error.message:
//   try { stockOut(id, 99); } catch (e) { alert(e.message); }
// ============================================================

import { STORAGE_KEYS, load, save } from "./storage.js";
import { SEED_ITEMS, SEED_MOVEMENTS } from "./seed.js";

// ------------------------------------------------------------
// SECTION 1: Small helper functions (used only inside this file)
// ------------------------------------------------------------

// Creates a unique id like "item_lq3k9x2ab1"
function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Current date/time as text, e.g. "2026-11-06T10:00:00.000Z"
function now() {
  return new Date().toISOString();
}

// Checks that a value is a real number. Throws an Error if not.
// allowZero = true  -> accepts 0 (used for quantity / minStock when adding)
// allowZero = false -> must be greater than 0 (used for stock in/out)
function toValidNumber(value, fieldName, allowZero) {
  const isEmpty = value === "" || value === null || value === undefined;
  const number = Number(value);

  if (isEmpty || !Number.isFinite(number)) {
    throw new Error(`${fieldName} must be a number.`);
  }
  if (number < 0) {
    throw new Error(`${fieldName} cannot be negative.`);
  }
  if (!allowZero && number === 0) {
    throw new Error(`${fieldName} must be greater than 0.`);
  }
  return number;
}

// Checks that text is not empty. Returns the trimmed text.
function toValidText(value, fieldName) {
  const text = String(value ?? "").trim();
  if (text === "") {
    throw new Error(`${fieldName} is required.`);
  }
  return text;
}

// Rounds to 3 decimals so 11.8 - 0.1 never becomes 11.700000000000001
function round(number) {
  return Math.round(number * 1000) / 1000;
}

// Makes sure what we read from LocalStorage is really a list (array).
// If the saved data is damaged, we return an empty list instead of crashing.
function asList(value) {
  return Array.isArray(value) ? value : [];
}

// Shortcuts to read/save each data list
const readItems = () => asList(load(STORAGE_KEYS.items));
const writeItems = (items) => save(STORAGE_KEYS.items, items);
const readMovements = () => asList(load(STORAGE_KEYS.movements));
const writeMovements = (list) => save(STORAGE_KEYS.movements, list);
const readObservations = () => asList(load(STORAGE_KEYS.observations));
const writeObservations = (list) => save(STORAGE_KEYS.observations, list);

// ------------------------------------------------------------
// SECTION 1B: Text cleaning, duplicate detection, units
// (Added to stop duplicates like "Fresh  Milk", "Fresh Mlik", "Pastry"/"Pasties")
// ------------------------------------------------------------

/** Allowed units. The UI can use this list for a dropdown / suggestions. */
export const ALLOWED_UNITS = [
  "kg", "g", "liters", "ml", "pcs", "bottles", "packs", "boxes", "cans", "bags", "dozen", "trays"
];

// Other spellings people type -> the unit we store
const UNIT_ALIASES = {
  kg: ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"],
  g: ["g", "gm", "gms", "gram", "grams"],
  liters: ["l", "lt", "ltr", "liter", "liters", "litre", "litres"],
  ml: ["ml", "mls", "milliliter", "milliliters", "millilitre", "millilitres"],
  pcs: ["pc", "pcs", "piece", "pieces"],
  bottles: ["bottle", "bottles", "btl", "btls"],
  packs: ["pack", "packs", "pkt", "pkts", "packet", "packets"],
  boxes: ["box", "boxes"],
  cans: ["can", "cans"],
  bags: ["bag", "bags"],
  dozen: ["dozen", "doz"],
  trays: ["tray", "trays"]
};

// Units counted in whole numbers (a suggested restock is rounded UP for these)
const DISCRETE_UNITS = new Set(["pcs", "bottles", "packs", "boxes", "cans", "bags", "dozen", "trays"]);

/** Trims and collapses repeated spaces: "  Fresh   Milk " -> "Fresh Milk" */
export function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

// Fixes capitalization only when the text is ALL lower or ALL upper.
// "fresh milk" -> "Fresh Milk"; "UHT Milk" is left as typed.
function smartCase(value) {
  const text = cleanText(value);
  if (text !== text.toLowerCase() && text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, before, letter) => before + letter.toUpperCase());
}

// A "comparison key": lowercase, no spaces/punctuation/accents, simple plural removed.
// "Fresh Milk", "fresh  milk", "FreshMilk" -> same key. "Pastries" and "Pastry" -> same key.
function compareKey(value) {
  let key = cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
  if (key.length > 3) {
    if (key.endsWith("ies")) key = key.slice(0, -3) + "y";
    else if (/(ss|us)$/.test(key)) { /* glass, citrus: not plurals */ }
    else if (/(ches|shes|xes|sses)$/.test(key)) key = key.slice(0, -2);
    else if (key.endsWith("s")) key = key.slice(0, -1);
  }
  return key;
}

// Edit distance that counts a swapped pair of letters as ONE mistake ("Mlik" -> "Milk")
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// "Close but not identical". ratio = how many mistakes we allow per letter.
function isSimilar(keyA, keyB, ratio) {
  if (keyA === keyB) return false;
  const length = Math.max(keyA.length, keyB.length);
  if (length < 5) return false; // very short names: only exact matches count
  return editDistance(keyA, keyB) <= Math.max(1, Math.floor(length * ratio));
}
const NAME_RATIO = 0.2;
const CATEGORY_RATIO = 0.34;

// An error the UI can recognise (error.code) to ask "Did you mean ...?"
function similarError(code, message, similar) {
  return Object.assign(new Error(message), { code, similar });
}

function prepareName(raw) {
  const clean = smartCase(toValidText(raw, "Item name"));
  const key = compareKey(clean);
  if (!key) throw new Error("Item name must contain letters or numbers.");
  return { clean, key };
}

// Returns the cleaned name, or throws:
//  - plain Error for an exact duplicate (always blocked)
//  - error.code "SIMILAR_NAME" for a near match (skip with allowSimilar = true)
function resolveName(raw, items, excludeId, allowSimilar) {
  const { clean, key } = prepareName(raw);
  const others = items.filter((item) => item.id !== excludeId);

  const same = others.find((item) => compareKey(item.name) === key);
  if (same) {
    throw new Error(`"${clean}" already exists in the inventory as "${same.name}".`);
  }
  if (!allowSimilar) {
    const near = others.find((item) => isSimilar(key, compareKey(item.name), NAME_RATIO));
    if (near) {
      throw similarError("SIMILAR_NAME", `"${clean}" looks like the existing item "${near.name}". Is it the same item?`, near.name);
    }
  }
  return clean;
}

function findSimilarCategory(clean, items) {
  const key = compareKey(clean);
  const existing = [...new Set(items.map((i) => i.category))];
  return existing.find((c) => isSimilar(key, compareKey(c), CATEGORY_RATIO));
}

// Returns the category to save. Same category with different spelling/plural ->
// silently reuses the existing spelling. Near match -> error.code "SIMILAR_CATEGORY".
// `items` should NOT include the item being edited.
function resolveCategory(raw, items, allowSimilar) {
  const clean = smartCase(raw) || "Uncategorized";
  const key = compareKey(clean);
  const existing = [...new Set(items.map((i) => i.category))];

  const exact = existing.find((c) => compareKey(c) === key);
  if (exact) return exact;

  if (!allowSimilar) {
    const near = findSimilarCategory(clean, items);
    if (near) {
      throw similarError("SIMILAR_CATEGORY", `Category "${clean}" looks like the existing category "${near}".`, near);
    }
  }
  return clean;
}

// "Kgs" / "litres" / "pc" -> "kg" / "liters" / "pcs". Unknown units are rejected.
function resolveUnit(raw) {
  const text = cleanText(raw).toLowerCase().replace(/\./g, "");
  if (!text) throw new Error("Unit is required.");
  for (const [unit, aliases] of Object.entries(UNIT_ALIASES)) {
    if (aliases.includes(text)) return unit;
  }
  throw new Error(`Unit "${cleanText(raw)}" is not recognised. Use one of: ${ALLOWED_UNITS.join(", ")}.`);
}

// Optional restock target: blank -> null. Otherwise a number that is >= 0.
function parseTarget(value) {
  const empty = value === "" || value === null || value === undefined;
  return empty ? null : toValidNumber(value, "Restock target", true);
}

function checkTarget(target, minStock) {
  if (target !== null && target !== undefined && target < minStock) {
    throw new Error("Restock target cannot be lower than the minimum stock.");
  }
}

// ------------------------------------------------------------
// SECTION 2: Startup
// ------------------------------------------------------------

/**
 * Call this ONCE when the app starts (main.js does it).
 * If nothing is saved yet, it loads the sample café items.
 */
export function initInventory() {
  const saved = load(STORAGE_KEYS.items, null); // null means "never saved"
  if (saved === null) {
    resetToSeedData();
  } else {
    normalizeStoredData();
  }
}

/**
 * Cleans data that was saved BEFORE the duplicate checks existed:
 * trims names, fixes ALL-CAPS/lowercase, converts units like "Kgs" to "kg",
 * and merges category spellings that mean the same thing ("Pastries" -> "Pastry").
 * It never deletes or merges items. Unknown custom units are left alone.
 * Returns true if anything was changed.
 */
export function normalizeStoredData() {
  const items = readItems().filter((item) => item && typeof item === "object");
  const before = JSON.stringify(items);

  // Pass 1: clean each item's own fields
  const cleaned = items.map((item) => {
    const copy = { ...item };
    copy.name = smartCase(item.name) || String(item.name ?? "");
    copy.category = smartCase(item.category) || "Uncategorized";
    try { copy.unit = resolveUnit(item.unit); } catch { copy.unit = cleanText(item.unit); }
    if (copy.targetStock === undefined) copy.targetStock = null;
    return copy;
  });

  // Pass 2: one spelling per category (the most used one wins)
  const spellings = new Map(); // key -> Map(spelling -> count)
  cleaned.forEach((item) => {
    const key = compareKey(item.category);
    if (!spellings.has(key)) spellings.set(key, new Map());
    const counts = spellings.get(key);
    counts.set(item.category, (counts.get(item.category) || 0) + 1);
  });
  const winner = new Map();
  spellings.forEach((counts, key) => {
    winner.set(key, [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  });
  cleaned.forEach((item) => { item.category = winner.get(compareKey(item.category)); });

  if (JSON.stringify(cleaned) === before) return false;
  writeItems(cleaned);
  return true;
}

/**
 * Wipes ALL data and reloads the sample items.
 * Useful before a demo or when testing. (Add a hidden "Reset" button if needed.)
 */
export function resetToSeedData() {
  const items = SEED_ITEMS.map((seed) => ({
    id: generateId("item"),
    targetStock: null,
    ...seed,
    updatedAt: now()
  }));
  writeItems(items);

  // Build the sample movement history (dated in the past) for demos
  const movements = SEED_MOVEMENTS
    .map((seed) => {
      const item = items.find((i) => i.name === seed.name);
      if (!item) return null; // skip if the item name doesn't exist
      const date = new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000).toISOString();
      return {
        id: generateId("mov"),
        itemId: item.id,
        type: seed.type,
        quantity: seed.quantity,
        note: seed.note,
        date
      };
    })
    .filter(Boolean);

  writeMovements(movements);
  writeObservations([]);
}

// ------------------------------------------------------------
// SECTION 3: CRUD (Create, Read, Update, Delete) for items
// ------------------------------------------------------------

/** READ: returns all inventory items (array). */
export function getItems() {
  return readItems();
}

/** READ: returns one item by id, or undefined if not found. */
export function getItemById(id) {
  return readItems().find((item) => item.id === id);
}

/**
 * CREATE: adds a new item.
 * Required: name, unit. Optional: category, quantity (default 0), minStock (default 0),
 *           targetStock (restock target, default = 2 x minStock)
 * Example: addItem({ name: "Sugar", category: "Pantry", quantity: 20, unit: "kg", minStock: 5 })
 *
 * Duplicate protection:
 *  - exact duplicate (ignoring case, spaces, plurals): always throws a normal Error
 *  - similar name/category: throws an Error whose  error.code  is "SIMILAR_NAME" or
 *    "SIMILAR_CATEGORY" and whose  error.similar  is the existing spelling.
 *    To save anyway, call again with options { allowSimilarName: true } and/or
 *    { allowSimilarCategory: true }.
 * Returns the newly created item.
 */
export function addItem(data, options = {}) {
  const items = readItems();

  const name = resolveName(data.name, items, null, options.allowSimilarName);
  const category = resolveCategory(data.category, items, options.allowSimilarCategory);
  const unit = resolveUnit(data.unit);
  const quantity = toValidNumber(data.quantity ?? 0, "Quantity", true);
  const minStock = toValidNumber(data.minStock ?? 0, "Minimum stock", true);
  const targetStock = parseTarget(data.targetStock);
  checkTarget(targetStock, minStock);

  const newItem = {
    id: generateId("item"),
    name,
    category,
    quantity: round(quantity),
    unit,
    minStock,
    targetStock,
    updatedAt: now()
  };

  items.push(newItem);
  writeItems(items);
  return newItem;
}

/**
 * UPDATE: edits an item's details.
 * Allowed fields: name, category, unit, minStock, targetStock
 * NOTE: quantity is NOT editable here on purpose. Use stockIn() / stockOut()
 * so every quantity change is recorded in the movement history.
 * `options` works like addItem (allowSimilarName / allowSimilarCategory).
 * Returns the updated item.
 */
export function updateItem(id, changes, options = {}) {
  const items = readItems();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error("Item not found.");
  }

  const before = items[index];
  const next = { ...before };
  const others = items.filter((item) => item.id !== id);

  // Only fields that were actually provided are changed (and checked)
  if (changes.name !== undefined) {
    next.name = resolveName(changes.name, items, id, options.allowSimilarName);
  }
  if (changes.category !== undefined) {
    next.category = resolveCategory(changes.category, others, options.allowSimilarCategory);
  }
  if (changes.unit !== undefined) {
    // Don't block editing other fields of an old item that has a custom unit
    const unchanged = cleanText(changes.unit).toLowerCase() === String(before.unit).toLowerCase();
    next.unit = unchanged ? before.unit : resolveUnit(changes.unit);
  }
  if (changes.minStock !== undefined) {
    next.minStock = toValidNumber(changes.minStock, "Minimum stock", true);
  }
  if (changes.targetStock !== undefined) {
    next.targetStock = parseTarget(changes.targetStock);
  }
  checkTarget(next.targetStock, next.minStock);

  next.updatedAt = now();
  items[index] = next;
  writeItems(items);
  return next;
}

/**
 * DELETE: removes an item AND its movements and AI observations
 * (so no "orphan" records are left behind).
 * Returns true if deleted, false if the item didn't exist.
 */
export function deleteItem(id) {
  const items = readItems();
  const remaining = items.filter((item) => item.id !== id);
  if (remaining.length === items.length) {
    return false; // nothing was deleted
  }

  writeItems(remaining);
  writeMovements(readMovements().filter((m) => m.itemId !== id));
  writeObservations(readObservations().filter((o) => o.itemId !== id));
  return true;
}

// ------------------------------------------------------------
// SECTION 4: Stock-in and Stock-out
// ------------------------------------------------------------

// Shared logic for both stockIn and stockOut (kept private)
function applyMovement(id, type, qty, note) {
  const items = readItems();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error("Item not found.");
  }

  // Quantity must be a number greater than 0
  const amount = toValidNumber(qty, "Quantity", false);
  const item = items[index];

  // Block removing more than what we have
  if (type === "out" && amount > item.quantity) {
    throw new Error(
      `Not enough stock. Only ${item.quantity} ${item.unit} of ${item.name} available.`
    );
  }

  // Update the quantity
  item.quantity = round(type === "in" ? item.quantity + amount : item.quantity - amount);
  item.updatedAt = now();
  items[index] = item;
  writeItems(items);

  // Record it in the movement history
  const movements = readMovements();
  movements.push({
    id: generateId("mov"),
    itemId: id,
    type: type,               // "in" or "out"
    quantity: amount,
    note: String(note ?? "").trim(),
    date: now()
  });
  writeMovements(movements);

  return item; // the updated item
}

/** STOCK IN: ingredients received. Example: stockIn(id, 10, "Weekly delivery") */
export function stockIn(id, qty, note = "") {
  return applyMovement(id, "in", qty, note);
}

/** STOCK OUT: ingredients used/consumed/wasted. Example: stockOut(id, 2, "Used today") */
export function stockOut(id, qty, note = "") {
  return applyMovement(id, "out", qty, note);
}

// ------------------------------------------------------------
// SECTION 5: Status detection and low-stock list
// ------------------------------------------------------------

/**
 * Returns "out" | "low" | "ok" for an item.
 *   out -> quantity is 0 (or less)
 *   low -> quantity is at or below minStock
 *   ok  -> everything else
 */
export function getStatus(item) {
  if (item.quantity <= 0) return "out";
  if (item.quantity <= item.minStock) return "low";
  return "ok";
}

/**
 * The stock level we want to get back to when restocking.
 * Uses the item's own "targetStock" if set, otherwise 2 x minimum stock.
 */
export function getRestockTarget(item) {
  const target = item.targetStock ?? item.minStock * 2;
  return Math.max(target, item.minStock);
}

/**
 * RULE-BASED (not AI): how much to order to reach the restock target.
 * Example: Fresh Milk has 2 L, minimum 5 L -> target 10 L -> suggest 8 L.
 * Items that are "ok" return 0. Pieces/bottles/etc. are rounded up to whole numbers.
 */
export function getSuggestedRestock(item) {
  if (getStatus(item) === "ok") return 0;
  const needed = Math.max(0, getRestockTarget(item) - item.quantity);
  return DISCRETE_UNITS.has(item.unit) ? Math.ceil(needed - 1e-9) : round(needed);
}

/**
 * Returns all items needing restock, MOST URGENT FIRST:
 *   1) Out-of-stock items come first
 *   2) Then low items, sorted by how far below minimum they are
 *      (quantity / minStock: the smaller the ratio, the more urgent)
 * Each returned item also has "status", "restockTarget" and "suggestedRestock" fields.
 */
export function getLowStockItems() {
  return readItems()
    .map((item) => ({
      ...item,
      status: getStatus(item),
      restockTarget: getRestockTarget(item),
      suggestedRestock: getSuggestedRestock(item)
    }))
    .filter((item) => item.status !== "ok")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "out" ? -1 : 1;
      const ratioA = a.minStock > 0 ? a.quantity / a.minStock : 0;
      const ratioB = b.minStock > 0 ? b.quantity / b.minStock : 0;
      return ratioA - ratioB;
    });
}

// ------------------------------------------------------------
// SECTION 6: Movement history
// ------------------------------------------------------------

/**
 * Returns movement history, NEWEST FIRST.
 * getMovements()        -> all movements
 * getMovements(itemId)  -> only movements for that item
 * Each movement also has "itemName" added for easy display.
 */
export function getMovements(itemId) {
  const items = readItems();
  return readMovements()
    .filter((m) => !itemId || m.itemId === itemId)
    .map((m) => {
      const item = items.find((i) => i.id === m.itemId);
      return { ...m, itemName: item ? item.name : "(deleted item)" };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ------------------------------------------------------------
// SECTION 7: AI observations (Member 2 produces them, we store them)
// ------------------------------------------------------------

/**
 * Saves an AI classification result.
 * Member 2 calls it like this:
 *   saveObservation({
 *     itemId: "item_xxx",
 *     text: "Milk keeps running out earlier than usual despite on-time deliveries",
 *     label: "Usage-driven stockouts",
 *     confidence: 0.87,       // number from 0 to 1
 *     category: "Dairy",
 *     status: "low",
 *     quantity: 2
 *   })
 */
export function saveObservation(obs) {
  if (!getItemById(obs.itemId)) {
    throw new Error("Cannot save observation: item not found.");
  }

  const newObs = {
    id: generateId("obs"),
    itemId: obs.itemId,
    text: toValidText(obs.text, "Observation text"),
    label: toValidText(obs.label, "AI label"),
    confidence: Number(obs.confidence) || 0,
    category: toValidText(obs.category, "Item category"),
    status: toValidText(obs.status, "Item status"),
    quantity: Number(obs.quantity),
    stockWarning: obs.stockWarning ? toValidText(obs.stockWarning, "Stock warning") : null,
    scores: Array.isArray(obs.scores) ? obs.scores : [],
    suggestedAction: obs.suggestedAction ? toValidText(obs.suggestedAction, "Suggested action") : null,
    explanation: obs.explanation ? toValidText(obs.explanation, "Explanation") : null,
    lowConfidence: Boolean(obs.lowConfidence),
    date: now()
  };

  const list = readObservations();
  list.push(newObs);
  writeObservations(list);
  return newObs;
}

/**
 * Returns saved AI observations, NEWEST FIRST.
 * getObservations()        -> all
 * getObservations(itemId)  -> only for that item
 * Each observation also has "itemName" added for easy display.
 */
export function getObservations(itemId) {
  const items = readItems();
  return readObservations()
    .filter((o) => !itemId || o.itemId === itemId)
    .map((o) => {
      const item = items.find((i) => i.id === o.itemId);
      return { ...o, itemName: item ? item.name : "(deleted item)" };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/** Deletes one saved AI classification by its observation id. */
export function deleteObservation(id) {
  const observations = readObservations();
  const next = observations.filter((observation) => observation.id !== id);
  if (next.length === observations.length) {
    throw new Error("AI classification not found.");
  }
  writeObservations(next);
}

// ------------------------------------------------------------
// SECTION 8: Dashboard numbers (Member 1 displays these)
// ------------------------------------------------------------

/**
 * Returns everything the dashboard needs in ONE object:
 * {
 *   totalItems:          number,
 *   okCount:             number,
 *   lowStockCount:       number,   // low only (does NOT include out-of-stock)
 *   outOfStockCount:     number,
 *   attentionItems:      [...],    // items needing restock, most urgent first
 *   recentMovements:     [...],    // last 5 stock movements
 *   recentObservations:  [...]     // last 5 AI classifications
 * }
 */
export function getDashboardStats() {
  const items = readItems();
  const statuses = items.map(getStatus);

  return {
    totalItems: items.length,
    okCount: statuses.filter((s) => s === "ok").length,
    lowStockCount: statuses.filter((s) => s === "low").length,
    outOfStockCount: statuses.filter((s) => s === "out").length,
    attentionItems: getLowStockItems(),
    recentMovements: getMovements().slice(0, 5),
    recentObservations: getObservations().slice(0, 5)
  };
}

// ------------------------------------------------------------
// SECTION 9: CSV export / import (simple backup and restore)
// ------------------------------------------------------------
// Inventory CSV columns: name, category, quantity, unit, minStock, targetStock
// The owner can open it in Excel/Google Sheets, edit it, and import it back.

const CSV_COLUMNS = ["name", "category", "quantity", "unit", "minStock", "targetStock"];

// Accepted column titles (case, spaces and punctuation are ignored)
const HEADER_ALIASES = {
  name: ["name", "item", "itemname", "ingredient", "product"],
  category: ["category", "type", "group"],
  quantity: ["quantity", "qty", "stock", "currentstock", "onhand"],
  unit: ["unit", "units", "uom"],
  minStock: ["minstock", "minimumstock", "minimum", "min", "minqty", "reorderlevel", "threshold"],
  targetStock: ["targetstock", "target", "restocktarget", "maxstock"]
};

// Wraps a value for CSV. For text columns, a leading = + - @ is neutralised so a
// spreadsheet never runs it as a formula.
function csvCell(value, isText = false) {
  let text = value === null || value === undefined ? "" : String(value);
  if (isText && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Undo the formula protection above when reading a file back in
function unescapeCell(value) {
  const text = String(value ?? "");
  return /^'[=+\-@\t\r]/.test(text) ? text.slice(1) : text;
}

/** Returns the whole inventory as CSV text (one row per item). */
export function exportInventoryCSV() {
  const lines = [CSV_COLUMNS.join(",")];
  readItems()
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .forEach((item) => {
      lines.push([
        csvCell(item.name, true),
        csvCell(item.category, true),
        csvCell(item.quantity),
        csvCell(item.unit, true),
        csvCell(item.minStock),
        csvCell(item.targetStock)
      ].join(","));
    });
  return lines.join("\r\n") + "\r\n";
}

/** Returns the stock movement history as CSV text (for reports; it is not re-imported). */
export function exportMovementsCSV() {
  const lines = ["date,item,type,quantity,note"];
  getMovements().forEach((m) => {
    lines.push([
      csvCell(m.date),
      csvCell(m.itemName, true),
      csvCell(m.type === "in" ? "stock in" : "stock out"),
      csvCell(m.quantity),
      csvCell(m.note, true)
    ].join(","));
  });
  return lines.join("\r\n") + "\r\n";
}

// Splits CSV text into rows of cells. Handles quotes, commas inside quotes,
// Windows/Mac/Unix line endings, a BOM, and ";" as separator (some Excel settings).
function parseCSV(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r\n|\n|\r/)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const separator = semicolons > commas ? ";" : ",";

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') { cell += '"'; i++; } else { inQuotes = false; }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      inQuotes = true;
    } else if (ch === separator) {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (inQuotes) throw new Error("The CSV file has a quote that is never closed.");
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function mapHeaders(headerRow) {
  const map = {};
  headerRow.forEach((title, index) => {
    const key = cleanText(title).toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(key) && map[field] === undefined) map[field] = index;
    }
  });
  return map;
}

/**
 * The shared import engine. It works on COPIES of the data and only saves at the end,
 * so a problem can never leave the inventory half-imported.
 *
 *  - Item already exists (same name ignoring case/spaces/plurals): its category, unit,
 *    minimum and target are updated. If the quantity is different, the difference is
 *    recorded as a stock movement ("Imported via CSV"), so history stays consistent.
 *    Blank cells keep the current value.
 *  - New item: added (needs name + unit). A starting stock movement is recorded.
 *  - Bad rows are skipped and listed in report.errors. Valid rows still import.
 *  - options.replaceAll = true wipes everything first (use with a confirmation).
 */
function runImport(text, options, dryRun) {
  const parsed = parseCSV(text);
  if (parsed.length === 0) throw new Error("The CSV file is empty.");

  const map = mapHeaders(parsed[0]);
  if (map.name === undefined) {
    throw new Error('The CSV needs a header row with a "name" column (e.g. name,category,quantity,unit,minStock).');
  }

  const dataRows = parsed
    .map((cells, index) => ({ cells, row: index + 1 })) // row 1 = the header
    .slice(1)
    .filter(({ cells }) => cells.some((c) => cleanText(c) !== ""));
  if (dataRows.length === 0) throw new Error("The CSV file has no data rows.");

  const replaceAll = options.replaceAll === true;
  const items = replaceAll ? [] : readItems().map((item) => ({ ...item }));
  const movements = replaceAll ? [] : readMovements().slice();
  const report = {
    mode: replaceAll ? "replace" : "merge",
    total: dataRows.length,
    added: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: [],
    warnings: []
  };

  const addMovement = (itemId, type, quantity) => {
    movements.push({
      id: generateId("mov"), itemId, type, quantity, note: "Imported via CSV", date: now()
    });
  };

  dataRows.forEach(({ cells, row }) => {
    const get = (field) => (map[field] === undefined ? undefined : unescapeCell(cells[map[field]] ?? ""));
    const blank = (value) => value === undefined || cleanText(value) === "";

    try {
      const { clean, key } = prepareName(get("name"));
      const index = items.findIndex((item) => compareKey(item.name) === key);

      if (index !== -1) {
        // ---- existing item: update ----
        const before = items[index];
        const next = { ...before };
        const others = items.filter((_, i) => i !== index);

        if (!blank(get("category"))) next.category = resolveCategory(get("category"), others, true);
        if (!blank(get("unit"))) next.unit = resolveUnit(get("unit"));
        if (!blank(get("minStock"))) next.minStock = toValidNumber(get("minStock"), "Minimum stock", true);
        if (!blank(get("targetStock"))) next.targetStock = parseTarget(get("targetStock"));
        checkTarget(next.targetStock, next.minStock);

        const newQty = blank(get("quantity")) ? before.quantity : round(toValidNumber(get("quantity"), "Quantity", true));
        const fieldsChanged = ["category", "unit", "minStock", "targetStock"].some((f) => next[f] !== before[f]);
        const qtyChanged = newQty !== before.quantity;

        if (!fieldsChanged && !qtyChanged) {
          report.unchanged++;
          return;
        }
        if (qtyChanged) {
          addMovement(before.id, newQty > before.quantity ? "in" : "out", round(Math.abs(newQty - before.quantity)));
          next.quantity = newQty;
        }
        next.updatedAt = now();
        items[index] = next;
        report.updated++;
      } else {
        // ---- new item: add ----
        const unit = resolveUnit(get("unit"));
        const category = resolveCategory(get("category"), items, true);
        const quantity = round(toValidNumber(blank(get("quantity")) ? 0 : get("quantity"), "Quantity", true));
        const minStock = toValidNumber(blank(get("minStock")) ? 0 : get("minStock"), "Minimum stock", true);
        const targetStock = parseTarget(get("targetStock"));
        checkTarget(targetStock, minStock);

        const near = items.find((item) => isSimilar(key, compareKey(item.name), NAME_RATIO));
        if (near) report.warnings.push(`Row ${row}: "${clean}" was added, but it looks like "${near.name}".`);
        const nearCategory = !items.some((i) => i.category === category) && findSimilarCategory(category, items);
        if (nearCategory) report.warnings.push(`Row ${row}: category "${category}" looks like "${nearCategory}".`);

        const item = { id: generateId("item"), name: clean, category, quantity, unit, minStock, targetStock, updatedAt: now() };
        items.push(item);
        if (quantity > 0) addMovement(item.id, "in", quantity);
        report.added++;
      }
    } catch (error) {
      report.skipped++;
      report.errors.push({ row, message: error.message });
    }
  });

  if (replaceAll && report.added === 0) {
    throw new Error("No valid rows were found, so nothing was replaced.");
  }

  if (!dryRun && (report.added > 0 || report.updated > 0)) {
    const saved = writeItems(items) && writeMovements(movements) && (!replaceAll || writeObservations([]));
    if (!saved) throw new Error("Could not save the imported data (browser storage may be full).");
  }
  return report;
}

/** Checks a CSV and reports what WOULD happen, without changing anything. */
export function previewInventoryCSV(text, options = {}) {
  return runImport(text, options, true);
}

/**
 * Imports a CSV. Returns { added, updated, unchanged, skipped, errors[], warnings[] }.
 * Throws an Error with a readable message if the file itself is unusable.
 */
export function importInventoryCSV(text, options = {}) {
  return runImport(text, options, false);
}