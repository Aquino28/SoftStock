// dashboard.js 
// Purpose: All UI code (navigation, dashboard, inventory page, AI page)


import * as Inventory from "./inventory.js";

// SECTION 1: Small helpers (reused by the other pages later)

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

// SECTION 2: Navigation

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
    });
  });
}

// SECTION 3: Dashboard

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

// SECTION 4: Startup (main.js calls this once)

export function initUI() {
  initNavigation();
  renderDashboard();
}