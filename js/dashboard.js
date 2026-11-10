
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
      window.scrollTo(0, 0);

      views.forEach((v) =>
        v.classList.toggle("hidden", v.id !== `view-${tab.dataset.view}`)
      );

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
function attentionList(items, latestLabels) {
  if (items.length === 0) {
    return `<p class="empty">Every shelf is stocked. Nothing to refill today. ☕</p>`;
  }

  const rows = items
    .map(
      (item) => `
      <li class="list-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          ${latestLabels.has(item.id)
            ? `<span class="badge badge-ai">${escapeHtml(latestLabels.get(item.id))}</span>`
            : ""}
          <div class="muted">${item.quantity} ${escapeHtml(item.unit)} left (minimum ${item.minStock})</div>
          <div class="muted">Suggested restock: <strong>${item.suggestedRestock} ${escapeHtml(item.unit)}</strong> (rule-based)</div>
        </div>
        <div class="attention-actions">
          ${statusBadge(item.status)}
          <button
            class="btn btn-small btn-in"
            data-action="attention-stock-in"
            data-id="${escapeHtml(item.id)}"
          >
            Stock in
          </button>
        </div>
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
          ${o.stockWarning ? `<div class="form-error">${escapeHtml(o.stockWarning)}</div>` : ""}
        </div>
        <div class="ai-result">
          <span class="badge badge-ai ${aiLabelClass(o.label)}">${escapeHtml(o.label)}</span>
          <div class="${confidenceClass(Math.round(o.confidence * 100))}">${Math.round(o.confidence * 100)}%</div>
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
    const observations = Inventory.getObservations();

    const latestLabels = new Map();

    observations.forEach((observation) => {
      if (!latestLabels.has(observation.itemId)) {
        latestLabels.set(observation.itemId, observation.label);
      }
    });

    container.innerHTML = `
      <div class="hero">
        <img src="./assets/cafe.jpg" alt="Softbound Café storefront" width="785" height="672" />
        <div class="hero-text">
          <p class="hero-title">Softbound Café</p>
          <p class="hero-tag">Everyone's Coffee. Every Story. Bound.</p>
        </div>
      </div>

      <div class="stat-grid">
        ${statCard("Items on the shelf", stats.totalItems, "stat-total")}
        ${statCard("Well stocked", stats.okCount, "stat-ok")}
        ${statCard("Low stock", stats.lowStockCount, "stat-low")}
        ${statCard("Out of stock", stats.outOfStockCount, "stat-out")}
      </div>

      <div class="panel chalkboard">
        <h3>Running low</h3>
        ${attentionList(stats.attentionItems, latestLabels)}
      </div>

      <div class="panel-grid">
        <div class="panel">
          <h3>Latest stock movements</h3>
          ${movementList(stats.recentMovements)}
        </div>
        <div class="panel">
          <h3>Recent AI classifications</h3>
          ${observationList(stats.recentObservations)}
        </div>
      </div>
    `;

    container.querySelectorAll('[data-action="attention-stock-in"]').forEach((button) => {
      button.addEventListener("click", () => {
        openStockForm(button.dataset.id, "in");
      });
    });
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
    renderInventory();
    renderInsights();
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
export function renderInventory() {
  const container = document.getElementById("inventory-content");

  try {
    container.innerHTML = `
      <div class="toolbar">
        <button id="add-item-btn" class="btn btn-primary">+ Add item</button>
        <button id="all-history-btn" class="btn btn-secondary">All history</button>
        <button id="export-csv-btn" class="btn btn-secondary">Export CSV</button>
        <button id="import-csv-btn" class="btn btn-secondary">Import CSV</button>
        <input id="csv-file" type="file" accept=".csv,text/csv" class="hidden" />
        <input id="inv-search" type="search"
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

      <div class="dashboard-footer">
        <button id="reset-btn" class="btn btn-secondary">Reset sample data</button>
      </div>
    `;

    const searchBox = document.getElementById("inv-search");
    const statusSelect = document.getElementById("inv-status");

    statusSelect.value = inventoryFilters.status;

    searchBox.addEventListener("input", () => {
      inventoryFilters.search = searchBox.value;
      renderInventoryTable();
    });

    statusSelect.addEventListener("change", () => {
      inventoryFilters.status = statusSelect.value;
      renderInventoryTable();
    });

    document.getElementById("add-item-btn").addEventListener("click", () => openItemForm());
    document.getElementById("reset-btn").addEventListener("click", handleReset);
    document.getElementById("all-history-btn").addEventListener("click", () => openHistory());

    initCsvButtons();

    document.getElementById("inv-table").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      if (button.dataset.action === "in") openStockForm(button.dataset.id, "in");
      if (button.dataset.action === "out") openStockForm(button.dataset.id, "out");
      if (button.dataset.action === "history") openHistory(button.dataset.id);
      if (button.dataset.action === "edit") openItemForm(button.dataset.id);
      if (button.dataset.action === "delete") handleDelete(button.dataset.id);
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
          <td data-label="Item"><strong>${escapeHtml(item.name)}</strong></td>
          <td data-label="Category">${escapeHtml(item.category)}</td>
          <td data-label="Quantity">${item.quantity} ${escapeHtml(item.unit)}</td>
          <td data-label="Minimum">${item.minStock}</td>
          <td data-label="Status">${statusBadge(item.status)}</td>
          <td class="actions" data-label="Actions">
            <button class="btn btn-small btn-in" data-action="in" data-id="${escapeHtml(item.id)}">Stock in</button>
            <button class="btn btn-small btn-out" data-action="out" data-id="${escapeHtml(item.id)}" ${item.status === "out" ? "disabled" : ""}>Stock out</button>
            <button class="btn btn-small" data-action="history" data-id="${escapeHtml(item.id)}">History</button>
            <button class="btn btn-small" data-action="edit" data-id="${escapeHtml(item.id)}">Edit</button>
            <button class="btn btn-small btn-danger" data-action="delete" data-id="${escapeHtml(item.id)}">Delete</button>
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

  let dialog = document.getElementById("item-dialog");

  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "item-dialog";
    document.body.appendChild(dialog);
  }

  const categories = [...new Set(Inventory.getItems().map((i) => i.category))];

  dialog.innerHTML = `
    <form id="item-form" class="form">
      <h3>${editing ? "Edit item" : "Add item"}</h3>

      <label>Item name
        <input name="name" required value="${escapeHtml(item?.name)}" />
      </label>

      <label>Category</label>

      <div class="custom-select" id="category-picker">
        <button
          type="button"
          class="custom-select-trigger"
          id="category-trigger"
          aria-haspopup="listbox"
          aria-expanded="false"
        >
          <span id="category-selected">
            ${item ? escapeHtml(item.category) : "Select a category..."}
          </span>
          <span class="custom-select-arrow">⌄</span>
        </button>

        <div
          class="custom-select-menu hidden"
          id="category-menu"
          role="listbox"
          aria-label="Select a category"
        >
          ${categories.map((c) => `
            <button
              type="button"
              class="custom-select-option"
              role="option"
              data-value="${escapeHtml(c)}"
            >
              ${escapeHtml(c)}
            </button>
          `).join("")}

          <button
            type="button"
            class="custom-select-option"
            role="option"
            data-value="__new_category__"
          >
            + New category...
          </button>
        </div>
      </div>

      <select name="category" id="category-select" required class="visually-hidden-select">
        <option value="">Select a category</option>
        ${categories.map((c) => `
          <option value="${escapeHtml(c)}"
            ${item?.category === c ? "selected" : ""}>
            ${escapeHtml(c)}
          </option>
        `).join("")}
        <option value="__new_category__">+ New category...</option>
      </select>

      <label id="new-category-label" class="hidden">
        New category name
        <input name="newCategory" id="new-category-input"
               placeholder="Enter new category" />
      </label>

      <div class="form-row">
        <label>Quantity
          <input name="quantity" type="number" min="0" step="any"
                 value="${editing ? item.quantity : 0}" ${editing ? "disabled" : ""} />
        </label>

        <div class="unit-field">
          <label for="unit-trigger">Unit</label>

          <div class="custom-select" id="unit-picker">
            <button
              type="button"
              class="custom-select-trigger"
              id="unit-trigger"
              aria-haspopup="listbox"
              aria-expanded="false"
            >
              <span id="unit-selected">
                ${item ? escapeHtml(item.unit) : "Select a unit..."}
              </span>
              <span class="custom-select-arrow">⌄</span>
            </button>

            <div
              class="custom-select-menu hidden"
              id="unit-menu"
              role="listbox"
              aria-label="Select a unit"
            >
              ${Inventory.ALLOWED_UNITS.map((u) => `
                <button
                  type="button"
                  class="custom-select-option"
                  role="option"
                  data-value="${escapeHtml(u)}"
                >
                  ${escapeHtml(u)}
                </button>
              `).join("")}
            </div>
          </div>

          <select name="unit" required class="visually-hidden-select">
            <option value="">Select a unit...</option>
            ${Inventory.ALLOWED_UNITS.map((u) => `
              <option value="${escapeHtml(u)}"
                ${item?.unit === u ? "selected" : ""}>
                ${escapeHtml(u)}
              </option>
            `).join("")}
          </select>
        </div>
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
  const categorySelect = form.elements["category"];
  const newCategoryLabel = document.getElementById("new-category-label");
  const newCategoryInput = document.getElementById("new-category-input");

  // ----------------------------------------------------------
  // Custom Category dropdown
  // ----------------------------------------------------------

  const categoryPicker = document.getElementById("category-picker");
  const categoryTrigger = document.getElementById("category-trigger");
  const categoryMenu = document.getElementById("category-menu");
  const categorySelected = document.getElementById("category-selected");

  categoryTrigger.addEventListener("click", () => {
    const isOpen = !categoryMenu.classList.contains("hidden");

    categoryMenu.classList.toggle("hidden");
    categoryTrigger.setAttribute("aria-expanded", String(!isOpen));
  });

  categoryMenu.querySelectorAll(".custom-select-option").forEach((option) => {
    option.addEventListener("click", () => {
      categorySelect.value = option.dataset.value;
      categorySelected.textContent = option.textContent.trim();

      categorySelect.dispatchEvent(new Event("change", { bubbles: true }));

      categoryMenu.classList.add("hidden");
      categoryTrigger.setAttribute("aria-expanded", "false");
    });
  });

  // ----------------------------------------------------------
  // Custom Unit dropdown
  // ----------------------------------------------------------

  const unitPicker = document.getElementById("unit-picker");
  const unitTrigger = document.getElementById("unit-trigger");
  const unitMenu = document.getElementById("unit-menu");
  const unitSelected = document.getElementById("unit-selected");
  const unitSelect = form.elements["unit"];

  unitTrigger.addEventListener("click", () => {
    const isOpen = !unitMenu.classList.contains("hidden");

    unitMenu.classList.toggle("hidden");
    unitTrigger.setAttribute("aria-expanded", String(!isOpen));
  });

  unitMenu.querySelectorAll(".custom-select-option").forEach((option) => {
    option.addEventListener("click", () => {
      unitSelect.value = option.dataset.value;
      unitSelected.textContent = option.textContent.trim();

      unitMenu.classList.add("hidden");
      unitTrigger.setAttribute("aria-expanded", "false");
    });
  });

  // Close both dropdowns when clicking outside
  document.addEventListener("click", (event) => {
    if (!categoryPicker.contains(event.target)) {
      categoryMenu.classList.add("hidden");
      categoryTrigger.setAttribute("aria-expanded", "false");
    }

    if (!unitPicker.contains(event.target)) {
      unitMenu.classList.add("hidden");
      unitTrigger.setAttribute("aria-expanded", "false");
    }
  });

  // ----------------------------------------------------------
  // Category change behavior
  // ----------------------------------------------------------

  categorySelect.addEventListener("change", () => {
    const isNew = categorySelect.value === "__new_category__";

    newCategoryLabel.classList.toggle("hidden", !isNew);
    newCategoryInput.required = isNew;

    if (isNew) {
      newCategoryInput.focus();
    }
  });

  const errorBox = document.getElementById("form-error");

  function submitItem(options = {}) {
    const data = Object.fromEntries(new FormData(form));

    const selectedCategory =
      data.category === "__new_category__"
        ? data.newCategory.trim()
        : data.category;

    if (!selectedCategory) {
      showMessage("Please select or enter a category.", true);
      return;
    }

    const quantity = data.quantity === "" ? 0 : data.quantity;
    const minStock = data.minStock === "" ? 0 : data.minStock;

    try {
      if (editing) {
        Inventory.updateItem(itemId, {
          name: data.name,
          category: selectedCategory,
          unit: data.unit,
          minStock,
          targetStock: data.targetStock
        }, options);

        showMessage("Item updated.");
      } else {
        Inventory.addItem({
          name: data.name,
          category: selectedCategory,
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

      errorBox.textContent = error.message;
      errorBox.classList.remove("hidden");
    }
  }

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
        categorySelected.textContent = error.similar;
        submitItem(options);
      }
    });

    document.getElementById("similar-add").addEventListener("click", () => {
      submitItem({
        ...options,
        [isName ? "allowSimilarName" : "allowSimilarCategory"]: true
      });
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

function openStockForm(itemId, type) {
  const item = Inventory.getItemById(itemId);

  if (!item) {
    showMessage("Item not found.", true);
    return;
  }

  const isIn = type === "in";

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
      renderDashboard();
    } catch (error) {
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

function openHistory(itemId = null) {
  const item = itemId ? Inventory.getItemById(itemId) : null;

  if (itemId && !item) {
    showMessage("Item not found.", true);
    return;
  }

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
// SECTION 6C: CSV export / import
// ------------------------------------------------------------

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

function importSummary(report) {
  const parts = [
    `${report.added} new`,
    `${report.updated} updated`,
    `${report.unchanged} unchanged`
  ];

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
    const preview = Inventory.previewInventoryCSV(text);

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

    const warnings = preview.warnings.length
      ? `\n\nCheck these:\n${preview.warnings.slice(0, 5).map((w) => "  • " + w).join("\n")}`
      : "";

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

function initCsvButtons() {
  document.getElementById("export-csv-btn").addEventListener("click", () => {
    downloadFile(`softstock-inventory-${todayStamp()}.csv`, Inventory.exportInventoryCSV());
    showMessage("Inventory exported.");
  });

  const fileInput = document.getElementById("csv-file");

  document.getElementById("import-csv-btn").addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    await handleCsvFile(fileInput.files[0]);
    fileInput.value = "";
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
//     { label: "Increasing demand", confidence: 0.87, explanation: "...", stockWarning: null }
//
// "confidence" is a number from 0 to 1. "explanation" is optional.
// "stockWarning" is text when the label conflicts with current stock, otherwise null.
// If Member 2 uses a different function name, change it in ONE place:
// the line marked  <<< CHANGE HERE  inside handleClassify() below.

// Shows the "needs attention" colors next to the AI result
function stockSummary(item) {
  const status = Inventory.getStatus(item);
  return `${item.quantity} ${escapeHtml(item.unit)} in stock ${statusBadge(status)}`;
}

function aiLabelClass(label) {
  const classes = {
    "Increasing demand": "ai-increasing",
    "Stable demand": "ai-stable",
    "Decreasing demand": "ai-decreasing",
    "Usage-driven stockouts": "ai-stockouts",
    "Possible overstocking": "ai-overstocking",
    "Supplier delivery delays": "ai-delays"
  };
  return classes[label] || "ai-unknown";
}

function confidenceClass(percent) {
  if (percent < 35) return "confidence-low";
  if (percent < 50) return "confidence-below-average";
  if (percent < 75) return "confidence-average";
  return "confidence-above-average";
}

const insightsHistoryState = { category: "all", item: "all", page: 1 };
const INSIGHTS_PAGE_SIZE = 5;

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
          <label>Item</label>

          <div class="custom-select" id="ai-item-picker">
            <button
              type="button"
              class="custom-select-trigger"
              id="ai-item-trigger"
              aria-haspopup="listbox"
              aria-expanded="false"
            >
              <span id="ai-item-selected">Select an item...</span>
              <span class="custom-select-arrow">⌄</span>
            </button>

            <div
              class="custom-select-menu hidden"
              id="ai-item-menu"
              role="listbox"
              aria-label="Select an inventory item"
            >
              ${items.map(item => `
                <button
                  type="button"
                  class="custom-select-option"
                  role="option"
                  data-value="${escapeHtml(item.id)}"
                >
                  ${escapeHtml(item.name)}
                </button>
              `).join("")}
            </div>
          </div>

          <select name="itemId" required class="visually-hidden-select">
            <option value="">Select an item...</option>
            ${options}
          </select>

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
        <div class="history-filters">
          <label class="history-filter">Category
            <select id="ai-history-category">
              <option value="all">All categories</option>
              ${[...new Set(items.map((item) => item.category))]
                .sort((a, b) => a.localeCompare(b))
                .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
                .join("")}
            </select>
          </label>
          <label class="history-filter">Item
            <select id="ai-history-item">
              <option value="all">All items</option>
              ${items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}
            </select>
          </label>
        </div>
        <div id="ai-history"></div>
      </div>
    `;

    document.getElementById("ai-form").addEventListener("submit", handleClassify);
    const categoryFilter = document.getElementById("ai-history-category");
    const itemFilter = document.getElementById("ai-history-item");
    categoryFilter.value = insightsHistoryState.category;
    itemFilter.value = insightsHistoryState.item;
    updateInsightsItemFilter();
    categoryFilter.addEventListener("change", (event) => {
      insightsHistoryState.category = event.target.value;
      insightsHistoryState.item = "all";
      insightsHistoryState.page = 1;
      updateInsightsItemFilter();
      renderInsightsHistory();
    });
    itemFilter.addEventListener("change", (event) => {
      insightsHistoryState.item = event.target.value;
      insightsHistoryState.page = 1;
      renderInsightsHistory();
    });
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
    const allObservations = Inventory.getObservations();
    const observations = allObservations.filter((observation) => {
      const item = observation.itemId ? Inventory.getItemById(observation.itemId) : null;
      const category = observation.category || item?.category;
      const categoryMatches =
        insightsHistoryState.category === "all" || category === insightsHistoryState.category;
      const itemMatches =
        insightsHistoryState.item === "all" || observation.itemId === insightsHistoryState.item;
      return categoryMatches && itemMatches;
    });
    const pageCount = Math.max(1, Math.ceil(observations.length / INSIGHTS_PAGE_SIZE));
    insightsHistoryState.page = Math.min(insightsHistoryState.page, pageCount);
    const start = (insightsHistoryState.page - 1) * INSIGHTS_PAGE_SIZE;
    const pageObservations = observations.slice(start, start + INSIGHTS_PAGE_SIZE);

    holder.innerHTML =
      observations.length === 0
        ? `<p class="empty">No AI classifications yet.</p>`
        : `<p class="muted">${observations.length} classification${observations.length === 1 ? "" : "s"} found.</p>
        <ul class="list">${pageObservations
            .map(
              (o) => {
                const status = o.status || (o.itemId ? Inventory.getItemById(o.itemId) && Inventory.getStatus(Inventory.getItemById(o.itemId)) : "ok");
                const item = o.itemId ? Inventory.getItemById(o.itemId) : null;
                const category = o.category || item?.category || "Uncategorized";
                const quantity = Number.isFinite(o.quantity) ? o.quantity : item?.quantity;
                const stockWarning = o.stockWarning
                  ? `<div class="form-error">${escapeHtml(o.stockWarning)}</div>`
                  : "";
                return `
          <li class="list-row result-history-${status || "ok"} ai-history-entry" data-id="${escapeHtml(o.id)}">
            <div>
              <strong>${escapeHtml(o.itemName)}</strong>
              <div class="muted">${escapeHtml(category)} · ${statusBadge(status || "ok")} · ${quantity ?? "—"} in stock</div>
              <div class="muted">“${escapeHtml(o.text)}”</div>
              <div class="muted">${formatDate(o.date)}</div>
              ${stockWarning}
            </div>
            <div class="ai-result">
              <span class="badge badge-ai ${aiLabelClass(o.label)}">${escapeHtml(o.label)}</span>
              <div class="${confidenceClass(Math.round(o.confidence * 100))}">${Math.round(o.confidence * 100)}%</div>
              <button type="button" class="btn btn-small btn-danger ai-delete" data-id="${escapeHtml(o.id)}">Delete</button>
            </div>
          </li>`;
            }
            )
            .join("")}</ul>
        ${pageCount > 1
          ? `<div class="history-pagination">
              <button type="button" class="btn btn-small" data-history-page="${insightsHistoryState.page - 1}" ${insightsHistoryState.page === 1 ? "disabled" : ""}>Previous</button>
              <span class="muted">Page ${insightsHistoryState.page} of ${pageCount}</span>
              <button type="button" class="btn btn-small" data-history-page="${insightsHistoryState.page + 1}" ${insightsHistoryState.page === pageCount ? "disabled" : ""}>Next</button>
            </div>`
          : ""}`;

    holder.querySelectorAll(".ai-delete").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!window.confirm("Delete this AI classification?")) return;
        try {
          Inventory.deleteObservation(button.dataset.id);
          showMessage("AI classification deleted.");
          renderInsightsHistory();
          renderDashboard();
        } catch (error) {
          showMessage(error.message, true);
        }
      });
    });
    holder.querySelectorAll(".ai-history-entry").forEach((entry) => {
      entry.addEventListener("click", () => {
        const observation = allObservations.find((item) => item.id === entry.dataset.id);
        const item = observation?.itemId ? Inventory.getItemById(observation.itemId) : null;
        if (!observation || !item) {
          showMessage("The item for this classification is no longer available.", true);
          return;
        }
        showAIResult(item, {
          label: observation.label,
          confidence: observation.confidence,
          lowConfidence: observation.lowConfidence,
          scores: observation.scores,
          suggestedAction: observation.suggestedAction,
          explanation: observation.explanation,
          stockWarning: observation.stockWarning,
          stockStatus: observation.status,
          stockQuantity: observation.quantity,
          stockCategory: observation.category,
          observation: observation.text
        });
        document.getElementById("ai-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    holder.querySelectorAll("[data-history-page]").forEach((button) => {
      button.addEventListener("click", () => {
        insightsHistoryState.page = Number(button.dataset.historyPage);
        renderInsightsHistory();
      });
    });
  } catch (error) {
    holder.innerHTML = `<p class="empty">Could not load past classifications.</p>`;
    showMessage(error.message, true);
  }
}

function updateInsightsItemFilter() {
  const itemFilter = document.getElementById("ai-history-item");
  if (!itemFilter) return;

  const items = Inventory.getItems()
    .filter(
      (item) =>
        insightsHistoryState.category === "all" ||
        item.category === insightsHistoryState.category
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  itemFilter.innerHTML = `
    <option value="all">All items</option>
    ${items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}
  `;
  itemFilter.value = insightsStateItemExists(items) ? insightsHistoryState.item : "all";
}

function insightsStateItemExists(items) {
  return (
    insightsHistoryState.item === "all" ||
    items.some((item) => item.id === insightsHistoryState.item)
  );
}

// Shows one result card: label, confidence, all scores, suggested action, and the item's REAL stock
function showAIResult(item, result) {
  const label = result?.label ?? "Unknown";
  const percent = Math.round(Math.min(Math.max(Number(result?.confidence) || 0, 0), 1) * 100);
  const status = result?.stockStatus ?? Inventory.getStatus(item);
  const quantity = result?.stockQuantity ?? item.quantity;
  const category = result?.stockCategory ?? item.category;
  const resultTone = result?.stockWarning ? "warning" : status;

  const warning = result?.lowConfidence
    ? `<p class="form-error">Low confidence. Treat this result carefully.</p>`
    : "";

  const stockWarning = result?.stockWarning
    ? `<p class="form-error">${escapeHtml(result.stockWarning)}</p>`
    : "";

  const explanation = result?.explanation
    ? `<p class="result-explanation">${escapeHtml(result.explanation)}</p>`
    : "";

  const allScores = (result?.scores ?? [])
    .map((s) => {
      const p = Math.round(s.confidence * 100);
      return `<div class="muted">${escapeHtml(s.label)}: <span class="${confidenceClass(p)}">${p}%</span>
        <div class="confidence-bar"><div class="confidence-fill" style="width:${p}%"></div></div></div>`;
    })
    .join("");

  const action = result?.suggestedAction
    ? `<p><strong>Suggested action:</strong> ${escapeHtml(result.suggestedAction)}</p>`
    : "";
  const observation = result?.observation
    ? `<p class="result-observation"><strong>Observation:</strong> “${escapeHtml(result.observation)}”</p>`
    : "";

  document.getElementById("ai-result").innerHTML = `
    <div class="result-card result-${resultTone}">
      <div class="muted">AI classification for <strong>${escapeHtml(item.name)}</strong></div>
      ${observation}
      <div class="result-stock">${escapeHtml(category)} · ${statusBadge(status)} · ${quantity} ${escapeHtml(item.unit)} in stock</div>
      <div class="ai-result result-label"><span class="badge badge-ai ${aiLabelClass(label)}">${escapeHtml(label)}</span></div>
      <div class="confidence">
        <div class="confidence-bar"><div class="confidence-fill" style="width:${percent}%"></div></div>
        <span class="${confidenceClass(percent)}">${percent}% confidence</span>
      </div>
      ${warning}
      ${stockWarning}
      ${explanation}
      ${action}
      <details><summary class="muted">All category scores</summary>${allScores}</details>
      <p class="muted">Compare with actual stock: ${stockSummary(item)}</p>
    </div>
  `;
}

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

    if (typeof AI.classifyObservation !== "function") {
      throw new Error("The AI model is not connected yet (waiting for ai.js).");
    }

    button.disabled = true;
    button.textContent = "Analyzing…";

    resultBox.innerHTML = `<p class="muted">Running the AI model. The first run can take a while because the model has to load.</p>`;

    const result = await AI.classifyObservation(itemId, text);

    showAIResult(Inventory.getItemById(itemId), { ...result, observation: text });
    form.elements["text"].value = "";

    renderInsightsHistory();
  } catch (error) {
    resultBox.innerHTML = `<p class="form-error">${escapeHtml(error.message)}</p>`;
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
