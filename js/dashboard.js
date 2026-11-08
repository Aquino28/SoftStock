// ============================================================
// dashboard.js  (Owner: Member 1)
// Purpose: All UI code (navigation, dashboard, inventory page, AI page)
// ============================================================

import * as Inventory from "./inventory.js";
import * as AI from "./ai.js"; // Member 2's file (see SECTION 7 below)

// ------------------------------------------------------------
// SECTION 1: Small helpers (reused by the other pages later)
// ------------------------------------------------------------

// Shows a short popup message. Use isError = true for errors.
export function showMessage(text, isError = false) {
  const box = document.getElementById("message");
  box.textContent = text;
  box.classList.toggle("error", isError);
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 3000);
}

// Makes text safe to put inside innerHTML (item names and notes are typed by users)
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// "2026-11-07T10:00:00.000Z" -> "Nov 7, 6:00 PM" (local time)
export function formatDate(isoText) {
  return new Date(isoText).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

// Colored badge for an item's status: "out" | "low" | "ok"
export function statusBadge(status) {
  const labels = { out: "Out of stock", low: "Low stock", ok: "OK" };
  return `<span class="badge badge-${status}">${labels[status]}</span>`;
}

// ------------------------------------------------------------
// SECTION 2: Navigation
// ------------------------------------------------------------

// Switches between Dashboard / Inventory / AI Insights
function initNavigation() {
  const tabs = document.querySelectorAll(".tab");
  const views = document.querySelectorAll(".view");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      views.forEach((v) =>
        v.classList.toggle("hidden", v.id !== `view-${tab.dataset.view}`)
      );

      // Refresh the dashboard every time it is opened,
      // so it always shows the latest stock numbers.
      if (tab.dataset.view === "dashboard") {
        renderDashboard();
      }
      if (tab.dataset.view === "inventory") {
        renderInventory();
      }
      if (tab.dataset.view === "insights") {
        renderInsights();
      }
    });
  });
}

// ------------------------------------------------------------
// SECTION 3: Dashboard
// ------------------------------------------------------------

// One stat card (a number with a label)
function statCard(label, value, className) {
  return `
    <div class="stat-card ${className}">
      <div class="stat-number">${value}</div>
      <div class="stat-label">${label}</div>
    </div>`;
}

// "Needs attention" list: items that are low or out of stock
function attentionList(items) {
  if (items.length === 0) {
    return `<p class="empty">All items are well stocked. 🎉</p>`;
  }
  const rows = items
    .map(
      (item) => `
      <li class="list-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="muted">${item.quantity} ${escapeHtml(item.unit)} left (minimum ${item.minStock})</div>
          <div class="muted">Suggested restock: <strong>${item.suggestedRestock} ${escapeHtml(item.unit)}</strong> (rule-based)</div>
        </div>
        ${statusBadge(item.status)}
      </li>`
    )
    .join("");
  return `<ul class="list">${rows}</ul>`;
}

// "Recent stock movements" list
function movementList(movements) {
  if (movements.length === 0) {
    return `<p class="empty">No stock movements yet.</p>`;
  }
  const rows = movements
    .map((m) => {
      const sign = m.type === "in" ? "+" : "−";
      const note = m.note ? ` · ${escapeHtml(m.note)}` : "";
      return `
      <li class="list-row">
        <div>
          <strong>${escapeHtml(m.itemName)}</strong>
          <div class="muted">${formatDate(m.date)}${note}</div>
        </div>
        <span class="move move-${m.type}">${sign}${m.quantity}</span>
      </li>`;
    })
    .join("");
  return `<ul class="list">${rows}</ul>`;
}

// "Recent AI classifications" list
function observationList(observations) {
  if (observations.length === 0) {
    return `<p class="empty">No AI classifications yet.</p>`;
  }
  const rows = observations
    .map(
      (o) => `
      <li class="list-row">
        <div>
          <strong>${escapeHtml(o.itemName)}</strong>
          <div class="muted">“${escapeHtml(o.text)}”</div>
        </div>
        <div class="ai-result">
          <span class="badge badge-ai">${escapeHtml(o.label)}</span>
          <div class="muted">${Math.round(o.confidence * 100)}%</div>
        </div>
      </li>`
    )
    .join("");
  return `<ul class="list">${rows}</ul>`;
}

// Builds the whole dashboard. Exported so other pages can refresh it later.
export function renderDashboard() {
  const container = document.getElementById("dashboard-content");

  try {
    const stats = Inventory.getDashboardStats();

    container.innerHTML = `
      <div class="stat-grid">
        ${statCard("Total items", stats.totalItems, "stat-total")}
        ${statCard("In stock (OK)", stats.okCount, "stat-ok")}
        ${statCard("Low stock", stats.lowStockCount, "stat-low")}
        ${statCard("Out of stock", stats.outOfStockCount, "stat-out")}
      </div>

      <div class="panel">
        <h3>Needs attention</h3>
        ${attentionList(stats.attentionItems)}
      </div>

      <div class="panel-grid">
        <div class="panel">
          <h3>Recent stock movements</h3>
          ${movementList(stats.recentMovements)}
        </div>
        <div class="panel">
          <h3>Recent AI classifications</h3>
          ${observationList(stats.recentObservations)}
        </div>
      </div>

      <div class="dashboard-footer">
        <button id="reset-btn" class="btn btn-secondary">Reset sample data</button>
      </div>
    `;

    document.getElementById("reset-btn").addEventListener("click", handleReset);
  } catch (error) {
    container.innerHTML = `<p class="empty">Could not load the dashboard.</p>`;
    showMessage(error.message, true);
  }
}

// Reset button: for testing / demo prep only
function handleReset() {
  const sure = confirm(
    "Reset ALL data back to the original sample items? Stock movements and AI results will be erased."
  );
  if (!sure) return;

  try {
    Inventory.resetToSeedData();
    renderDashboard();
    showMessage("Sample data restored.");
  } catch (error) {
    showMessage(error.message, true);
  }
}

// ------------------------------------------------------------
// SECTION 4: Inventory page (table, search, status filter)
// ------------------------------------------------------------

// Remembers what the user typed/selected, even after the page re-renders
const inventoryFilters = { search: "", status: "all" };

// Builds the search bar + filter, then fills the table.
// Exported so the add/edit/delete/stock forms can refresh it later.
export function renderInventory() {
  const container = document.getElementById("inventory-content");

  try {
    container.innerHTML = `
      <div class="toolbar">
        <button id="add-item-btn" class="btn btn-primary">+ Add item</button>
        <button id="all-history-btn" class="btn btn-secondary">All history</button>
        <button id="export-csv-btn" class="btn btn-secondary">Export CSV</button>
        <button id="import-csv-btn" class="btn btn-secondary">Import CSV</button>
        <input id="csv-file" type="file" accept=".csv,text/csv" class="hidden" />        <input id="inv-search" type="search"
               placeholder="Search by name or category..."
               value="${escapeHtml(inventoryFilters.search)}" />
        <select id="inv-status">
          <option value="all">All statuses</option>
          <option value="ok">OK</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
      </div>
      <p class="muted">Data is saved in this browser on this device only. Use Export CSV to keep a backup.</p>
      <div id="inv-table"></div>
    `;

    const searchBox = document.getElementById("inv-search");
    const statusSelect = document.getElementById("inv-status");
    statusSelect.value = inventoryFilters.status;

    // Only the table is redrawn while typing, so the search box keeps focus
    searchBox.addEventListener("input", () => {
      inventoryFilters.search = searchBox.value;
      renderInventoryTable();
    });
    statusSelect.addEventListener("change", () => {
      inventoryFilters.status = statusSelect.value;
      renderInventoryTable();
    });

    document.getElementById("add-item-btn").addEventListener("click", () => openItemForm());
    document.getElementById("all-history-btn").addEventListener("click", () => openHistory());
    initCsvButtons();
    // One listener handles every Edit / Delete button in the table
    document.getElementById("inv-table").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      if (button.dataset.action === "in") openStockForm(button.dataset.id, "in");
      if (button.dataset.action === "out") openStockForm(button.dataset.id, "out");
      if (button.dataset.action === "history") openHistory(button.dataset.id);
      if (button.dataset.action === "edit") openItemForm(button.dataset.id);      if (button.dataset.action === "delete") handleDelete(button.dataset.id);
    });

    renderInventoryTable();
  } catch (error) {
    container.innerHTML = `<p class="empty">Could not load the inventory.</p>`;
    showMessage(error.message, true);
  }
}

// Draws just the table, using the current search + status filter
function renderInventoryTable() {
  const holder = document.getElementById("inv-table");

  try {
    const allItems = Inventory.getItems();
    const query = inventoryFilters.search.trim().toLowerCase();

    const shown = allItems
      .map((item) => ({ ...item, status: Inventory.getStatus(item) }))
      .filter((item) => {
        const statusMatch =
          inventoryFilters.status === "all" || item.status === inventoryFilters.status;
        const textMatch =
          item.name.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query);
        return statusMatch && textMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (shown.length === 0) {
      holder.innerHTML = `<p class="empty">No items match your search.</p>`;
      return;
    }

    const rows = shown
      .map(
        (item) => `
        <tr class="row-${item.status}">
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td>${escapeHtml(item.category)}</td>
          <td>${item.quantity} ${escapeHtml(item.unit)}</td>
          <td>${item.minStock}</td>
          <td>${statusBadge(item.status)}</td>
          <td class="actions">
            <button class="btn btn-small btn-in" data-action="in" data-id="${escapeHtml(item.id)}">Stock in</button>
            <button class="btn btn-small btn-out" data-action="out" data-id="${escapeHtml(item.id)}" ${item.status === "out" ? "disabled" : ""}>Stock out</button>
            <button class="btn btn-small" data-action="history" data-id="${escapeHtml(item.id)}">History</button>
            <button class="btn btn-small" data-action="edit" data-id="${escapeHtml(item.id)}">Edit</button>            <button class="btn btn-small btn-danger" data-action="delete" data-id="${escapeHtml(item.id)}">Delete</button>
          </td>
        </tr>`
      )
      .join("");

    holder.innerHTML = `
      <p class="muted">Showing ${shown.length} of ${allItems.length} items</p>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Quantity</th>
              <th>Minimum</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (error) {
    holder.innerHTML = `<p class="empty">Could not load the inventory.</p>`;
    showMessage(error.message, true);
  }
}

// ------------------------------------------------------------
// SECTION 5: Add / Edit / Delete items
// ------------------------------------------------------------

// Opens the pop-up form. No id = "Add item" mode. With an id = "Edit item" mode.
function openItemForm(itemId = null) {
  const editing = itemId !== null;
  const item = editing ? Inventory.getItemById(itemId) : null;

  if (editing && !item) {
    showMessage("Item not found.", true);
    return;
  }

  // Create the dialog once, then reuse it
  let dialog = document.getElementById("item-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "item-dialog";
    document.body.appendChild(dialog);
  }

  // Suggest existing categories while typing
  const categories = [...new Set(Inventory.getItems().map((i) => i.category))];
  const categoryOptions = categories
    .map((c) => `<option value="${escapeHtml(c)}"></option>`)
    .join("");

  dialog.innerHTML = `
    <form id="item-form" class="form">
      <h3>${editing ? "Edit item" : "Add item"}</h3>

      <label>Item name
        <input name="name" required value="${escapeHtml(item?.name)}" />
      </label>

      <label>Category
        <input name="category" list="category-list" placeholder="e.g. Dairy"
               value="${escapeHtml(item?.category)}" />
        <datalist id="category-list">${categoryOptions}</datalist>
        <datalist id="unit-list">${Inventory.ALLOWED_UNITS.map((u) => `<option value="${u}"></option>`).join("")}</datalist>
      </label>

      <div class="form-row">
        <label>Quantity
          <input name="quantity" type="number" min="0" step="any"
                 value="${editing ? item.quantity : 0}" ${editing ? "disabled" : ""} />
        </label>
        <label>Unit
          <input name="unit" list="unit-list" required placeholder="kg, liters, pcs"
                 value="${escapeHtml(item?.unit)}" />
        </label>
      </div>
      ${editing ? `<p class="muted">To change the quantity, use Stock in / Stock out.</p>` : ""}

      <label>Minimum stock
        <input name="minStock" type="number" min="0" step="any"
               value="${item ? item.minStock : 0}" />
      </label>

      <label>Restock target (optional)
        <input name="targetStock" type="number" min="0" step="any"
               value="${item?.targetStock ?? ""}" placeholder="default: 2 × minimum" />
      </label>

      <p id="form-error" class="form-error hidden"></p>

      <div class="form-actions">
        <button type="button" id="form-cancel" class="btn btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-primary">${editing ? "Save changes" : "Add item"}</button>
      </div>
    </form>
  `;

  document.getElementById("form-cancel").addEventListener("click", () => dialog.close());

  const form = document.getElementById("item-form");
  const errorBox = document.getElementById("form-error");

  // Saves the item. `options` lets the user override a "looks similar" warning.
  function submitItem(options = {}) {
    const data = Object.fromEntries(new FormData(form));

    // A blank number box counts as 0 (the restock target stays optional)
    const quantity = data.quantity === "" ? 0 : data.quantity;
    const minStock = data.minStock === "" ? 0 : data.minStock;

    try {
      if (editing) {
        Inventory.updateItem(itemId, {
          name: data.name,
          category: data.category,
          unit: data.unit,
          minStock,
          targetStock: data.targetStock
        }, options);
        showMessage("Item updated.");
      } else {
        Inventory.addItem({
          name: data.name,
          category: data.category,
          quantity,
          unit: data.unit,
          minStock,
          targetStock: data.targetStock
        }, options);
        showMessage("Item added.");
      }
      dialog.close();
      renderInventoryTable();
    } catch (error) {
      if (error.code === "SIMILAR_NAME" || error.code === "SIMILAR_CATEGORY") {
        showSimilarPrompt(error, options);
        return;
      }
      // Keep the form open and show what went wrong (duplicate name, bad number, etc.)
      errorBox.textContent = error.message;
      errorBox.classList.remove("hidden");
    }
  }

  // "Did you mean ...?" with two choices instead of a hard block
  function showSimilarPrompt(error, options) {
    const isName = error.code === "SIMILAR_NAME";
    errorBox.innerHTML = `
      ${escapeHtml(error.message)}
      <div class="form-actions">
        <button type="button" id="similar-use" class="btn btn-small">${isName ? "Same item, cancel" : `Use “${escapeHtml(error.similar)}”`}</button>
        <button type="button" id="similar-add" class="btn btn-small">Add anyway</button>
      </div>`;
    errorBox.classList.remove("hidden");

    document.getElementById("similar-use").addEventListener("click", () => {
      if (isName) {
        dialog.close();
        showMessage(`“${error.similar}” already exists. Use Stock in to add more.`);
      } else {
        form.elements["category"].value = error.similar;
        submitItem(options);
      }
    });
    document.getElementById("similar-add").addEventListener("click", () => {
      submitItem({ ...options, [isName ? "allowSimilarName" : "allowSimilarCategory"]: true });
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitItem();
  });

  dialog.showModal();
}

// Delete button: ask first, then delete
function handleDelete(itemId) {
  const item = Inventory.getItemById(itemId);
  if (!item) {
    showMessage("Item not found.", true);
    return;
  }

  const sure = confirm(
    `Delete "${item.name}"? Its stock movements and AI results will also be deleted.`
  );
  if (!sure) return;

  try {
    Inventory.deleteItem(itemId);
    showMessage("Item deleted.");
    renderInventoryTable();
  } catch (error) {
    showMessage(error.message, true);
  }
}

// ------------------------------------------------------------
// SECTION 6: Stock in / Stock out
// ------------------------------------------------------------

// Opens the pop-up for recording stock received ("in") or used ("out")
function openStockForm(itemId, type) {
  const item = Inventory.getItemById(itemId);
  if (!item) {
    showMessage("Item not found.", true);
    return;
  }

  const isIn = type === "in";

  // Reuse the same dialog as the add/edit form
  let dialog = document.getElementById("item-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "item-dialog";
    document.body.appendChild(dialog);
  }

  dialog.innerHTML = `
    <form id="stock-form" class="form">
      <h3>${isIn ? "Stock in" : "Stock out"}: ${escapeHtml(item.name)}</h3>
      <p class="muted">Current stock: ${item.quantity} ${escapeHtml(item.unit)}</p>

      <label>${isIn ? "Quantity received" : "Quantity used"} (${escapeHtml(item.unit)})
        <input name="quantity" type="number" min="0" step="any" required />
      </label>

      <label>Note (optional)
        <input name="note" placeholder="${isIn ? "e.g. Weekly delivery" : "e.g. Used today"}" />
      </label>

      <p id="form-error" class="form-error hidden"></p>

      <div class="form-actions">
        <button type="button" id="form-cancel" class="btn btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-primary">${isIn ? "Add stock" : "Remove stock"}</button>
      </div>
    </form>
  `;

  document.getElementById("form-cancel").addEventListener("click", () => dialog.close());

  document.getElementById("stock-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));

    try {
      if (isIn) {
        Inventory.stockIn(itemId, data.quantity, data.note);
      } else {
        Inventory.stockOut(itemId, data.quantity, data.note);
      }
      showMessage(
        `${isIn ? "Added" : "Removed"} ${data.quantity} ${item.unit} ${isIn ? "to" : "from"} ${item.name}.`
      );
      dialog.close();
      renderInventoryTable();
    } catch (error) {
      // Example: "Not enough stock. Only 3 kg of Espresso Beans available."
      const box = document.getElementById("form-error");
      box.textContent = error.message;
      box.classList.remove("hidden");
    }
  });

  dialog.showModal();
  document.querySelector("#stock-form input[name='quantity']").focus();
}

// ------------------------------------------------------------
// SECTION 6B: Stock movement history pop-up
// ------------------------------------------------------------

// Opens a pop-up listing stock movements (newest first).
// openHistory(itemId) -> history of ONE item
// openHistory()       -> history of ALL items
function openHistory(itemId = null) {
  const item = itemId ? Inventory.getItemById(itemId) : null;

  if (itemId && !item) {
    showMessage("Item not found.", true);
    return;
  }

  // Reuse the same dialog as the other forms
  let dialog = document.getElementById("item-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "item-dialog";
    document.body.appendChild(dialog);
  }

  try {
    const movements = Inventory.getMovements(itemId || undefined);

    const rows = movements
      .map((m) => {
        const sign = m.type === "in" ? "+" : "−";
        const note = m.note ? ` · ${escapeHtml(m.note)}` : "";
        // In the all-items view we show the item name; in a single-item view we don't need it
        const title = item ? (m.type === "in" ? "Stock in" : "Stock out") : escapeHtml(m.itemName);
        return `
        <li class="list-row">
          <div>
            <strong>${title}</strong>
            <div class="muted">${formatDate(m.date)}${note}</div>
          </div>
          <span class="move move-${m.type}">${sign}${m.quantity}</span>
        </li>`;
      })
      .join("");

    dialog.innerHTML = `
      <div class="form">
        <h3>${item ? `History: ${escapeHtml(item.name)}` : "All stock movements"}</h3>
        <div class="history-list">
          ${movements.length === 0
            ? `<p class="empty">No stock movements yet.</p>`
            : `<ul class="list">${rows}</ul>`}
        </div>
        <div class="form-actions">
          <button type="button" id="history-export" class="btn btn-secondary">Export CSV</button>
          <button type="button" id="history-close" class="btn btn-secondary">Close</button>
        </div>
      </div>
    `;

    document.getElementById("history-close").addEventListener("click", () => dialog.close());
    document.getElementById("history-export").addEventListener("click", () => {
      downloadFile(`softstock-history-${todayStamp()}.csv`, Inventory.exportMovementsCSV());
    });
    dialog.showModal();
  } catch (error) {
    showMessage(error.message, true);
  }
}

// ------------------------------------------------------------
// SECTION 6C: CSV export / import (added by Member 3; Member 1 may restyle)
// ------------------------------------------------------------

// Saves text as a file. The BOM at the start makes Excel read accents correctly.
function downloadFile(filename, text) {
  const blob = new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

// Describes an import result in plain words (used in the confirmation and the final message)
function importSummary(report) {
  const parts = [`${report.added} new`, `${report.updated} updated`, `${report.unchanged} unchanged`];
  if (report.skipped) parts.push(`${report.skipped} skipped`);
  return parts.join(", ");
}

async function handleCsvFile(file) {
  if (!file) return;
  if (file.size > 1_000_000) {
    showMessage("That file is too large for an inventory CSV (limit 1 MB).", true);
    return;
  }

  try {
    const text = await file.text();
    const preview = Inventory.previewInventoryCSV(text); // checks only, saves nothing

    if (preview.added + preview.updated === 0) {
      const first = preview.errors[0];
      showMessage(
        first ? `Nothing to import. Row ${first.row}: ${first.message}` : "Nothing to import: no new or changed items.",
        true
      );
      return;
    }

    const problems = preview.errors
      .slice(0, 5)
      .map((e) => `  • Row ${e.row}: ${e.message}`)
      .join("\n");
    const more = preview.errors.length > 5 ? `\n  …and ${preview.errors.length - 5} more` : "";
    const warnings = preview.warnings.length ? `\n\nCheck these:\n${preview.warnings.slice(0, 5).map((w) => "  • " + w).join("\n")}` : "";

    const sure = confirm(
      `Import "${file.name}"?\n\n${importSummary(preview)}.\n` +
      "Items with the same name are updated; quantity changes are added to the history." +
      (problems ? `\n\nThese rows will be skipped:\n${problems}${more}` : "") +
      warnings
    );
    if (!sure) return;

    const result = Inventory.importInventoryCSV(text);
    renderInventoryTable();
    showMessage(`Import done: ${importSummary(result)}.`);
  } catch (error) {
    showMessage(error.message, true);
  }
}

// Connects the Export / Import buttons on the Inventory page
function initCsvButtons() {
  document.getElementById("export-csv-btn").addEventListener("click", () => {
    downloadFile(`softstock-inventory-${todayStamp()}.csv`, Inventory.exportInventoryCSV());
    showMessage("Inventory exported.");
  });

  const fileInput = document.getElementById("csv-file");
  document.getElementById("import-csv-btn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    await handleCsvFile(fileInput.files[0]);
    fileInput.value = ""; // lets the same file be chosen again
  });
}

// ------------------------------------------------------------
// SECTION 7: AI Insights page
// ------------------------------------------------------------
//
// HOW THIS CONNECTS TO MEMBER 2 (ai.js):
// This page expects ai.js to export ONE function:
//
//     export async function classifyObservation(itemId, text)
//
// It should classify the text, call saveObservation() from inventory.js
// (as our leader instructed), and return an object like:
//
//     { label: "Increasing demand", confidence: 0.87, explanation: "..." }
//
// "confidence" is a number from 0 to 1. "explanation" is optional.
// If Member 2 uses a different function name, change it in ONE place:
// the line marked  <<< CHANGE HERE  inside handleClassify() below.

// Shows the "needs attention" colors next to the AI result
function stockSummary(item) {
  const status = Inventory.getStatus(item);
  return `${item.quantity} ${escapeHtml(item.unit)} in stock ${statusBadge(status)}`;
}

// Builds the AI Insights page: the form, the result area, and the history
export function renderInsights() {
  const container = document.getElementById("insights-content");

  try {
    const items = Inventory.getItems().sort((a, b) => a.name.localeCompare(b.name));
    const options = items
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
      .join("");

    container.innerHTML = `
      <div class="panel">
        <h3>Describe what you noticed</h3>
        <p class="muted">
          Pick an item and write a short note about its sales or stock
          (for example, "Milk keeps running out earlier than usual").
          The AI will classify the demand signal.
        </p>

        <p id="ai-status" class="muted"></p>
        <form id="ai-form" class="form form-flat">
          <label>Item
            <select name="itemId" required>
              <option value="">Select an item…</option>
              ${options}
            </select>
          </label>

          <label>Observation
            <textarea name="text" rows="3" maxlength="400" required
                      placeholder="e.g. We've been buying oat milk several times this week."></textarea>
          </label>

          <div class="form-actions">
            <button type="submit" id="ai-submit" class="btn btn-primary">Classify</button>
          </div>
        </form>

        <div id="ai-result"></div>
      </div>

      <div class="panel">
        <h3>Past AI classifications</h3>
        <div id="ai-history"></div>
      </div>
    `;

    document.getElementById("ai-form").addEventListener("submit", handleClassify);
    // Start downloading/loading the AI model in the background and show its status
    AI.preloadModel((msg) => {
      const status = document.getElementById("ai-status");
      if (status) status.textContent = msg;
    });
    renderInsightsHistory();
  } catch (error) {
    container.innerHTML = `<p class="empty">Could not load the AI Insights page.</p>`;
    showMessage(error.message, true);
  }
}

// List of saved classifications (newest first)
function renderInsightsHistory() {
  const holder = document.getElementById("ai-history");
  try {
    const observations = Inventory.getObservations().slice(0, 20);
    holder.innerHTML =
      observations.length === 0
        ? `<p class="empty">No AI classifications yet.</p>`
        : `<ul class="list">${observations
            .map(
              (o) => `
          <li class="list-row">
            <div>
              <strong>${escapeHtml(o.itemName)}</strong>
              <div class="muted">“${escapeHtml(o.text)}”</div>
              <div class="muted">${formatDate(o.date)}</div>
            </div>
            <div class="ai-result">
              <span class="badge badge-ai">${escapeHtml(o.label)}</span>
              <div class="muted">${Math.round(o.confidence * 100)}%</div>
            </div>
          </li>`
            )
            .join("")}</ul>`;
  } catch (error) {
    holder.innerHTML = `<p class="empty">Could not load past classifications.</p>`;
    showMessage(error.message, true);
  }
}

// Shows one result card: label, confidence, all scores, suggested action, and the item's REAL stock
function showAIResult(item, result) {
  const label = result?.label ?? "Unknown";
  const percent = Math.round(Math.min(Math.max(Number(result?.confidence) || 0, 0), 1) * 100);

  // Warning when the model is unsure
  const warning = result?.lowConfidence
    ? `<p class="form-error">Low confidence. Treat this result carefully.</p>`
    : "";

  const explanation = result?.explanation
    ? `<p class="result-explanation">${escapeHtml(result.explanation)}</p>`
    : "";

  // One small bar per category so the owner sees the full picture
  const allScores = (result?.scores ?? [])
    .map((s) => {
      const p = Math.round(s.confidence * 100);
      return `<div class="muted">${escapeHtml(s.label)}: ${p}%
        <div class="confidence-bar"><div class="confidence-fill" style="width:${p}%"></div></div></div>`;
    })
    .join("");

  const action = result?.suggestedAction
    ? `<p><strong>Suggested action:</strong> ${escapeHtml(result.suggestedAction)}</p>`
    : "";

  document.getElementById("ai-result").innerHTML = `
    <div class="result-card">
      <div class="muted">AI classification for <strong>${escapeHtml(item.name)}</strong></div>
      <div class="result-label">${escapeHtml(label)}</div>
      <div class="confidence">
        <div class="confidence-bar"><div class="confidence-fill" style="width:${percent}%"></div></div>
        <span>${percent}% confidence</span>
      </div>
      ${warning}
      ${explanation}
      ${action}
      <details><summary class="muted">All category scores</summary>${allScores}</details>
      <p class="muted">Compare with actual stock: ${stockSummary(item)}</p>
    </div>
  `;
}

// Runs when the user presses "Classify"
async function handleClassify(event) {
  event.preventDefault();

  const form = event.target;
  const resultBox = document.getElementById("ai-result");
  const button = document.getElementById("ai-submit");
  const itemId = form.elements["itemId"].value;
  const text = form.elements["text"].value.trim();

  try {
    if (!itemId) throw new Error("Please select an item.");
    if (!text) throw new Error("Please write an observation.");

    // <<< CHANGE HERE if Member 2 uses a different function name
    if (typeof AI.classifyObservation !== "function") {
      throw new Error("The AI model is not connected yet (waiting for ai.js).");
    }

    button.disabled = true;
    button.textContent = "Analyzing…";
    resultBox.innerHTML = `<p class="muted">Running the AI model. The first run can take a while because the model has to load.</p>`;

    // <<< CHANGE HERE: the call to Member 2's function
    const result = await AI.classifyObservation(itemId, text);

    showAIResult(Inventory.getItemById(itemId), result);
    form.elements["text"].value = "";
    renderInsightsHistory();
  } catch (error) {
    resultBox.innerHTML = "";
    showMessage(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Classify";
  }
}

// ------------------------------------------------------------
// SECTION 8: Startup (main.js calls this once)
// ------------------------------------------------------------

export function initUI() {
  initNavigation();
  renderDashboard();
  renderInventory();
  renderInsights();
}