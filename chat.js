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

let user = null;
let unsubscribe = null;

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

function disableChat(reason) {
  setStatus(reason);
  inputEl.disabled = true;
  formEl.querySelector("button[type='submit']").disabled = true;
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
      disableChat("Failed to load messages. Check Firebase config/rules.");
    }
  );
}

function init() {
  user = getCurrentUser();

  if (!ALLOWED_USERS.has(user)) {
    window.location.href = "login.html";
    return;
  }

  if (hasPlaceholderConfig || !db) {
    disableChat("Firebase is not configured. Update firebase-config.js first.");
  } else {
    setStatus("Connecting to live chat...");
    initRealtimeMessages();
  }

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!db || hasPlaceholderConfig) return;

    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = "";

    try {
      await addDoc(collection(db, ROOM_COLLECTION), {
        sender: user,
        text,
        createdAtMs: Date.now()
      });
    } catch (error) {
      console.error(error);
      setStatus("Could not send message. Check Firebase permissions.");
    }
  });

  logoutBtn.addEventListener("click", () => {
    if (unsubscribe) unsubscribe();
    sessionStorage.removeItem("bday_chat_user");
    window.location.href = "login.html";
  });
}

init();
