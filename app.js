"use strict";

const MONTHS = [
  { key: "2026-11", label: "2026. november" },
  { key: "2026-12", label: "2026. december" },
  { key: "2027-01", label: "2027. január" },
  { key: "2027-02", label: "2027. február" },
  { key: "2027-03", label: "2027. március" },
  { key: "2027-04", label: "2027. április" },
  { key: "2027-05", label: "2027. május" },
  { key: "2027-06", label: "2027. június" },
  { key: "2027-07", label: "2027. július" },
  { key: "2027-08", label: "2027. augusztus" },
  { key: "2027-09", label: "2027. szeptember" },
  { key: "2027-10", label: "2027. október" },
];

const BASE_EXPENSES = [
  { name: "Spotify", amount: 2190, frequency: "Havi" },
  { name: "YouTube", amount: 5390, frequency: "Havi" },
  { name: "Disney+", amount: 2990, frequency: "Havi" },
  { name: "Netflix", amount: 4490, frequency: "Havi" },
  { name: "Crunchyroll", amount: 1890, frequency: "Havi" },
  { name: "Telekom", amount: 41569, frequency: "Havi" },
  { name: "Magyar Államkincstár Bíbor", amount: 21115, frequency: "Havi" },
  { name: "Magyar Államkincstár Julcsi", amount: 21115, frequency: "Havi" },
  { name: "Albérlet", amount: 300000, frequency: "Havi" },
  { name: "MVM Földgáz", amount: 6849, frequency: "Havi" },
  { name: "MVM Áram", amount: 14801, frequency: "Havi" },
  { name: "BKK Bérlet Eszti", amount: 9450, frequency: "Havi" },
  { name: "BKK Bérlet Norbi", amount: 9450, frequency: "Havi" },
  { name: "Humble Bundle", amount: 4990, frequency: "Havi" },
  { name: "Kifli előfizetés", amount: 2799, frequency: "Havi" },
  { name: "Apple Cloud+", amount: 399, frequency: "Havi" },
  { name: "One előfizetés (internet)", amount: 7490, frequency: "Havi" },
  { name: "MOHU", amount: 7845, frequency: "Kéthavi", everyOtherMonth: true },
  { name: "ÉDV (víz)", amount: 21665, frequency: "Kéthavi", everyOtherMonth: true },
];

const elements = {
  loginView: document.querySelector("#login-view"),
  appView: document.querySelector("#app-view"),
  accountArea: document.querySelector("#account-area"),
  loginForm: document.querySelector("#login-form"),
  loginEmail: document.querySelector("#login-email"),
  expenseForm: document.querySelector("#expense-form"),
  expenseName: document.querySelector("#expense-name"),
  expenseAmount: document.querySelector("#expense-amount"),
  expenseNote: document.querySelector("#expense-note"),
  monthSelect: document.querySelector("#month-select"),
  checklist: document.querySelector("#checklist"),
  emptyMonth: document.querySelector("#empty-month"),
  checklistTitle: document.querySelector("#checklist-title"),
  monthCount: document.querySelector("#month-count"),
  monthlyChart: document.querySelector("#monthly-chart"),
  status: document.querySelector("#status-message"),
};

const money = new Intl.NumberFormat("hu-HU", {
  maximumFractionDigits: 0,
});
let supabaseClient = null;
let expenses = [];
let currentUser = null;
let selectedMonth = MONTHS[0].key;
let statusTimer = null;

function formatMoney(value) {
  return `${money.format(Number(value) || 0)} Ft`;
}

function getMonth(key) {
  return MONTHS.find((month) => month.key === key);
}

function showStatus(message, type = "info") {
  window.clearTimeout(statusTimer);
  elements.status.textContent = message;
  elements.status.className = `status-message${type === "error" ? " is-error" : ""}${type === "success" ? " is-success" : ""}`;
  elements.status.hidden = false;
  statusTimer = window.setTimeout(() => {
    elements.status.hidden = true;
  }, type === "error" ? 10000 : 4500);
}

function errorMessage(error) {
  if (error?.message) return error.message;
  return "Ismeretlen hiba történt. Kérjük, próbáld újra.";
}

function setSignedOut() {
  currentUser = null;
  expenses = [];
  elements.appView.hidden = true;
  elements.loginView.hidden = false;
  elements.accountArea.replaceChildren();
}

function renderAccount(email) {
  const account = document.createElement("span");
  account.className = "account-email";
  account.textContent = email;

  const signOut = document.createElement("button");
  signOut.type = "button";
  signOut.className = "text-button";
  signOut.textContent = "Kilépés";
  signOut.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) showStatus(`Nem sikerült kilépni: ${errorMessage(error)}`, "error");
  });

  elements.accountArea.replaceChildren(account, signOut);
}

function makeSeedRows(userId) {
  const rows = [];
  MONTHS.forEach((month, monthIndex) => {
    BASE_EXPENSES.forEach((expense) => {
      if (expense.everyOtherMonth && monthIndex % 2 !== 0) return;
      rows.push({
        user_id: userId,
        month_key: month.key,
        month_label: month.label,
        name: expense.name,
        template_id: expense.name,
        frequency: expense.frequency,
        amount: expense.amount,
        due_date: null,
        paid: false,
        note: "",
        source: "excel",
      });
    });
  });
  return rows;
}

async function loadExpenses(userId) {
  let { data, error } = await supabaseClient
    .from("expenses")
    .select("id, user_id, month_key, month_label, name, frequency, amount, due_date, paid, note, source")
    .eq("user_id", userId)
    .order("month_key")
    .order("name");
  if (error) throw error;

  if (data.length === 0) {
    const { error: insertError } = await supabaseClient
      .from("expenses")
      .upsert(makeSeedRows(userId), {
        onConflict: "user_id,month_key,template_id",
        ignoreDuplicates: true,
      });
    if (insertError) throw insertError;

    ({ data, error } = await supabaseClient
      .from("expenses")
      .select("id, user_id, month_key, month_label, name, frequency, amount, due_date, paid, note, source")
      .eq("user_id", userId)
      .order("month_key")
      .order("name"));
    if (error) throw error;
  }

  expenses = data;
  renderDashboard();
}

async function activateSession(session) {
  if (!session?.user) {
    setSignedOut();
    return;
  }

  currentUser = session.user;
  elements.loginView.hidden = true;
  elements.appView.hidden = false;
  renderAccount(session.user.email || "Bejelentkezve");

  try {
    await loadExpenses(session.user.id);
  } catch (error) {
    showStatus(`Nem sikerült betölteni az adatokat: ${errorMessage(error)}`, "error");
  }
}

function summarize() {
  return MONTHS.map((month) => {
    const items = expenses.filter((expense) => expense.month_key === month.key);
    const planned = items.reduce((total, item) => total + Number(item.amount), 0);
    const paid = items.reduce(
      (total, item) => total + (item.paid ? Number(item.amount) : 0),
      0,
    );
    return {
      ...month,
      planned,
      paid,
      outstanding: planned - paid,
      count: items.length,
      paidCount: items.filter((item) => item.paid).length,
    };
  });
}

function renderChart(summary) {
  const maxAmount = Math.max(...summary.map((month) => month.planned), 1);
  const fragment = document.createDocumentFragment();

  summary.forEach((month) => {
    const column = document.createElement("div");
    column.className = "chart-month";
    column.title = `${month.label}: ${formatMoney(month.planned)} tervezett, ${formatMoney(month.paid)} kifizetve`;

    const bars = document.createElement("div");
    bars.className = "chart-bars";
    const planned = document.createElement("span");
    planned.className = "chart-bar";
    planned.style.height = `${Math.max((month.planned / maxAmount) * 100, 2)}%`;
    planned.setAttribute("aria-label", `Tervezett: ${formatMoney(month.planned)}`);

    const paid = document.createElement("span");
    paid.className = "chart-bar chart-bar-paid";
    paid.style.height = `${Math.max((month.paid / maxAmount) * 100, 0)}%`;
    paid.setAttribute("aria-label", `Kifizetve: ${formatMoney(month.paid)}`);
    bars.append(planned, paid);

    const label = document.createElement("span");
    label.className = "chart-month-label";
    label.textContent = month.label.replace(/^\d{4}\. /, "").slice(0, 3);
    column.append(bars, label);
    fragment.append(column);
  });

  elements.monthlyChart.replaceChildren(fragment);
}

function createExpenseRow(expense) {
  const row = document.createElement("article");
  row.className = `expense-row${expense.paid ? " is-paid" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "expense-check";
  checkbox.checked = Boolean(expense.paid);
  checkbox.setAttribute("aria-label", `${expense.name} kifizetve`);
  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;
    const nextPaid = checkbox.checked;
    const { error } = await supabaseClient
      .from("expenses")
      .update({ paid: nextPaid })
      .eq("id", expense.id)
      .eq("user_id", currentUser.id);
    checkbox.disabled = false;
    if (error) {
      checkbox.checked = !nextPaid;
      showStatus(`Nem sikerült menteni a fizetési állapotot: ${errorMessage(error)}`, "error");
      return;
    }
    expense.paid = nextPaid;
    renderDashboard();
  });

  const copy = document.createElement("div");
  copy.className = "expense-copy";
  const name = document.createElement("span");
  name.className = "expense-name";
  name.textContent = expense.name;
  const detail = document.createElement("span");
  detail.className = "expense-detail";
  detail.textContent = [
    expense.frequency,
    expense.due_date ? `Határidő: ${expense.due_date}` : "",
    expense.note || "",
  ].filter(Boolean).join(" · ");
  copy.append(name, detail);

  const amount = document.createElement("span");
  amount.className = "expense-amount";
  amount.textContent = formatMoney(expense.amount);
  row.append(checkbox, copy, amount);

  if (expense.source === "extra") {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${expense.name} plusz kiadás törlése`);
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      const { error } = await supabaseClient
        .from("expenses")
        .delete()
        .eq("id", expense.id)
        .eq("user_id", currentUser.id)
        .eq("source", "extra");
      if (error) {
        remove.disabled = false;
        showStatus(`Nem sikerült törölni a plusz kiadást: ${errorMessage(error)}`, "error");
        return;
      }
      expenses = expenses.filter((item) => item.id !== expense.id);
      renderDashboard();
      showStatus("A plusz kiadást töröltük.", "success");
    });
    row.append(remove);
  }

  return row;
}

function renderDashboard() {
  const summary = summarize();
  const annualPlanned = summary.reduce((total, month) => total + month.planned, 0);
  const annualPaid = summary.reduce((total, month) => total + month.paid, 0);
  const totalPaidCount = summary.reduce((total, month) => total + month.paidCount, 0);
  const totalCount = summary.reduce((total, month) => total + month.count, 0);
  const thisMonth = summary.find((month) => month.key === selectedMonth);

  document.querySelector("#annual-planned").textContent = formatMoney(annualPlanned);
  document.querySelector("#annual-paid").textContent = formatMoney(annualPaid);
  document.querySelector("#paid-count").textContent = `${totalPaidCount} / ${totalCount} tétel kifizetve`;
  document.querySelector("#month-planned").textContent = formatMoney(thisMonth.planned);
  document.querySelector("#month-outstanding").textContent = `Hátralék: ${formatMoney(thisMonth.outstanding)}`;
  elements.checklistTitle.textContent = `${thisMonth.label} checklistje`;
  elements.monthCount.textContent = `${thisMonth.count} tétel`;
  elements.monthSelect.value = selectedMonth;
  renderChart(summary);

  const monthExpenses = expenses.filter((expense) => expense.month_key === selectedMonth);
  const fragment = document.createDocumentFragment();
  monthExpenses.forEach((expense) => fragment.append(createExpenseRow(expense)));
  elements.checklist.replaceChildren(fragment);
  elements.emptyMonth.hidden = monthExpenses.length !== 0;
}

async function handleLogin(event) {
  event.preventDefault();
  const button = elements.loginForm.querySelector("button");
  button.disabled = true;
  button.textContent = "Belépő link küldése…";
  const email = elements.loginEmail.value.trim();

  try {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    });
    if (error) throw error;
    showStatus("Elküldtük a belépő linket. Nyisd meg az e-mailt ugyanazon az eszközön.", "success");
    elements.loginForm.reset();
  } catch (error) {
    showStatus(`Nem sikerült belépő linket küldeni: ${errorMessage(error)}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Belépő link küldése";
  }
}

async function handleAddExpense(event) {
  event.preventDefault();
  if (!currentUser) return;

  const button = elements.expenseForm.querySelector("button");
  button.disabled = true;
  const month = getMonth(selectedMonth);
  const newExpense = {
    user_id: currentUser.id,
    month_key: month.key,
    month_label: month.label,
    name: elements.expenseName.value.trim(),
    frequency: "Egyszeri",
    amount: Number(elements.expenseAmount.value),
    due_date: null,
    paid: false,
    note: elements.expenseNote.value.trim(),
    source: "extra",
  };

  try {
    const { data, error } = await supabaseClient
      .from("expenses")
      .insert(newExpense)
      .select("id, user_id, month_key, month_label, name, frequency, amount, due_date, paid, note, source")
      .single();
    if (error) throw error;
    expenses.push(data);
    elements.expenseForm.reset();
    renderDashboard();
    showStatus("A plusz kiadás bekerült a checklistbe.", "success");
  } catch (error) {
    showStatus(`Nem sikerült hozzáadni a kiadást: ${errorMessage(error)}`, "error");
  } finally {
    button.disabled = false;
  }
}

function initialize() {
  MONTHS.forEach((month) => {
    const option = document.createElement("option");
    option.value = month.key;
    option.textContent = month.label;
    elements.monthSelect.append(option);
  });

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (MONTHS.some((month) => month.key === currentMonth)) selectedMonth = currentMonth;
  elements.monthSelect.value = selectedMonth;
  elements.monthSelect.addEventListener("change", () => {
    selectedMonth = elements.monthSelect.value;
    renderDashboard();
  });
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.expenseForm.addEventListener("submit", handleAddExpense);

  const config = window.APP_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
    elements.loginView.hidden = false;
    showStatus(
      "A weboldal adatbázis-kapcsolata még nincs beállítva. Kövesd a README Supabase-beállítási lépéseit.",
      "error",
    );
    elements.loginForm.querySelector("button").disabled = true;
    return;
  }
  if (!window.supabase?.createClient) {
    elements.loginView.hidden = false;
    showStatus("Nem sikerült betölteni az adatbázis-kapcsolatot. Ellenőrizd az internetkapcsolatot.", "error");
    return;
  }

  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      if (session?.user?.id !== currentUser?.id) void activateSession(session);
    }, 0);
  });
  supabaseClient.auth.getSession()
    .then(({ data, error }) => {
      if (error) throw error;
      return activateSession(data.session);
    })
    .catch((error) => {
      showStatus(`Nem sikerült ellenőrizni a bejelentkezést: ${errorMessage(error)}`, "error");
      setSignedOut();
    });
}

initialize();
