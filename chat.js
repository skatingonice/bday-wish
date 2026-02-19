import { db, hasPlaceholderConfig } from "./firebase-config.js";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ALLOWED_USERS = new Set(["meskat", "skatingonice"]);
const ROOM_COLLECTION = "bday_chat_messages";

const statusEl = document.getElementById("status");
const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message-input");
const logoutBtn = document.getElementById("logout-btn");
const LOCAL_MESSAGES_KEY = "bday_chat_messages_local";

let user = null;
let unsubscribe = null;
let localPollTimer = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function getCurrentUser() {
  return (sessionStorage.getItem("bday_chat_user") || "").toLowerCase();
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
    meta.textContent = `${label} . ${formatTime(msg.createdAtMs)}`;

    const text = document.createElement("p");
    text.className = "text";
    text.textContent = msg.text || "";

    item.append(meta, text);
    messagesEl.appendChild(item);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function readLocalMessages() {
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((msg) => msg && typeof msg === "object")
      .map((msg) => ({
        sender: String(msg.sender || ""),
        text: String(msg.text || ""),
        createdAtMs: Number(msg.createdAtMs || 0)
      }))
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .slice(-200);
  } catch (error) {
    console.error(error);
    return [];
  }
}

function writeLocalMessage(msg) {
  const messages = readLocalMessages();
  messages.push(msg);
  localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages.slice(-200)));
}

function initLocalMessages() {
  setStatus(`Signed in as ${user} (local mode)`);
  renderMessages(readLocalMessages());

  localPollTimer = window.setInterval(() => {
    renderMessages(readLocalMessages());
  }, 1000);
}

function initRealtimeMessages() {
  const q = query(collection(db, ROOM_COLLECTION), orderBy("createdAtMs", "asc"), limit(200));

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderMessages(messages);
      setStatus(`Signed in as ${user} (live)`);
    },
    (error) => {
      console.error(error);
      setStatus("Failed to load messages. Check Firebase config/rules.");
    }
  );
}

function init() {
  user = getCurrentUser();

  if (!ALLOWED_USERS.has(user)) {
    window.location.href = "login.html";
    return;
  }

  if (!hasPlaceholderConfig && db) {
    setStatus("Connecting to live chat...");
    initRealtimeMessages();
  } else {
    setStatus("Firebase is not configured. Using local chat on this browser.");
    initLocalMessages();
  }

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = "";

    try {
      const payload = { sender: user, text, createdAtMs: Date.now() };
      if (!hasPlaceholderConfig && db) {
        await addDoc(collection(db, ROOM_COLLECTION), payload);
      } else {
        writeLocalMessage(payload);
        renderMessages(readLocalMessages());
      }
    } catch (error) {
      console.error(error);
      setStatus("Could not send message. Check Firebase permissions.");
    }
  });

  logoutBtn.addEventListener("click", () => {
    if (unsubscribe) unsubscribe();
    if (localPollTimer) window.clearInterval(localPollTimer);
    sessionStorage.removeItem("bday_chat_user");
    window.location.href = "login.html";
  });
}

init();
