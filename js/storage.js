
// ============================================================
// storage.js  (Owner: Member 3)
// Purpose: The ONLY file that reads/writes the browser's LocalStorage.
// If we ever change how data is saved, we only edit this file.
// ============================================================

// The "names" under which our data is saved in the browser.
export const STORAGE_KEYS = {
  items: "softstock_items",             // inventory items
  movements: "softstock_movements",     // stock-in / stock-out history
  observations: "softstock_observations" // AI demand observations
};

/**
 * Load data from LocalStorage.
 * @param {string} key      - one of STORAGE_KEYS
 * @param {*} fallback      - what to return if nothing is saved yet
 */
export function load(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    // LocalStorage only stores text, so we convert text back to a JS object
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch (error) {
    // If the saved data is corrupted, don't crash the app
    console.error(`[storage] Could not load "${key}":`, error);
    return fallback;
  }
}

/**
 * Save data to LocalStorage.
 * @returns {boolean} true if saved successfully
 */
export function save(key, data) {
  try {
    // Convert JS object to text before saving
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`[storage] Could not save "${key}":`, error);
    return false;
  }
}