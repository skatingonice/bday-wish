const ALLOWED_USERS = new Set(["meskat", "skatingonice"]);
const STORAGE_KEY = "bday_chat_messages_v1";

const statusEl = document.getElementById("status");
const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message-input");
const logoutBtn = document.getElementById("logout-btn");

let user = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function getCurrentUser() {
  return (sessionStorage.getItem("bday_chat_user") || "").toLowerCase();
}

function readMessages() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMessages(messages) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function formatTime(ms) {
  if (!ms) return "sending...";
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMessages(messages) {
  messagesEl.innerHTML = "";

  messages.forEach((msg) => {
    const item = document.createElement("article");
    item.className = `message ${msg.sender === user ? "you" : ""}`.trim();

    const meta = document.createElement("div");
    meta.className = "meta";
    const label = msg.sender === user ? "you" : msg.sender;
    meta.textContent = `${label} . ${formatTime(msg.createdAt)}`;

    const text = document.createElement("p");
    text.className = "text";
    text.textContent = msg.text || "";

    item.append(meta, text);
    messagesEl.appendChild(item);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function init() {
  user = getCurrentUser();

  if (!ALLOWED_USERS.has(user)) {
    window.location.href = "login.html";
    return;
  }

  setStatus(`Signed in as ${user} (local mode)`);
  renderMessages(readMessages());

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = inputEl.value.trim();
    if (!text) return;

    const messages = readMessages();
    messages.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sender: user,
      text,
      createdAt: Date.now()
    });

    const last100 = messages.slice(-100);
    writeMessages(last100);
    renderMessages(last100);
    inputEl.value = "";
  });

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("bday_chat_user");
    window.location.href = "login.html";
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      renderMessages(readMessages());
    }
  });
}

init();
