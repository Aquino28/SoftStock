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
import { SEED_ITEMS } from "./seed.js";

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

// Shortcuts to read/save each data list
const readItems = () => load(STORAGE_KEYS.items);
const writeItems = (items) => save(STORAGE_KEYS.items, items);
const readMovements = () => load(STORAGE_KEYS.movements);
const writeMovements = (list) => save(STORAGE_KEYS.movements, list);
const readObservations = () => load(STORAGE_KEYS.observations);
const writeObservations = (list) => save(STORAGE_KEYS.observations, list);

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
  }
}

/**
 * Wipes ALL data and reloads the sample items.
 * Useful before a demo or when testing. (Add a hidden "Reset" button if needed.)
 */
export function resetToSeedData() {
  const items = SEED_ITEMS.map((seed) => ({
    id: generateId("item"),
    ...seed,
    updatedAt: now()
  }));
  writeItems(items);
  writeMovements([]);
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
 * Required: name, unit. Optional: category, quantity (default 0), minStock (default 0)
 * Example: addItem({ name: "Sugar", category: "Pantry", quantity: 20, unit: "kg", minStock: 5 })
 * Returns the newly created item.
 */
export function addItem(data) {
  const newItem = {
    id: generateId("item"),
    name: toValidText(data.name, "Item name"),
    category: String(data.category ?? "").trim() || "Uncategorized",
    quantity: toValidNumber(data.quantity ?? 0, "Quantity", true),
    unit: toValidText(data.unit, "Unit"),
    minStock: toValidNumber(data.minStock ?? 0, "Minimum stock", true),
    updatedAt: now()
  };

  // Prevent duplicates with the same name (case-insensitive)
  const items = readItems();
  const duplicate = items.some(
    (item) => item.name.toLowerCase() === newItem.name.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`"${newItem.name}" already exists in the inventory.`);
  }

  items.push(newItem);
  writeItems(items);
  return newItem;
}

/**
 * UPDATE: edits an item's details.
 * Allowed fields: name, category, unit, minStock
 * NOTE: quantity is NOT editable here on purpose. Use stockIn() / stockOut()
 * so every quantity change is recorded in the movement history.
 * Returns the updated item.
 */
export function updateItem(id, changes) {
  const items = readItems();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error("Item not found.");
  }

  const item = items[index];

  // Only update fields that were actually provided
  if (changes.name !== undefined)     item.name = toValidText(changes.name, "Item name");
  if (changes.category !== undefined) item.category = String(changes.category).trim() || "Uncategorized";
  if (changes.unit !== undefined)     item.unit = toValidText(changes.unit, "Unit");
  if (changes.minStock !== undefined) item.minStock = toValidNumber(changes.minStock, "Minimum stock", true);

  item.updatedAt = now();
  items[index] = item;
  writeItems(items);
  return item;
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
  item.quantity = type === "in" ? item.quantity + amount : item.quantity - amount;
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
 * Returns all items needing restock, MOST URGENT FIRST:
 *   1) Out-of-stock items come first
 *   2) Then low items, sorted by how far below minimum they are
 *      (quantity / minStock: the smaller the ratio, the more urgent)
 * Each returned item also has a "status" field added.
 */
export function getLowStockItems() {
  return readItems()
    .map((item) => ({ ...item, status: getStatus(item) }))
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
 *     text: "Milk keeps running out earlier than usual",
 *     label: "Frequent stockouts",
 *     confidence: 0.87        // number from 0 to 1
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
