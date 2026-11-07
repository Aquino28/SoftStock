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


// ------------------------------------------------------------
// Sample stock movements (history) so the dashboard is not empty during demos.
// daysAgo: 0 = today, 1 = yesterday, etc.
// NOTE: these are for display only. They do NOT change the quantities above.
// ------------------------------------------------------------
export const SEED_MOVEMENTS = [
  { name: "Fresh Milk",        type: "in",  quantity: 20, note: "Weekly delivery",   daysAgo: 6 },
  { name: "Fresh Milk",        type: "out", quantity: 8,  note: "Used this week",    daysAgo: 3 },
  { name: "Espresso Beans",    type: "in",  quantity: 5,  note: "Supplier delivery", daysAgo: 5 },
  { name: "Espresso Beans",    type: "out", quantity: 2,  note: "Used this week",    daysAgo: 2 },
  { name: "Oat Milk",          type: "out", quantity: 3,  note: "Ran out",           daysAgo: 2 },
  { name: "Paper Straws",      type: "out", quantity: 50, note: "Used up",           daysAgo: 1 },
  { name: "Cup Lids",          type: "out", quantity: 40, note: "Busy weekend",      daysAgo: 1 },
  { name: "Blueberry Muffins", type: "out", quantity: 6,  note: "Sold out early",    daysAgo: 0 },
  { name: "Croissants",        type: "in",  quantity: 12, note: "Morning bake",      daysAgo: 0 }
];