const tg = window.Telegram?.WebApp;

if (tg) {
  tg.expand();
  tg.setHeaderColor("#05060b");
  tg.setBackgroundColor("#05060b");

  const user = tg.initDataUnsafe?.user;
  if (user?.first_name) {
    document.querySelector(".profile-card h1").textContent = `Привет, ${user.first_name}! 👋`;
    document.querySelector(".avatar").textContent = user.first_name[0].toUpperCase();
  }
}

document.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred("light");
    }
  });
});
