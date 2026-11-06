// ============================================================
// seed.js  (Owner: Member 3)
// Purpose: Sample café inventory used the FIRST time the app loads.
// Replace with Softbound Café's real items after the owner interview.
// Status rule: quantity = 0 -> OUT, quantity <= minStock -> LOW, else OK
// ============================================================

export const SEED_ITEMS = [
  // ---- Dairy ----
  { name: "Fresh Milk",        category: "Dairy",     quantity: 12,  unit: "liters",  minStock: 5   }, // OK
  { name: "Oat Milk",          category: "Dairy",     quantity: 0,   unit: "liters",  minStock: 3   }, // OUT
  // ---- Coffee & Tea ----
  { name: "Espresso Beans",    category: "Coffee",    quantity: 3,   unit: "kg",      minStock: 4   }, // LOW
  { name: "Matcha Powder",     category: "Tea",       quantity: 2,   unit: "kg",      minStock: 1   }, // OK
  // ---- Syrups & Sauces ----
  { name: "Vanilla Syrup",     category: "Syrups",    quantity: 2,   unit: "bottles", minStock: 3   }, // LOW
  { name: "Caramel Syrup",     category: "Syrups",    quantity: 6,   unit: "bottles", minStock: 3   }, // OK
  { name: "Chocolate Sauce",   category: "Syrups",    quantity: 1,   unit: "bottles", minStock: 2   }, // LOW
  // ---- Packaging ----
  { name: "Paper Cups (12oz)", category: "Packaging", quantity: 150, unit: "pcs",     minStock: 100 }, // OK
  { name: "Cup Lids",          category: "Packaging", quantity: 80,  unit: "pcs",     minStock: 100 }, // LOW
  { name: "Paper Straws",      category: "Packaging", quantity: 0,   unit: "pcs",     minStock: 50  }, // OUT
  // ---- Pastries ----
  { name: "Croissants",        category: "Pastries",  quantity: 10,  unit: "pcs",     minStock: 6   }, // OK
  { name: "Blueberry Muffins", category: "Pastries",  quantity: 4,   unit: "pcs",     minStock: 6   }  // LOW
];