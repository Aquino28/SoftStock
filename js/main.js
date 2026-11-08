// ============================================================
// main.js  (Shared file: Member 1 will add UI startup code here)
// Purpose: Starts the app and connects the modules.
// ============================================================

import * as Inventory from "./inventory.js";
import { initUI } from "./dashboard.js";

// Load saved data (or sample data on first run)
Inventory.initInventory();

// Start the user interface 
initUI();
