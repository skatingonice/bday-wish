const APP_VERSION = "v1.2.0";

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
