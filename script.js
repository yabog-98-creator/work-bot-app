const API_BASE = "https://work-bot-production-4b59.up.railway.app";
const tg = window.Telegram?.WebApp;
let currentData = null;
let currentAdminData = null;
let currentOwnerData = null;

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
    updateRoleVisibility();
    if (data.role === "owner") {
      try { await renderOwnerDashboard(); } catch (e) { console.warn(e); }
    }
    startShiftTimer();

    document.getElementById("loading").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
  } catch (error) {
    showError("Не удалось загрузить данные.<br>Проверь Railway API.<br><br>" + error.message);
  }
}


function setUserAvatar(name) {
  const avatar = document.getElementById("avatar");
  if (!avatar) return;

  const photoUrl = tg?.initDataUnsafe?.user?.photo_url;

  if (photoUrl) {
    avatar.innerHTML = `<img src="${photoUrl}" alt="avatar">`;
    avatar.classList.add("has-photo");
  } else {
    avatar.textContent = name[0]?.toUpperCase() || "A";
    avatar.classList.remove("has-photo");
  }
}

function renderHome(data) {
  const name = data.employee || "Сотрудник";
  document.getElementById("hello").textContent = `Привет, ${name}! 👋`;
  setUserAvatar(name);
  document.getElementById("roleText").textContent =
    data.role === "owner" ? "Панель собственника" :
    (data.role === "admin" ? "Панель администратора" : "Рады видеть тебя снова");

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

  if (actionsGrid && data.role === "owner" && !document.getElementById("ownerActionBtn")) {
    actionsGrid.insertAdjacentHTML(
      "afterbegin",
      `<button id="ownerActionBtn" data-scroll="ownerSection">🏢<span>Бизнес</span></button>`
    );
  }

  if (actionsGrid && (data.role === "admin" || data.role === "owner") && !document.getElementById("adminActionBtn")) {
    actionsGrid.insertAdjacentHTML(
      "afterbegin",
      `<button id="adminActionBtn" data-scroll="adminSection">👑<span>Админ</span></button>`
    );
  }
}


function updateRoleVisibility() {
  const isOwner = currentData && currentData.role === "owner";
  const hasAdmin = currentData && (currentData.role === "admin" || currentData.role === "owner");

  document.querySelectorAll(".owner-nav").forEach(el => {
    el.classList.toggle("hidden", !isOwner);
  });

  const ownerSection = document.getElementById("ownerSection");
  if (ownerSection) {
    ownerSection.classList.toggle("hidden", !isOwner);
  }

  const adminSection = document.getElementById("adminSection");
  if (adminSection) {
    adminSection.classList.toggle("hidden", !hasAdmin);
  }

  const bottomNav = document.getElementById("bottomNav");
  if (bottomNav && isOwner) {
    bottomNav.classList.add("owner-mode");
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




async function loadOwnerData() {
  const telegramId = getTelegramUserId();
  const response = await fetch(`${API_BASE}/api/owner/${telegramId}`);
  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || "Нет доступа к бизнес-панели");
  }

  currentOwnerData = data;
  return data;
}

function hasOwnerAccess() {
  return currentData && (currentData.role === "owner" || currentData.role === "admin");
}

function isOwnerRole() {
  return currentData && currentData.role === "owner";
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


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeShiftText(value) {
  return String(value || "—").replace(/[–—]/g, "-").replace("-", " — ");
}

function getShiftDayLabel(dateText) {
  const date = parseShiftDate(dateText);
  if (!date) return "Смена";
  const days = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
  const months = ["ЯНВАРЯ", "ФЕВРАЛЯ", "МАРТА", "АПРЕЛЯ", "МАЯ", "ИЮНЯ", "ИЮЛЯ", "АВГУСТА", "СЕНТЯБРЯ", "ОКТЯБРЯ", "НОЯБРЯ", "ДЕКАБРЯ"];
  return `${days[date.getDay()]} • ${pad2(date.getDate())} ${months[date.getMonth()]}`;
}

function getCurrentShiftForDashboard(data) {
  const relevant = findRelevantShift(data);
  return relevant?.type === "current" ? relevant.item : null;
}

function getDashboardGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}

function metricCard(icon, label, value, tone = "") {
  return `
    <div class="v27-metric ${tone}">
      <div class="v27-metric-icon">${icon}</div>
      <div class="v27-metric-label">${label}</div>
      <div class="v27-metric-value">${value}</div>
    </div>
  `;
}

function renderShiftCardV27(s, index = 0) {
  const confirmed = !!s.confirmed;
  const statusClass = confirmed ? "confirmed" : "waiting";
  const statusText = confirmed ? "Подтверждена" : "Ожидает";
  const dayLabel = getShiftDayLabel(s.date);
  const isFirst = index === 0;

  return `
    <div class="v27-shift-card ${statusClass} ${isFirst ? "featured" : ""}">
      <div class="v27-shift-top">
        <div>
          <div class="v27-kicker">${isFirst ? "Ближайшая смена" : dayLabel}</div>
          <div class="v27-shift-date">${escapeHtml(s.date)}</div>
        </div>
        <div class="v27-status ${statusClass}">${confirmed ? "✅" : "⏳"} ${statusText}</div>
      </div>

      <div class="v27-shift-time">${escapeHtml(normalizeShiftText(s.shift))}</div>

      <div class="v27-shift-bottom">
        <span>⏱ ${formatNumber(s.hours)} ч.</span>
        <span>${dayLabel}</span>
      </div>

      <div class="v27-line-progress">
        <div style="width:${confirmed ? "100" : "18"}%"></div>
      </div>
    </div>
  `;
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

  const shifts = Array.isArray(data.upcoming_shifts) ? data.upcoming_shifts : [];

  if (!shifts.length) {
    box.innerHTML = `
      <div class="v27-empty-card">
        <div class="v27-empty-icon">📅</div>
        <h3>Смен пока нет</h3>
        <p>Как только администратор назначит смену, она появится здесь.</p>
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="v27-section-toolbar">
      <button class="active">Предстоящие</button>
      <button>Подтверждения</button>
    </div>
    <div class="v27-shifts-list">
      ${shifts.map((s, index) => renderShiftCardV27(s, index)).join("")}
    </div>
  `;
}

function renderSalarySection(data) {
  const box = document.getElementById("salaryContent");
  if (!box) return;

  const salary = Number(data.salary || 0);
  const fines = Number(data.fines_total || 0);
  const after = Number(data.salary_after_fines || 0);
  const percent = salary > 0 ? Math.max(0, Math.min(100, Math.round((after / salary) * 100))) : 0;

  box.innerHTML = `
    <div class="v27-finance-hero">
      <div>
        <div class="v27-kicker">К выплате</div>
        <div class="v27-big-money">${formatMoney(after)}</div>
      </div>
      <div class="v27-wallet-icon">💳</div>
      <div class="v27-money-progress"><div style="width:${percent}%"></div></div>
      <div class="v27-money-row">
        <span>После штрафов</span>
        <strong>${percent}%</strong>
      </div>
    </div>

    <div class="v27-finance-grid">
      ${metricCard("💼", "Начислено", formatMoney(salary), "green")}
      ${metricCard("🛡️", "Штрафы", formatMoney(fines), "red")}
      ${metricCard("💵", "Ставка", `${formatMoney(data.rate)} / ч`, "purple")}
      ${metricCard("⏱", "Отработано", `${formatNumber(data.hours)} ч.`, "blue")}
    </div>
  `;
}

function renderFinesSection(data) {
  const box = document.getElementById("finesContent");
  if (!box) return;

  const finesTotal = Number(data.fines_total || 0);
  const finesCount = Number(data.fines_count || 0);

  if (!finesTotal && !finesCount) {
    box.innerHTML = `
      <div class="v27-success-card">
        <div class="v27-success-orb">✅</div>
        <h3>Отлично!</h3>
        <p>У вас нет штрафов. Продолжайте в том же духе 💪</p>
        <div class="v27-good-pill">Без нарушений</div>
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="v27-fines-summary">
      <div>
        <div class="v27-kicker">Всего штрафов</div>
        <div class="v27-fine-money">${formatMoney(finesTotal)}</div>
      </div>
      <div class="v27-fine-count">${formatNumber(finesCount)} записей</div>
    </div>
    <div class="v27-info-card">
      <strong>История штрафов</strong>
      <p>Подробные штрафы хранятся в таблице. Здесь показана общая сумма по сотруднику.</p>
    </div>
  `;
}

function renderStatsSection(data) {
  const box = document.getElementById("statsContent");
  if (!box) return;

  box.innerHTML = `
    <div class="v27-finance-grid">
      ${metricCard("✅", "Подтверждённые смены", formatNumber(data.confirmed_shifts), "green")}
      ${metricCard("📅", "Ближайшие смены", formatNumber(data.upcoming_shifts_count), "purple")}
      ${metricCard("⏱", "Часы", `${formatNumber(data.hours)} ч.`, "blue")}
      ${metricCard("💵", "Ставка", `${formatMoney(data.rate)} / ч`, "gold")}
    </div>
  `;
}

function renderProfileSection(data) {
  const box = document.getElementById("profileContent");
  if (!box) return;

  const name = data.employee || "Сотрудник";
  const role = data.role === "owner" ? "Собственник" : (data.role === "admin" ? "Администратор" : "Сотрудник");
  const initial = name[0]?.toUpperCase() || "A";

  box.innerHTML = `
    <div class="v27-profile-hero">
      <div class="v27-profile-avatar">${escapeHtml(initial)}</div>
      <h3>${escapeHtml(name)}</h3>
      <div class="v27-role-pill">⭐ ${role}</div>
      <div class="v27-profile-id">Telegram ID: ${escapeHtml(data.telegram_id)}</div>
    </div>

    <div class="v27-profile-grid">
      ${metricCard("📅", "Смены", formatNumber(data.confirmed_shifts), "purple")}
      ${metricCard("⏱", "Часы", formatNumber(data.hours), "blue")}
      ${metricCard("💰", "Доход", formatMoney(data.salary_after_fines), "green")}
      ${metricCard("💵", "Ставка", `${formatMoney(data.rate)} / ч`, "gold")}
    </div>
  `;
}


function renderOwnerShiftLine(shift) {
  const confirmed = !!shift.confirmed;
  const status = confirmed ? "✅" : "⏳";
  const statusText = confirmed ? "Подтверждена" : "Ожидает";
  const tone = confirmed ? "confirmed" : "waiting";

  return `
    <div class="v28-owner-shift ${tone}">
      <div class="v28-owner-shift-left">
        <div class="v28-owner-status">${status}</div>
        <div>
          <strong>${escapeHtml(shift.employee || "Сотрудник")}</strong>
          <span>${escapeHtml(shift.shift || "—")} · ${formatNumber(shift.hours || 0)} ч.</span>
        </div>
      </div>
      <div class="v28-owner-pill ${tone}">${statusText}</div>
    </div>
  `;
}

function renderOwnerContent(data) {
  const box = document.getElementById("ownerContent");
  if (!box) return;

  const shifts = Array.isArray(data.tomorrow_shifts) ? data.tomorrow_shifts : [];
  const confirmed = shifts.filter(s => s.confirmed);
  const waiting = shifts.filter(s => !s.confirmed);

  box.innerHTML = `
    <div class="v28-owner-hero">
      <div class="v27-kicker">ZDRASTE WORK · BUSINESS</div>
      <h3>Завтра под контролем</h3>
      <p>${escapeHtml(data.date || "—")} · ${formatNumber(data.confirmed_count)} из ${formatNumber(data.tomorrow_shifts_count)} подтвердили</p>

      <div class="v28-owner-progress">
        <div style="width:${Number(data.confirm_percent || 0)}%"></div>
      </div>

      <div class="v28-owner-progress-row">
        <span>Подтверждение</span>
        <strong>${formatNumber(data.confirm_percent)}%</strong>
      </div>
    </div>

    <div class="v27-admin-grid">
      ${metricCard("👥", "Сотрудников", formatNumber(data.employees_count), "purple")}
      ${metricCard("📅", "Смен завтра", formatNumber(data.tomorrow_shifts_count), "blue")}
      ${metricCard("✅", "Подтвердили", formatNumber(data.confirmed_count), "green")}
      ${metricCard("⏳", "Ожидают", formatNumber(data.waiting_count), "gold")}
    </div>

    <div class="v28-owner-money">
      <div>
        <div class="v27-kicker">Фонд оплаты завтра</div>
        <div class="v28-owner-money-value">${formatMoney(data.payroll_estimate)}</div>
      </div>
      <div class="v28-owner-money-icon">💼</div>
      <div class="v28-owner-money-meta">
        <span>Всего часов</span>
        <strong>${formatNumber(data.total_hours)} ч.</strong>
      </div>
    </div>

    <div class="v28-owner-actions">
      <button data-scroll="adminSection">👑<span>Админка</span></button>
      <button data-owner-refresh="true">🔄<span>Обновить</span></button>
    </div>

    <h3 class="panel-subtitle">✅ Подтвердили</h3>
    <div class="v28-owner-list">
      ${confirmed.length ? confirmed.map(renderOwnerShiftLine).join("") : `<div class="v27-info-card"><strong>Пока никто не подтвердил</strong><p>После подтверждения сотрудники появятся здесь.</p></div>`}
    </div>

    <h3 class="panel-subtitle">⏳ Ожидают подтверждения</h3>
    <div class="v28-owner-list">
      ${waiting.length ? waiting.map(renderOwnerShiftLine).join("") : `<div class="v27-info-card"><strong>Все подтвердили</strong><p>Отлично, завтрашний день закрыт.</p></div>`}
    </div>
  `;
}

async function renderOwnerDashboard() {
  const data = await loadOwnerData();
  renderOwnerContent(data);
}

function renderAllSections(data) {
  renderScheduleSection(data);
  renderSalarySection(data);
  renderFinesSection(data);
  renderStatsSection(data);
  renderProfileSection(data);
  if (data.role === "owner") {
    renderOwnerDashboard().catch(console.warn);
  }

  if (data.role === "admin" || data.role === "owner") {
    setupAdminAccess();
  }
}

function setupAdminAccess() {
  const actionsGrid = document.getElementById("actionsGrid");
  const bottomNav = document.getElementById("bottomNav");
  const adminSection = document.getElementById("adminSection");
  const ownerSection = document.getElementById("ownerSection");

  if (adminSection) {
    adminSection.classList.remove("hidden");
  }

  if (ownerSection && currentData?.role === "owner") {
    ownerSection.classList.remove("hidden");
  }

  if (actionsGrid && currentData?.role === "owner" && !document.getElementById("ownerActionBtn")) {
    actionsGrid.insertAdjacentHTML(
      "afterbegin",
      `<button id="ownerActionBtn" data-scroll="ownerSection">🏢<span>Бизнес</span></button>`
    );
  }

  if (actionsGrid && !document.getElementById("adminActionBtn")) {
    actionsGrid.insertAdjacentHTML(
      "afterbegin",
      `<button id="adminActionBtn" data-scroll="adminSection">👑<span>Админ</span></button>`
    );
  }

  if (bottomNav && currentData?.role === "owner" && !document.getElementById("ownerNavBtn")) {
    bottomNav.insertAdjacentHTML(
      "beforeend",
      `<button id="ownerNavBtn" data-scroll="ownerSection">🏢<span>Бизнес</span></button>`
    );
    bottomNav.classList.add("owner-nav");
  }

  if (bottomNav && !document.getElementById("adminNavBtn")) {
    bottomNav.insertAdjacentHTML(
      "beforeend",
      `<button id="adminNavBtn" data-scroll="adminSection">👑<span>Админ</span></button>`
    );
    bottomNav.classList.add("admin-nav");
  }

  if (currentData?.role === "owner") {
    renderOwnerSection();
  }

  renderAdminSection();
}



function renderOwnerPanel(ownerData) {
  const shifts = ownerData.tomorrow_shifts || [];
  const confirmed = shifts.filter(s => s.confirmed);
  const waiting = shifts.filter(s => !s.confirmed);

  const confirmedHtml = confirmed.length
    ? confirmed.map(s => `
      <div class="owner-shift-row confirmed">
        <div>
          <strong>✅ ${escapeHtml(s.employee)}</strong>
          <span>${escapeHtml(s.shift)} · ${formatNumber(s.hours)} ч.</span>
        </div>
        <b>${formatMoney(s.estimated_pay)}</b>
      </div>
    `).join("")
    : `<div class="owner-empty-line">Пока никто не подтвердил смену</div>`;

  const waitingHtml = waiting.length
    ? waiting.map(s => `
      <div class="owner-shift-row waiting">
        <div>
          <strong>⏳ ${escapeHtml(s.employee)}</strong>
          <span>${escapeHtml(s.shift)} · ожидает подтверждения</span>
        </div>
        <b>${formatMoney(s.estimated_pay)}</b>
      </div>
    `).join("")
    : `<div class="owner-empty-line">Все смены подтверждены</div>`;

  return `
    <div class="owner-hero">
      <div class="owner-hero-top">
        <div>
          <div class="v27-kicker">ZDRASTE WORK</div>
          <h3>Бизнес-панель</h3>
          <p>Сводка на завтра · ${escapeHtml(ownerData.date)}</p>
        </div>
        <div class="owner-crown">🏢</div>
      </div>

      <div class="owner-progress-title">
        <span>Подтверждение смен</span>
        <strong>${formatNumber(ownerData.confirm_percent)}%</strong>
      </div>
      <div class="owner-progress">
        <div style="width:${ownerData.confirm_percent}%"></div>
      </div>
      <div class="owner-progress-foot">
        ${formatNumber(ownerData.confirmed_count)} из ${formatNumber(ownerData.tomorrow_shifts_count)} подтвердили
      </div>
    </div>

    <div class="owner-kpi-grid">
      ${metricCard("👥", "Сотрудников", formatNumber(ownerData.employees_count), "purple")}
      ${metricCard("📅", "Смен завтра", formatNumber(ownerData.tomorrow_shifts_count), "blue")}
      ${metricCard("✅", "Подтвердили", formatNumber(ownerData.confirmed_count), "green")}
      ${metricCard("⏳", "Ожидают", formatNumber(ownerData.waiting_count), "gold")}
    </div>

    <div class="owner-money-card">
      <div>
        <div class="v27-kicker">Примерный фонд оплаты завтра</div>
        <strong>${formatMoney(ownerData.payroll_estimate)}</strong>
        <span>Всего часов: ${formatNumber(ownerData.total_hours)} ч.</span>
      </div>
      <div>💰</div>
    </div>

    <h3 class="panel-subtitle">✅ Подтвердили</h3>
    <div class="owner-list">${confirmedHtml}</div>

    <h3 class="panel-subtitle">⏳ Не подтвердили</h3>
    <div class="owner-list">${waitingHtml}</div>

    <button class="owner-admin-btn" data-scroll="adminSection">
      👑 Перейти в админ-панель
    </button>
  `;
}

async function renderOwnerSection() {
  const box = document.getElementById("ownerContent");
  if (!box) return;

  box.innerHTML = `<div class="v27-info-card">Загружаем бизнес-панель...</div>`;

  try {
    const ownerData = await loadOwnerData();
    box.innerHTML = renderOwnerPanel(ownerData);
  } catch (error) {
    box.innerHTML = `<div class="v27-info-card">Ошибка: ${escapeHtml(error.message)}</div>`;
  }
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
  setUserAvatar(name);
  document.getElementById("roleText").textContent =
    data.role === "owner" ? "Панель собственника" :
    (data.role === "admin" ? "Панель администратора" : "Рады видеть тебя снова");

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
    <button class="v27-employee-card" data-employee-id="${emp.telegram_id}">
      <div class="v27-employee-avatar">${escapeHtml((emp.employee || "С")[0])}</div>
      <div class="v27-employee-info">
        <strong>${escapeHtml(emp.employee)}</strong>
        <span>ID: ${escapeHtml(emp.telegram_id)}</span>
        <div class="v27-employee-line">
          <b>⏱ ${formatNumber(emp.hours)} ч.</b>
          <b>✅ ${formatNumber(emp.confirmed_shifts)}</b>
          <b>📅 ${formatNumber(emp.upcoming_shifts_count)}</b>
        </div>
      </div>
      <div class="v27-employee-money">${formatMoney(emp.salary_after_fines)}</div>
    </button>
  `).join("");

  const finesHtml = (adminData.recent_fines || []).length
    ? adminData.recent_fines.map(f => `
      <div class="v27-admin-log red">
        <strong>💸 ${escapeHtml(f.employee)} · ${formatMoney(f.amount)}</strong>
        <span>${escapeHtml(f.created_at)}</span>
        <p>${escapeHtml(f.reason || "Без причины")}</p>
      </div>
    `).join("")
    : `<div class="v27-info-card"><strong>Штрафов пока нет</strong><p>Последние штрафы появятся здесь.</p></div>`;

  const problemsHtml = (adminData.recent_problems || []).length
    ? adminData.recent_problems.map(p => `
      <div class="v27-admin-log warn">
        <strong>⚠️ ${escapeHtml(p.employee)} · ${escapeHtml(p.shift_date)} · ${escapeHtml(p.shift)}</strong>
        <span>${escapeHtml(p.created_at)}</span>
        <p>${escapeHtml(p.problem || "Без описания")}</p>
      </div>
    `).join("")
    : `<div class="v27-info-card"><strong>Проблемных смен пока нет</strong><p>Заявки сотрудников появятся здесь.</p></div>`;

  return `
    <div class="v27-admin-grid">
      ${metricCard("👥", "Сотрудников", formatNumber(adminData.employees_count), "purple")}
      ${metricCard("⏱", "Часов", formatNumber(adminData.total_hours), "blue")}
      ${metricCard("💰", "К выплате", formatMoney(adminData.total_after_fines), "green")}
      ${metricCard("👑", "Админ", "CRM", "gold")}
    </div>

    <h3 class="panel-subtitle">👥 Сотрудники</h3>
    <div class="v27-employee-list">
      ${employeesHtml || `<div class="v27-info-card"><strong>Сотрудников пока нет</strong></div>`}
    </div>

    <h3 class="panel-subtitle">💸 Последние штрафы</h3>
    ${finesHtml}

    <h3 class="panel-subtitle">⚠️ Проблемные смены</h3>
    ${problemsHtml}
  `;
}

async function renderEmployeeDetails(telegramId) {
  const adminBox = document.getElementById("adminContent");
  if (!adminBox) return;

  adminBox.innerHTML = `<div class="v27-info-card">Загружаем карточку сотрудника...</div>`;
  scrollToSection("adminSection");

  try {
    const response = await fetch(`${API_BASE}/api/user/${telegramId}`);
    const emp = await response.json();

    if (!emp.ok) {
      throw new Error(emp.error || "Сотрудник не найден");
    }

    const name = emp.employee || "Сотрудник";
    const initial = name[0]?.toUpperCase() || "A";

    const shiftsHtml = (emp.upcoming_shifts || []).length
      ? emp.upcoming_shifts.map((s, index) => renderShiftCardV27(s, index)).join("")
      : `<div class="v27-info-card"><strong>Ближайших смен нет</strong></div>`;

    adminBox.innerHTML = `
      <button class="v27-back-btn" data-admin-back="true">⬅️ Назад к админ-панели</button>

      <div class="v27-profile-hero">
        <div class="v27-profile-avatar">${escapeHtml(initial)}</div>
        <h3>${escapeHtml(name)}</h3>
        <div class="v27-role-pill">${emp.role === "admin" ? "👑 Администратор" : "⭐ Сотрудник"}</div>
        <div class="v27-profile-id">ID: ${escapeHtml(emp.telegram_id)}</div>
      </div>

      <div class="v27-action-grid">
        <button data-admin-action="remind" data-action-employee-id="${emp.telegram_id}">📣<span>Напомнить</span></button>
        <button data-admin-action="fine" data-action-employee-id="${emp.telegram_id}">💸<span>Штраф</span></button>
        <button data-admin-action="add_shift" data-action-employee-id="${emp.telegram_id}">➕<span>Смена</span></button>
      </div>

      <div class="v27-finance-grid">
        ${metricCard("⏱", "Часы", `${formatNumber(emp.hours)} ч.`, "blue")}
        ${metricCard("✅", "Смены", formatNumber(emp.confirmed_shifts), "green")}
        ${metricCard("📅", "Впереди", formatNumber(emp.upcoming_shifts_count), "purple")}
        ${metricCard("💵", "Ставка", `${formatMoney(emp.rate)} / ч`, "gold")}
        ${metricCard("💰", "Начислено", formatMoney(emp.salary), "green")}
        ${metricCard("💸", "Штрафы", formatMoney(emp.fines_total), "red")}
        ${metricCard("✅", "К выплате", formatMoney(emp.salary_after_fines), "purple")}
      </div>

      <h3 class="panel-subtitle">📅 Ближайшие смены</h3>
      <div class="v27-shifts-list">${shiftsHtml}</div>
    `;
  } catch (error) {
    adminBox.innerHTML = `
      <button class="v27-back-btn" data-admin-back="true">⬅️ Назад к админ-панели</button>
      <div class="v27-info-card">Ошибка: ${escapeHtml(error.message)}</div>
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
    "ownerSection",
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



function findNextShiftAfterCurrent(data) {
  const shifts = Array.isArray(data?.upcoming_shifts) ? data.upcoming_shifts : [];
  const now = new Date();

  const parsed = shifts
    .map(shift => {
      const bounds = getShiftBounds(shift);
      return bounds ? { shift, ...bounds } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  return parsed.find(item => item.start > now) || null;
}

function updateNextShiftCountdownCard() {
  const card = document.getElementById("nextShiftCountdownCard");
  const value = document.getElementById("nextCountdownValue");
  const date = document.getElementById("nextCountdownDate");
  const shift = document.getElementById("nextCountdownShift");

  if (!card || !currentData) return;

  const next = findNextShiftAfterCurrent(currentData);

  if (!next) {
    card.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");

  value.textContent = formatDuration(next.start - new Date(), true);
  date.textContent = next.shift.date || "—";
  shift.textContent = next.shift.shift || "—";
}


// =========================
// V24 SHIFT LIVE TIMER
// =========================

let shiftTimerInterval = null;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function parseShiftDate(dateText) {
  if (!dateText) return null;
  const parts = String(dateText).trim().split(".");
  if (parts.length !== 3) return null;

  const day = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const year = Number(parts[2]);

  if (!day || month < 0 || !year) return null;
  return new Date(year, month, day, 0, 0, 0, 0);
}

function parseShiftTime(shiftText) {
  if (!shiftText) return null;

  const clean = String(shiftText)
    .replace(/[–—]/g, "-")
    .replace(/\s/g, "");

  const parts = clean.split("-");
  if (parts.length !== 2) return null;

  function parsePart(part) {
    const pieces = part.split(":");
    const hour = Number(pieces[0]);
    const minute = pieces.length > 1 ? Number(pieces[1]) : 0;

    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return { hour, minute };
  }

  const start = parsePart(parts[0]);
  const end = parsePart(parts[1]);

  if (!start || !end) return null;
  return { start, end };
}

function getShiftBounds(shift) {
  const date = parseShiftDate(shift?.date);
  const time = parseShiftTime(shift?.shift);

  if (!date || !time) return null;

  const start = new Date(date);
  start.setHours(time.start.hour, time.start.minute, 0, 0);

  const end = new Date(date);
  end.setHours(time.end.hour, time.end.minute, 0, 0);

  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

function formatDuration(ms, withDays = true) {
  const safe = Math.max(0, ms);
  let totalSeconds = Math.floor(safe / 1000);

  const days = Math.floor(totalSeconds / 86400);
  totalSeconds -= days * 86400;

  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds -= hours * 3600;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;

  if (withDays && days > 0) {
    return `${days}д ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function findRelevantShift(data) {
  const shifts = Array.isArray(data?.upcoming_shifts) ? data.upcoming_shifts : [];
  const now = new Date();

  const parsed = shifts
    .map(shift => {
      const bounds = getShiftBounds(shift);
      return bounds ? { shift, ...bounds } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  const current = parsed.find(item => now >= item.start && now <= item.end);
  if (current) {
    return { type: "current", item: current };
  }

  const next = parsed.find(item => item.start > now);
  if (next) {
    return { type: "next", item: next };
  }

  return { type: "none", item: null };
}


function formatShortElapsed(ms) {
  const safe = Math.max(0, ms);
  let totalMinutes = Math.floor(safe / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes - hours * 60;
  return `${pad2(hours)}:${pad2(minutes)}`;
}

function setTextIfExists(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function updateShiftTimer() {
  const card = document.querySelector(".shift-card");
  const timer = document.getElementById("shiftLiveTimer");
  const title = document.getElementById("timerTitle");
  const subtitle = document.getElementById("timerSubtitle");
  const badge = document.getElementById("timerBadge");
  const value = document.getElementById("timerValue");
  const bar = document.getElementById("shiftProgressBar");
  const startText = document.getElementById("progressStart");
  const endText = document.getElementById("progressEnd");
  const percentText = document.getElementById("progressPercent");
  const progressMiddle = document.getElementById("progressMiddle");

  if (!card || !timer || !currentData) return;

  const relevant = findRelevantShift(currentData);
  const now = new Date();

  timer.classList.remove("shift-live-current", "shift-live-next", "shift-live-empty");
  card.classList.remove("shift-card-current", "shift-card-next", "shift-card-empty");

  if (relevant.type === "none") {
    timer.classList.add("shift-live-empty");
    card.classList.add("shift-card-empty");

    title.textContent = "🔴 Смен пока нет";
    subtitle.textContent = "Ожидайте назначения";
    badge.textContent = "Нет смен";
    value.textContent = "—";
    bar.style.width = "0%";
    startText.textContent = "—";
    endText.textContent = "—";
    percentText.textContent = "0%";
    if (progressMiddle) progressMiddle.textContent = "Прошло: 00:00";
    setTextIfExists("timerInfoDate", "—");
    setTextIfExists("timerInfoShift", "—");
    setTextIfExists("timerInfoHours", "—");
    setTextIfExists("timerWorked", "Отработано: 0%");
    setTextIfExists("timerDayLabel", "—");
    return;
  }

  const { shift, start, end } = relevant.item;
  const startLabel = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
  const endLabel = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;

  startText.textContent = startLabel;
  endText.textContent = endLabel;
  setTextIfExists("timerInfoDate", shift.date || "—");
  setTextIfExists("timerInfoShift", shift.shift || "—");
  setTextIfExists("timerInfoHours", `${shift.hours || 0} часов`);

  if (relevant.type === "current") {
    timer.classList.add("shift-live-current");
    card.classList.add("shift-card-current");

    const total = end - start;
    const passed = now - start;
    const percent = Math.min(100, Math.max(0, Math.round((passed / total) * 100)));

    title.textContent = "🟢 Сейчас на смене";
    subtitle.textContent = "До конца смены осталось";
    badge.textContent = "В процессе";
    value.textContent = formatDuration(end - now, false);
    bar.style.width = `${percent}%`;
    timer.style.setProperty("--ring-progress", `${percent}%`);
    percentText.textContent = `${percent}%`;
    if (progressMiddle) progressMiddle.textContent = `Прошло: ${formatShortElapsed(passed)}`;
    setTextIfExists("timerWorked", `Отработано: ${percent}%`);
    setTextIfExists("timerDayLabel", "Сегодня");
    return;
  }

  timer.classList.add("shift-live-next");
  card.classList.add("shift-card-next");

  title.textContent = "⚪ Следующая смена";
  subtitle.textContent = "До начала смены осталось";
  badge.textContent = "Ожидание";
  value.textContent = formatDuration(start - now, true);
  bar.style.width = "0%";
  timer.style.setProperty("--ring-progress", "0%");
  percentText.textContent = "0%";
  if (progressMiddle) progressMiddle.textContent = "Ожидание";
  setTextIfExists("timerWorked", "Ожидает начала");
  setTextIfExists("timerDayLabel", "Дата");
}

function startShiftTimer() {
  if (shiftTimerInterval) {
    clearInterval(shiftTimerInterval);
  }

  updateShiftTimer();
  updateNextShiftCountdownCard();
  shiftTimerInterval = setInterval(() => {
    updateShiftTimer();
    updateNextShiftCountdownCard();
  }, 1000);
}

loadData();



// owner refresh handler
document.addEventListener("click", async (event) => {
  const refreshBtn = event.target.closest("[data-owner-refresh]");
  if (!refreshBtn) return;

  try {
    refreshBtn.disabled = true;
    await renderOwnerDashboard();
  } catch (error) {
    alert("Ошибка обновления бизнес-панели: " + error.message);
  } finally {
    refreshBtn.disabled = false;
  }
});
