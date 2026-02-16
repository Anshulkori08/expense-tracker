// Backend and frontend are on the same origin (http://localhost:4000)
const API_BASE_URL = "";
const PENDING_KEY = "expense-tracker-pending";

const form = document.getElementById("expense-form");
const submitBtn = document.getElementById("submit-btn");
const formStatus = document.getElementById("form-status");

const listStatus = document.getElementById("list-status");
const tbody = document.getElementById("expenses-body");
const totalCell = document.getElementById("total-amount");
const filterSelect = document.getElementById("filter-category");
const sortNewestCheckbox = document.getElementById("sort-newest");

let isSubmitting = false;

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("date").value = today;

  attachEventHandlers();
  resumePendingExpense();
  loadExpenses();
});

function attachEventHandlers() {
  form.addEventListener("submit", handleSubmit);
  filterSelect.addEventListener("change", loadWithCurrentFilters);
  sortNewestCheckbox.addEventListener("change", loadWithCurrentFilters);
}

// ---- Form submit & retry support ----

function handleSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return;

  const payload = {
    amount: document.getElementById("amount").value,
    category: document.getElementById("category").value.trim(),
    description: document.getElementById("description").value.trim(),
    date: document.getElementById("date").value
  };

  if (!payload.amount || !payload.category || !payload.date) {
    formStatus.textContent = "Amount, category and date are required.";
    return;
  }

  const existingDraft = getPendingExpense();
  let idempotencyKey;

  if (existingDraft && samePayload(existingDraft.payload, payload)) {
    idempotencyKey = existingDraft.idempotencyKey;
  } else {
    idempotencyKey = crypto.randomUUID();
    savePendingExpense({ payload, idempotencyKey });
  }

  submitExpense(payload);
}

function submitExpense(payload) {
  isSubmitting = true;
  submitBtn.disabled = true;
  formStatus.textContent = "Saving…";

  fetch(`${API_BASE_URL}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = body.error || `Request failed (${res.status})`;
        throw new Error(message);
      }
      return body;
    })
    .then(() => {
      clearPendingExpense();
      form.reset();
      document.getElementById("date").value = new Date()
        .toISOString()
        .slice(0, 10);
      formStatus.textContent = "Saved.";
      setTimeout(() => {
        formStatus.textContent = "";
      }, 2000);
      loadWithCurrentFilters();
    })
    .catch((err) => {
      console.error(err);
      formStatus.textContent =
        "Failed to save expense. You can retry; duplicates are avoided.";
    })
    .finally(() => {
      isSubmitting = false;
      submitBtn.disabled = false;
    });
}

function resumePendingExpense() {
  const draft = getPendingExpense();
  if (!draft) return;

  formStatus.textContent = "Finishing a previous submission…";
  const { payload } = draft;

  document.getElementById("amount").value = payload.amount;
  document.getElementById("category").value = payload.category;
  document.getElementById("description").value = payload.description;
  document.getElementById("date").value = payload.date;

  submitExpense(payload);
}

function samePayload(a, b) {
  return (
    a.amount === b.amount &&
    a.category === b.category &&
    a.description === b.description &&
    a.date === b.date
  );
}

function getPendingExpense() {
  const raw = localStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.payload) return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePendingExpense(draft) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(draft));
}

function clearPendingExpense() {
  localStorage.removeItem(PENDING_KEY);
}

// ---- Loading / listing ----

function loadWithCurrentFilters() {
  loadExpenses({
    category: filterSelect.value || "",
    newestFirst: sortNewestCheckbox.checked
  });
}

function loadExpenses(options = {}) {
  const category =
    options.category !== undefined ? options.category : filterSelect.value;
  const newestFirst =
    options.newestFirst !== undefined
      ? options.newestFirst
      : sortNewestCheckbox.checked;

  const params = [];
  if (category) params.push(`category=${encodeURIComponent(category)}`);
  if (newestFirst) params.push("sort_date_desc=true");

  const url = "/expenses" + (params.length ? `?${params.join("&")}` : "");

  listStatus.textContent = "Loading…";

  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load expenses");
      return res.json();
    })
    .then((expenses) => {
      renderExpenses(expenses);
      updateCategoryFilter(expenses);
      updateHeroFromExpenses(expenses);
      listStatus.textContent = expenses.length ? "" : "No expenses yet.";
    })
    .catch((err) => {
      console.error(err);
      listStatus.textContent =
        "Could not load expenses from the server. Try again.";
    });
}

function renderExpenses(expenses) {
  tbody.innerHTML = "";
  let total = 0;

  expenses.forEach((exp) => {
    total += exp.amount;

    const tr = document.createElement("tr");

    const dateTd = document.createElement("td");
    dateTd.textContent = exp.date;
    tr.appendChild(dateTd);

    const catTd = document.createElement("td");
    catTd.textContent = exp.category;
    tr.appendChild(catTd);

    const descTd = document.createElement("td");
    descTd.textContent = exp.description || "-";
    tr.appendChild(descTd);

    const amtTd = document.createElement("td");
    amtTd.className = "amount-col";
    amtTd.textContent = exp.amount.toFixed(2);
    tr.appendChild(amtTd);

    tbody.appendChild(tr);
  });

  totalCell.textContent = total.toFixed(2);
}

function updateCategoryFilter(expenses) {
  const selected = filterSelect.value;
  const categories = new Set(expenses.map((e) => e.category));

  let optionsHtml = '<option value="">All</option>';
  categories.forEach((c) => {
    const safe = escapeHtml(c);
    optionsHtml += `<option value="${safe}">${safe}</option>`;
  });

  filterSelect.innerHTML = optionsHtml;
  if (categories.has(selected)) {
    filterSelect.value = selected;
  }
}

// ---- Hero card: live spending snapshot ----

function updateHeroFromExpenses(expenses) {
  const chipEl = document.getElementById("hero-chip-label");
  const labelEl = document.getElementById("hero-stats-label");
  const row1TitleEl = document.getElementById("hero-row1-title");
  const row1ValueEl = document.getElementById("hero-row1-value");
  const row2TitleEl = document.getElementById("hero-row2-title");
  const row2ValueEl = document.getElementById("hero-row2-value");
  const footerEl = document.getElementById("hero-footer-text");

  if (!chipEl || !row1TitleEl || !row1ValueEl) return;

  if (!expenses || expenses.length === 0) {
    chipEl.textContent = "Current view";
    if (labelEl) labelEl.textContent = "Spending snapshot";
    row1TitleEl.textContent = "No expenses yet";
    row1ValueEl.textContent = "₹ 0.00";
    row2TitleEl.textContent = "—";
    row2ValueEl.textContent = "—";
    if (footerEl) {
      footerEl.textContent = "Add an expense to see live spending here →";
    }
    return;
  }

  const totalsByCategory = new Map();
  let grandTotal = 0;

  for (const exp of expenses) {
    grandTotal += exp.amount;
    const current = totalsByCategory.get(exp.category) || 0;
    totalsByCategory.set(exp.category, current + exp.amount);
  }

  const sorted = Array.from(totalsByCategory.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  const [cat1, total1] = sorted[0] || [];
  const [cat2, total2] = sorted[1] || [];

  chipEl.textContent = "Current view";
  if (labelEl) labelEl.textContent = "Top categories";

  row1TitleEl.textContent = cat1 || "No expenses yet";
  row1ValueEl.textContent = `₹ ${total1 ? total1.toFixed(2) : "0.00"}`;

  if (cat2) {
    row2TitleEl.textContent = cat2;
    row2ValueEl.textContent = `₹ ${total2.toFixed(2)}`;
  } else {
    row2TitleEl.textContent = "—";
    row2ValueEl.textContent = "—";
  }

  if (footerEl) {
    footerEl.textContent = `Total in view: ₹ ${grandTotal.toFixed(
      2
    )} · based on the expenses listed below.`;
  }
}

// ---- Utility ----

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}