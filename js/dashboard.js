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
        <button id="all-history-btn" class="btn btn-secondary">All history</button>        <input id="inv-search" type="search"
               placeholder="Search by name or category..."
               value="${escapeHtml(inventoryFilters.search)}" />
        <select id="inv-status">
          <option value="all">All statuses</option>
          <option value="ok">OK</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
      </div>
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
      </label>

      <div class="form-row">
        <label>Quantity
          <input name="quantity" type="number" min="0" step="any"
                 value="${editing ? item.quantity : 0}" ${editing ? "disabled" : ""} />
        </label>
        <label>Unit
          <input name="unit" required placeholder="kg, liters, pcs"
                 value="${escapeHtml(item?.unit)}" />
        </label>
      </div>
      ${editing ? `<p class="muted">To change the quantity, use Stock in / Stock out.</p>` : ""}

      <label>Minimum stock
        <input name="minStock" type="number" min="0" step="any"
               value="${item ? item.minStock : 0}" />
      </label>

      <p id="form-error" class="form-error hidden"></p>

      <div class="form-actions">
        <button type="button" id="form-cancel" class="btn btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-primary">${editing ? "Save changes" : "Add item"}</button>
      </div>
    </form>
  `;

  document.getElementById("form-cancel").addEventListener("click", () => dialog.close());

  document.getElementById("item-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));

    // A blank number box counts as 0
    const quantity = data.quantity === "" ? 0 : data.quantity;
    const minStock = data.minStock === "" ? 0 : data.minStock;

    try {
      if (editing) {
        Inventory.updateItem(itemId, {
          name: data.name,
          category: data.category,
          unit: data.unit,
          minStock
        });
        showMessage("Item updated.");
      } else {
        Inventory.addItem({
          name: data.name,
          category: data.category,
          quantity,
          unit: data.unit,
          minStock
        });
        showMessage("Item added.");
      }
      dialog.close();
      renderInventoryTable();
    } catch (error) {
      // Keep the form open and show what went wrong (duplicate name, bad number, etc.)
      const box = document.getElementById("form-error");
      box.textContent = error.message;
      box.classList.remove("hidden");
    }
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
          <button type="button" id="history-close" class="btn btn-secondary">Close</button>
        </div>
      </div>
    `;

    document.getElementById("history-close").addEventListener("click", () => dialog.close());
    dialog.showModal();
  } catch (error) {
    showMessage(error.message, true);
  }
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

// Shows one result card: label, confidence bar, explanation, and the item's REAL stock
function showAIResult(item, result) {
  const label = result?.label ?? "Unknown";
  const percent = Math.round(Math.min(Math.max(Number(result?.confidence) || 0, 0), 1) * 100);
  const explanation = result?.explanation
    ? `<p class="result-explanation">${escapeHtml(result.explanation)}</p>`
    : "";

  document.getElementById("ai-result").innerHTML = `
    <div class="result-card">
      <div class="muted">AI classification for <strong>${escapeHtml(item.name)}</strong></div>
      <div class="result-label">${escapeHtml(label)}</div>
      <div class="confidence">
        <div class="confidence-bar"><div class="confidence-fill" style="width:${percent}%"></div></div>
        <span>${percent}% confidence</span>
      </div>
      ${explanation}
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