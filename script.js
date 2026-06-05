const API_BASE = "https://work-bot-production-4b59.up.railway.app";
const tg = window.Telegram?.WebApp;
let currentData = null;
let currentAdminData = null;

function formatMoney(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("ru-RU").format(num) + " ₽";
}

function formatNumber(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("ru-RU").format(num);
}

function getTelegramUserId() {
  const params = new URLSearchParams(window.location.search);
  const urlId = params.get("tg_id");

  if (urlId && urlId !== "null" && urlId !== "None") {
    return String(urlId);
  }

  const user = tg?.initDataUnsafe?.user;
  return user?.id ? String(user.id) : null;
}

function showError(text) {
  document.getElementById("loading").className = "error";
  document.getElementById("loading").innerHTML = text;
}

async function loadData() {
  if (tg) {
    tg.expand();
    tg.setHeaderColor("#05060b");
    tg.setBackgroundColor("#05060b");
  }

  const telegramId = getTelegramUserId();

  if (!telegramId) {
    showError("Открой приложение через Telegram-бота.<br>Так бот поймёт, кто ты.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/user/${telegramId}`);
    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "Не удалось загрузить данные");
    }

    currentData = data;
    renderHome(data);

    document.getElementById("loading").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
  } catch (error) {
    showError("Не удалось загрузить данные.<br>Проверь Railway API.<br><br>" + error.message);
  }
}

function renderHome(data) {
  const name = data.employee || "Сотрудник";
  document.getElementById("hello").textContent = `Привет, ${name}! 👋`;
  document.getElementById("avatar").textContent = name[0]?.toUpperCase() || "A";
  document.getElementById("roleText").textContent = data.role === "admin" ? "Панель администратора" : "Рады видеть тебя снова";

  document.getElementById("salaryAfterFines").textContent = formatMoney(data.salary_after_fines);
  document.getElementById("salary").textContent = formatMoney(data.salary);
  document.getElementById("fines").textContent = formatMoney(data.fines_total);

  document.getElementById("hours").textContent = formatNumber(data.hours);
  document.getElementById("confirmedShifts").textContent = formatNumber(data.confirmed_shifts);
  document.getElementById("rate").textContent = formatMoney(data.rate);
  document.getElementById("notifyCount").textContent = data.upcoming_shifts_count || 0;

  if (data.next_shift) {
    document.getElementById("nextDate").textContent = data.next_shift.date;
    document.getElementById("nextTime").textContent = `🕘 ${data.next_shift.shift}`;
    document.getElementById("nextHours").textContent = `⏱ ${data.next_shift.hours} часов`;
    document.getElementById("nextStatus").textContent = data.next_shift.confirmed ? "✅ Подтверждена" : "⏳ Ожидает";
  } else {
    document.getElementById("nextDate").textContent = "Нет смен";
    document.getElementById("nextTime").textContent = "🕘 —";
    document.getElementById("nextHours").textContent = "⏱ 0 часов";
    document.getElementById("nextStatus").textContent = "—";
  }

  const actionsGrid = document.querySelector(".actions-grid");
  if (actionsGrid && data.role === "admin" && !document.getElementById("adminActionBtn")) {
    actionsGrid.insertAdjacentHTML(
      "afterbegin",
      `<button id="adminActionBtn" data-tab="admin">👑<span>Админ</span></button>`
    );
  }
}

async function loadAdminData() {
  const telegramId = getTelegramUserId();
  const response = await fetch(`${API_BASE}/api/admin/${telegramId}`);
  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || "Нет доступа к админ-панели");
  }

  return data;
}


async function apiPost(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Ошибка запроса");
  }

  return data;
}

function getAdminId() {
  return getTelegramUserId();
}

async function adminRemindEmployee(telegramId) {
  try {
    const adminId = getAdminId();
    const data = await apiPost("/api/admin/remind", {
      admin_id: adminId,
      telegram_id: telegramId
    });

    alert(`📣 ${data.message}\n${data.employee}\n${data.date} · ${data.shift}`);
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
}

async function adminFineEmployee(telegramId) {
  const amount = prompt("Введите сумму штрафа:");
  if (!amount) return;

  const reason = prompt("Введите причину штрафа:");
  if (!reason) return;

  try {
    const adminId = getAdminId();
    const data = await apiPost("/api/admin/fine", {
      admin_id: adminId,
      telegram_id: telegramId,
      amount: amount,
      reason: reason
    });

    alert(`💸 Штраф выписан\n${data.employee}\n${formatMoney(data.amount)}\n${data.reason}`);
    await renderEmployeeDetails(telegramId);
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
}

async function adminAddShiftEmployee(telegramId) {
  const date = prompt("Введите дату смены в формате ДД.ММ.ГГГГ:");
  if (!date) return;

  const shift = prompt("Введите время смены. Например: 8-22");
  if (!shift) return;

  const notify = confirm("Отправить уведомление сотруднику?");

  try {
    const adminId = getAdminId();
    const data = await apiPost("/api/admin/add_shift", {
      admin_id: adminId,
      telegram_id: telegramId,
      date: date,
      shift: shift,
      notify: notify
    });

    alert(`➕ Смена добавлена\n${data.employee}\n${data.date} · ${data.shift}\n${data.hours} ч.`);
    await renderEmployeeDetails(telegramId);
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
}

function itemHtml(title, value, muted = "") {
  return `
    <div class="item">
      <strong>${title}</strong>
      <div>${value}</div>
      ${muted ? `<div class="muted">${muted}</div>` : ""}
    </div>
  `;
}

function renderScheduleSection(data) {
  const box = document.getElementById("scheduleContent");
  if (!box) return;

  if (!data.upcoming_shifts?.length) {
    box.innerHTML = `<div class="item muted">Ближайших смен нет</div>`;
    return;
  }

  box.innerHTML = data.upcoming_shifts.map(s => `
    <div class="item">
      <strong>${s.date} · ${s.shift}</strong>
      <div class="muted">⏱ ${s.hours} ч. · ${s.confirmed ? "✅ Подтверждена" : "⏳ Ожидает"}</div>
    </div>
  `).join("");
}

function renderSalarySection(data) {
  const box = document.getElementById("salaryContent");
  if (!box) return;

  box.innerHTML = `
    ${itemHtml("✅ К выплате", formatMoney(data.salary_after_fines))}
    ${itemHtml("💰 Начислено", formatMoney(data.salary))}
    ${itemHtml("💵 Ставка", `${formatMoney(data.rate)} / час`)}
    ${itemHtml("⏱ Отработано", `${formatNumber(data.hours)} ч.`)}
    ${itemHtml("💸 Штрафы", formatMoney(data.fines_total))}
  `;
}

function renderFinesSection(data) {
  const box = document.getElementById("finesContent");
  if (!box) return;

  box.innerHTML = `
    ${itemHtml("💸 Всего штрафов", formatMoney(data.fines_total))}
    ${itemHtml("📄 Количество", formatNumber(data.fines_count))}
  `;
}

function renderStatsSection(data) {
  const box = document.getElementById("statsContent");
  if (!box) return;

  box.innerHTML = `
    ${itemHtml("✅ Подтверждённые смены", formatNumber(data.confirmed_shifts))}
    ${itemHtml("📅 Ближайшие смены", formatNumber(data.upcoming_shifts_count))}
    ${itemHtml("⏱ Часы", `${formatNumber(data.hours)} ч.`)}
    ${itemHtml("💵 Ставка", `${formatMoney(data.rate)} / час`)}
  `;
}

function renderProfileSection(data) {
  const box = document.getElementById("profileContent");
  if (!box) return;

  box.innerHTML = `
    ${itemHtml(`👤 ${data.employee}`, `ID: ${data.telegram_id}`)}
    ${itemHtml("Роль", data.role === "admin" ? "Администратор" : "Сотрудник")}
  `;
}

function renderAllSections(data) {
  renderScheduleSection(data);
  renderSalarySection(data);
  renderFinesSection(data);
  renderStatsSection(data);
  renderProfileSection(data);

  if (data.role === "admin") {
    setupAdminAccess();
  }
}

function setupAdminAccess() {
  const actionsGrid = document.getElementById("actionsGrid");
  const bottomNav = document.getElementById("bottomNav");
  const adminSection = document.getElementById("adminSection");

  if (adminSection) {
    adminSection.classList.remove("hidden");
  }

  if (actionsGrid && !document.getElementById("adminActionBtn")) {
    actionsGrid.insertAdjacentHTML(
      "afterbegin",
      `<button id="adminActionBtn" data-scroll="adminSection">👑<span>Админ</span></button>`
    );
  }

  if (bottomNav && !document.getElementById("adminNavBtn")) {
    bottomNav.insertAdjacentHTML(
      "beforeend",
      `<button id="adminNavBtn" data-scroll="adminSection">👑<span>Админ</span></button>`
    );
    bottomNav.classList.add("admin-nav");
  }

  renderAdminSection();
}

async function renderAdminSection() {
  const box = document.getElementById("adminContent");
  if (!box) return;

  box.innerHTML = `<div class="item muted">Загружаем админ-панель...</div>`;

  try {
    const adminData = await loadAdminData();
    currentAdminData = adminData;
    box.innerHTML = renderAdminPanel(adminData);
  } catch (error) {
    box.innerHTML = `<div class="item muted">Ошибка: ${error.message}</div>`;
  }
}

function renderHome(data) {
  const name = data.employee || "Сотрудник";
  document.getElementById("hello").textContent = `Привет, ${name}! 👋`;
  document.getElementById("avatar").textContent = name[0]?.toUpperCase() || "A";
  document.getElementById("roleText").textContent = data.role === "admin" ? "Панель администратора" : "Рады видеть тебя снова";

  document.getElementById("salaryAfterFines").textContent = formatMoney(data.salary_after_fines);
  document.getElementById("salary").textContent = formatMoney(data.salary);
  document.getElementById("fines").textContent = formatMoney(data.fines_total);

  document.getElementById("hours").textContent = formatNumber(data.hours);
  document.getElementById("confirmedShifts").textContent = formatNumber(data.confirmed_shifts);
  document.getElementById("rate").textContent = formatMoney(data.rate);
  document.getElementById("notifyCount").textContent = data.upcoming_shifts_count || 0;

  if (data.next_shift) {
    document.getElementById("nextDate").textContent = data.next_shift.date;
    document.getElementById("nextTime").textContent = `🕘 ${data.next_shift.shift}`;
    document.getElementById("nextHours").textContent = `⏱ ${data.next_shift.hours} часов`;
    document.getElementById("nextStatus").textContent = data.next_shift.confirmed ? "✅ Подтверждена" : "⏳ Ожидает";
  } else {
    document.getElementById("nextDate").textContent = "Нет смен";
    document.getElementById("nextTime").textContent = "🕘 —";
    document.getElementById("nextHours").textContent = "⏱ 0 часов";
    document.getElementById("nextStatus").textContent = "—";
  }

  renderAllSections(data);
}

function renderAdminPanel(adminData) {
  currentAdminData = adminData;

  const employeesHtml = (adminData.employees || []).map(emp => `
    <button class="item employee-card" data-employee-id="${emp.telegram_id}">
      <strong>👤 ${emp.employee}</strong>
      <span class="muted">ID: ${emp.telegram_id}</span>
      <div class="muted">⏱ ${formatNumber(emp.hours)} ч. · ✅ смен: ${emp.confirmed_shifts} · 📅 впереди: ${emp.upcoming_shifts_count}</div>
      <div>💰 ${formatMoney(emp.salary_after_fines)} · ставка ${formatMoney(emp.rate)}/час</div>
      <div class="muted">Нажми, чтобы открыть карточку сотрудника →</div>
    </button>
  `).join("");

  const finesHtml = (adminData.recent_fines || []).length
    ? adminData.recent_fines.map(f => `
      <div class="item">
        <strong>💸 ${f.employee} · ${formatMoney(f.amount)}</strong>
        <span class="muted">${f.created_at}</span>
        <div class="muted">${f.reason || "Без причины"}</div>
      </div>
    `).join("")
    : `<div class="item muted">Штрафов пока нет</div>`;

  const problemsHtml = (adminData.recent_problems || []).length
    ? adminData.recent_problems.map(p => `
      <div class="item">
        <strong>⚠️ ${p.employee} · ${p.shift_date} · ${p.shift}</strong>
        <span class="muted">${p.created_at}</span>
        <div class="muted">${p.problem || "Без описания"}</div>
      </div>
    `).join("")
    : `<div class="item muted">Проблемных смен пока нет</div>`;

  return `
    <div class="admin-summary">
      <div class="mini-stat"><span>👥</span><strong>${adminData.employees_count}</strong><small>сотрудников</small></div>
      <div class="mini-stat"><span>⏱</span><strong>${formatNumber(adminData.total_hours)}</strong><small>часов</small></div>
      <div class="mini-stat"><span>💰</span><strong>${formatMoney(adminData.total_after_fines)}</strong><small>к выплате</small></div>
    </div>

    <h3 class="panel-subtitle">👥 Сотрудники</h3>
    ${employeesHtml || `<div class="item muted">Сотрудников пока нет</div>`}

    <h3 class="panel-subtitle">💸 Последние штрафы</h3>
    ${finesHtml}

    <h3 class="panel-subtitle">⚠️ Проблемные смены</h3>
    ${problemsHtml}
  `;
}

async function renderEmployeeDetails(telegramId) {
  const adminBox = document.getElementById("adminContent");
  if (!adminBox) return;

  adminBox.innerHTML = `<div class="item muted">Загружаем карточку сотрудника...</div>`;
  scrollToSection("adminSection");

  try {
    const response = await fetch(`${API_BASE}/api/user/${telegramId}`);
    const emp = await response.json();

    if (!emp.ok) {
      throw new Error(emp.error || "Сотрудник не найден");
    }

    const shiftsHtml = (emp.upcoming_shifts || []).length
      ? emp.upcoming_shifts.map(s => `
        <div class="item">
          <strong>📅 ${s.date} · ${s.shift}</strong>
          <div class="muted">⏱ ${s.hours} ч. · ${s.confirmed ? "✅ Подтверждена" : "⏳ Ожидает"}</div>
        </div>
      `).join("")
      : `<div class="item muted">Ближайших смен нет</div>`;

    adminBox.innerHTML = `
      <button class="item" data-admin-back="true">
        <strong>⬅️ Назад к админ-панели</strong>
      </button>

      <div class="item employee-head">
        <strong>👤 ${emp.employee}</strong>
        <span class="muted">ID: ${emp.telegram_id}</span>
        <div class="muted">${emp.role === "admin" ? "Администратор" : "Сотрудник"}</div>
      </div>

      <h3 class="panel-subtitle">⚡ Быстрые действия</h3>
      <button class="item action-item" data-admin-action="remind" data-action-employee-id="${emp.telegram_id}">
        <strong>📣 Напомнить о ближайшей смене</strong>
        <span class="muted">Отправит сотруднику уведомление в Telegram</span>
      </button>
      <button class="item action-item" data-admin-action="fine" data-action-employee-id="${emp.telegram_id}">
        <strong>💸 Выписать штраф</strong>
        <span class="muted">Запишет штраф в таблицу fines</span>
      </button>
      <button class="item action-item" data-admin-action="add_shift" data-action-employee-id="${emp.telegram_id}">
        <strong>➕ Добавить смену</strong>
        <span class="muted">Добавит смену в schedule</span>
      </button>

      <h3 class="panel-subtitle">📊 Статистика</h3>
      ${itemHtml("⏱ Часы", `${formatNumber(emp.hours)} ч.`)}
      ${itemHtml("✅ Подтверждённые смены", formatNumber(emp.confirmed_shifts))}
      ${itemHtml("📅 Ближайшие смены", formatNumber(emp.upcoming_shifts_count))}
      ${itemHtml("💵 Ставка", `${formatMoney(emp.rate)} / час`)}
      ${itemHtml("💰 Начислено", formatMoney(emp.salary))}
      ${itemHtml("💸 Штрафы", formatMoney(emp.fines_total))}
      ${itemHtml("✅ К выплате", formatMoney(emp.salary_after_fines))}

      <h3 class="panel-subtitle">📅 Ближайшие смены</h3>
      ${shiftsHtml}
    `;
  } catch (error) {
    adminBox.innerHTML = `
      <button class="item" data-admin-back="true">
        <strong>⬅️ Назад к админ-панели</strong>
      </button>
      <div class="item muted">Ошибка: ${error.message}</div>
    `;
  }
}

function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  section.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));
  const navBtn = document.querySelector(`.bottom-nav button[data-scroll="${sectionId}"]`);
  if (navBtn) navBtn.classList.add("active");
}

function updateActiveNavOnScroll() {
  const sections = [
    "homeSection",
    "scheduleSection",
    "salarySection",
    "finesSection",
    "profileSection",
    "adminSection"
  ];

  let current = "homeSection";

  sections.forEach(id => {
    const section = document.getElementById(id);
    if (!section || section.classList.contains("hidden")) return;

    const rect = section.getBoundingClientRect();
    if (rect.top <= 160) current = id;
  });

  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));
  const navBtn = document.querySelector(`.bottom-nav button[data-scroll="${current}"]`);
  if (navBtn) navBtn.classList.add("active");
}

document.addEventListener("click", async (event) => {
  const scrollBtn = event.target.closest("[data-scroll]");
  if (scrollBtn) {
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
    scrollToSection(scrollBtn.dataset.scroll);
    return;
  }

  const adminBack = event.target.closest("[data-admin-back]");
  if (adminBack) {
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
    await renderAdminSection();
    scrollToSection("adminSection");
    return;
  }

  const adminActionBtn = event.target.closest("[data-admin-action]");
  if (adminActionBtn) {
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");

    const action = adminActionBtn.dataset.adminAction;
    const telegramId = adminActionBtn.dataset.actionEmployeeId;

    if (action === "remind") await adminRemindEmployee(telegramId);
    if (action === "fine") await adminFineEmployee(telegramId);
    if (action === "add_shift") await adminAddShiftEmployee(telegramId);

    return;
  }

  const employeeCard = event.target.closest("[data-employee-id]");
  if (employeeCard) {
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
    renderEmployeeDetails(employeeCard.dataset.employeeId);
    return;
  }
});

window.addEventListener("scroll", updateActiveNavOnScroll, { passive: true });

loadData();
