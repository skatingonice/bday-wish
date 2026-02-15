const targetDate = new Date("2026-12-08T00:00:00");

const refs = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
  status: document.getElementById("status"),
  notifyBtn: document.getElementById("notify-btn"),
  notifyBtnText: document.getElementById("notify-btn-text"),
  notifyStatus: document.getElementById("notify-status")
};

const prev = {
  days: "",
  hours: "",
  minutes: "",
  seconds: ""
};

const bgMusic = document.getElementById("bg-music");
let hasSentBirthdayNotification = false;

const pad = (n) => String(n).padStart(2, "0");

function animateIfChanged(key, nextValue) {
  if (prev[key] === nextValue) return;
  prev[key] = nextValue;

  const el = refs[key];
  el.classList.add("change");
  el.textContent = nextValue;

  setTimeout(() => {
    el.classList.remove("change");
  }, 280);
}

function setNotificationStatus(message) {
  if (!refs.notifyStatus) return;
  refs.notifyStatus.textContent = message;
}

function updateNotificationUi() {
  if (!refs.notifyBtn) return;

  if (!("Notification" in window)) {
    refs.notifyBtn.classList.remove("enabled");
    refs.notifyBtn.disabled = true;
    if (refs.notifyBtnText) refs.notifyBtnText.textContent = "Notifications Unsupported";
    setNotificationStatus("Notifications are not supported in this browser.");
    return;
  }

  if (Notification.permission === "granted") {
    refs.notifyBtn.classList.add("enabled");
    refs.notifyBtn.disabled = true;
    if (refs.notifyBtnText) refs.notifyBtnText.textContent = "You Will Be Notified";
    setNotificationStatus("Notifications are enabled.");
    return;
  }

  if (Notification.permission === "denied") {
    refs.notifyBtn.classList.remove("enabled");
    refs.notifyBtn.disabled = true;
    if (refs.notifyBtnText) refs.notifyBtnText.textContent = "Notifications Blocked";
    setNotificationStatus("Notifications are blocked in browser settings.");
    return;
  }

  refs.notifyBtn.classList.remove("enabled");
  refs.notifyBtn.disabled = false;
  if (refs.notifyBtnText) refs.notifyBtnText.textContent = "Get Notifications";
  setNotificationStatus("Click the button to allow birthday notifications.");
}

function notifyBirthdayIfAllowed() {
  if (hasSentBirthdayNotification) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (Date.now() < targetDate.getTime()) return;

  new Notification("Birthday Countdown", {
    body: "The countdown is over. Happy Birthday!"
  });
  hasSentBirthdayNotification = true;
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    updateNotificationUi();
    return;
  }

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }

  updateNotificationUi();
  notifyBirthdayIfAllowed();
}

function tick() {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    animateIfChanged("days", "00");
    animateIfChanged("hours", "00");
    animateIfChanged("minutes", "00");
    animateIfChanged("seconds", "00");
    refs.status.textContent = "It is her birthday today. Happy Birthday!";
    notifyBirthdayIfAllowed();
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  animateIfChanged("days", String(days));
  animateIfChanged("hours", pad(hours));
  animateIfChanged("minutes", pad(minutes));
  animateIfChanged("seconds", pad(seconds));

  refs.status.textContent = "if you feel disturbed, you gotta let me know. dm me on discord, ill leave without a trace. my discord: skatingonice";
}

function startMusic() {
  if (!bgMusic) return;

  bgMusic.loop = true;
  const playPromise = bgMusic.play();

  if (playPromise) {
    playPromise.catch(() => {
      // Autoplay can be blocked by browser policy until first user gesture.
    });
  }
}

startMusic();
["click", "touchstart", "keydown"].forEach((eventName) => {
  document.addEventListener(eventName, startMusic, { once: true });
});

if (refs.notifyBtn) {
  refs.notifyBtn.addEventListener("click", () => {
    enableNotifications();
  });
}

updateNotificationUi();

tick();
setInterval(tick, 1000);
