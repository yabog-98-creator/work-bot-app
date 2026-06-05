const API_BASE = "https://work-bot-production-4b59.up.railway.app";
const tg = window.Telegram?.WebApp;
let currentData = null;

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

function renderAdminPanel(adminData) {
  const employeesHtml = (adminData.employees || []).map(emp => `
    <div class="item">
      <strong>👤 ${emp.employee}</strong>
      <span class="muted">ID: ${emp.telegram_id}</span>
      <div class="muted">⏱ ${formatNumber(emp.hours)} ч. · ✅ смен: ${emp.confirmed_shifts} · 📅 впереди: ${emp.upcoming_shifts_count}</div>
      <div>💰 ${formatMoney(emp.salary_after_fines)} · ставка ${formatMoney(emp.rate)}/час</div>
    </div>
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
    <div class="item"><strong>👥 Сотрудников</strong>${adminData.employees_count}</div>
    <div class="item"><strong>⏱ Всего часов</strong>${formatNumber(adminData.total_hours)} ч.</div>
    <div class="item"><strong>💰 К выплате всего</strong>${formatMoney(adminData.total_after_fines)}</div>
    <div class="item"><strong>💸 Штрафы всего</strong>${formatMoney(adminData.total_fines)}</div>

    <h3 class="panel-subtitle">👥 Сотрудники</h3>
    ${employeesHtml || `<div class="item muted">Сотрудников пока нет</div>`}

    <h3 class="panel-subtitle">💸 Последние штрафы</h3>
    ${finesHtml}

    <h3 class="panel-subtitle">⚠️ Проблемные смены</h3>
    ${problemsHtml}
  `;
}

function renderPanel(tab) {
  const panel = document.getElementById("detailsPanel");
  const title = document.getElementById("panelTitle");
  const content = document.getElementById("panelContent");

  if (!currentData || tab === "home") {
    panel.classList.remove("visible");
    return;
  }

  panel.classList.add("visible");

  if (tab === "admin") {
    title.textContent = "👑 Админ-панель";
    content.innerHTML = `<div class="item muted">Загружаем админ-панель...</div>`;

    if (currentData.role !== "admin") {
      content.innerHTML = `<div class="item muted">Нет доступа</div>`;
      return;
    }

    loadAdminData()
      .then(adminData => {
        content.innerHTML = renderAdminPanel(adminData);
      })
      .catch(error => {
        content.innerHTML = `<div class="item muted">Ошибка: ${error.message}</div>`;
      });
    return;
  }

  if (tab === "schedule") {
    title.textContent = "📅 Мои смены";
    if (!currentData.upcoming_shifts?.length) {
      content.innerHTML = `<div class="item muted">Ближайших смен нет</div>`;
    } else {
      content.innerHTML = currentData.upcoming_shifts.map(s => `
        <div class="item">
          <strong>${s.date} · ${s.shift}</strong>
          <div class="muted">⏱ ${s.hours} ч. · ${s.confirmed ? "✅ Подтверждена" : "⏳ Ожидает"}</div>
        </div>
      `).join("");
    }
  }

  if (tab === "salary") {
    title.textContent = "💰 Зарплата";
    content.innerHTML = `
      <div class="item"><strong>К выплате</strong>${formatMoney(currentData.salary_after_fines)}</div>
      <div class="item"><strong>Начислено</strong>${formatMoney(currentData.salary)}</div>
      <div class="item"><strong>Ставка</strong>${formatMoney(currentData.rate)} / час</div>
      <div class="item"><strong>Отработано</strong>${formatNumber(currentData.hours)} ч.</div>
    `;
  }

  if (tab === "fines") {
    title.textContent = "💸 Штрафы";
    content.innerHTML = `
      <div class="item"><strong>Всего штрафов</strong>${formatMoney(currentData.fines_total)}</div>
      <div class="item muted">Количество: ${currentData.fines_count}</div>
    `;
  }

  if (tab === "stats") {
    title.textContent = "📊 Статистика";
    content.innerHTML = `
      <div class="item"><strong>Подтверждённые смены</strong>${currentData.confirmed_shifts}</div>
      <div class="item"><strong>Ближайшие смены</strong>${currentData.upcoming_shifts_count}</div>
      <div class="item"><strong>Часы</strong>${formatNumber(currentData.hours)} ч.</div>
    `;
  }

  if (tab === "profile") {
    title.textContent = "👤 Профиль";
    content.innerHTML = `
      <div class="item"><strong>${currentData.employee}</strong><span class="muted">ID: ${currentData.telegram_id}</span></div>
      <div class="item"><strong>Роль</strong>${currentData.role === "admin" ? "Администратор" : "Сотрудник"}</div>
    `;
  }
}

document.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-tab]");
  if (!btn) return;

  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));
  const navBtn = document.querySelector(`.bottom-nav button[data-tab="${btn.dataset.tab}"]`);
  if (navBtn) navBtn.classList.add("active");

  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred("light");
  }

  renderPanel(btn.dataset.tab);
});

loadData();
