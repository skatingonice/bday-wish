const APP_VERSION = "v1.1.7";

window.APP_VERSION = APP_VERSION;

function applyVersionBadge() {
  const badges = document.querySelectorAll(".version-badge");
  badges.forEach((badge) => {
    badge.textContent = APP_VERSION;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyVersionBadge, { once: true });
} else {
  applyVersionBadge();
}
