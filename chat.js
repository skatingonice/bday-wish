import * as firebaseConfigModule from "./firebase-config.js?v=20260219-2";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const { db, hasPlaceholderConfig } = firebaseConfigModule;

const ALLOWED_USERS = new Set(["meskat", "skatingonice"]);
const ROOM_COLLECTION = "bday_chat_messages";
const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "👍"];

const statusEl = document.getElementById("status");
const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message-input");
const logoutBtn = document.getElementById("logout-btn");
const LOCAL_MESSAGES_KEY = "bday_chat_messages_local";

let user = null;
let unsubscribe = null;
let localPollTimer = null;
let currentMessages = [];

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

function normalizeMessage(msg) {
  const rawReactions =
    msg && typeof msg.reactions === "object" && msg.reactions !== null ? msg.reactions : {};
  const reactions = {};

  Object.entries(rawReactions).forEach(([emoji, users]) => {
    if (!REACTION_EMOJIS.includes(emoji) || !Array.isArray(users)) return;
    const cleanedUsers = [...new Set(users.map((name) => String(name || "").toLowerCase()).filter(Boolean))];
    if (cleanedUsers.length) reactions[emoji] = cleanedUsers;
  });

  return {
    id: String(msg.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    sender: String(msg.sender || ""),
    text: String(msg.text || ""),
    createdAtMs: Number(msg.createdAtMs || Date.now()),
    reactions
  };
}

function getReactionCount(msg, emoji) {
  const list = msg.reactions && Array.isArray(msg.reactions[emoji]) ? msg.reactions[emoji] : [];
  return list.length;
}

function didUserReact(msg, emoji) {
  const list = msg.reactions && Array.isArray(msg.reactions[emoji]) ? msg.reactions[emoji] : [];
  return list.includes(user);
}

function renderMessages(messages) {
  currentMessages = messages.map((msg) => normalizeMessage(msg));
  messagesEl.innerHTML = "";

  currentMessages.forEach((msg) => {
    const item = document.createElement("article");
    item.className = `message ${msg.sender === user ? "you" : ""}`.trim();
    item.dataset.msgId = msg.id;

    const meta = document.createElement("div");
    meta.className = "meta";
    const label = msg.sender === user ? "you" : msg.sender;
    meta.textContent = `${label} . ${formatTime(msg.createdAtMs)}`;

    const text = document.createElement("p");
    text.className = "text";
    text.textContent = msg.text || "";

    item.append(meta, text);

    if (msg.sender !== user) {
      const reactions = document.createElement("div");
      reactions.className = "reactions";

      REACTION_EMOJIS.forEach((emoji) => {
        const count = getReactionCount(msg, emoji);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `react-btn ${didUserReact(msg, emoji) ? "active" : ""}`.trim();
        button.dataset.reactBtn = "1";
        button.dataset.msgId = msg.id;
        button.dataset.emoji = emoji;
        button.textContent = count > 0 ? `${emoji} ${count}` : emoji;
        reactions.appendChild(button);
      });

      item.appendChild(reactions);
    }

    messagesEl.appendChild(item);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function disableChat(reason) {
  setStatus(reason);
  inputEl.disabled = true;
  formEl.querySelector("button[type='submit']").disabled = true;
}

function readLocalMessages() {
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((msg) => msg && typeof msg === "object")
      .map((msg) => normalizeMessage(msg))
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .slice(-200);
  } catch (error) {
    console.error(error);
    return [];
  }
}

function writeLocalMessage(msg) {
  const messages = readLocalMessages();
  messages.push(normalizeMessage(msg));
  localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages.slice(-200)));
}

function toggleLocalReaction(msgId, emoji) {
  const messages = readLocalMessages();
  const index = messages.findIndex((msg) => msg.id === msgId);
  if (index < 0) return;
  if (messages[index].sender === user) return;

  const existing = Array.isArray(messages[index].reactions[emoji]) ? messages[index].reactions[emoji] : [];
  const hasReacted = existing.includes(user);
  const next = hasReacted ? existing.filter((name) => name !== user) : [...existing, user];

  if (next.length) {
    messages[index].reactions[emoji] = next;
  } else {
    delete messages[index].reactions[emoji];
  }

  localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages.slice(-200)));
  renderMessages(messages);
}

function initLocalMessages() {
  const reason = hasPlaceholderConfig ? "placeholder config detected" : "firebase db unavailable";
  setStatus(`Signed in as ${user} (local mode: ${reason}; this browser only, not shared with friend)`);
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
        payload.id = `${payload.createdAtMs}-${Math.random().toString(36).slice(2, 8)}`;
        payload.reactions = {};
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

  messagesEl.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-react-btn='1']");
    if (!button) return;

    const msgId = button.dataset.msgId;
    const emoji = button.dataset.emoji;
    if (!msgId || !emoji) return;

    const msg = currentMessages.find((item) => item.id === msgId);
    if (!msg || msg.sender === user) return;

    try {
      if (!hasPlaceholderConfig && db) {
        const alreadyReacted = didUserReact(msg, emoji);
        const path = `reactions.${emoji}`;
        await updateDoc(doc(db, ROOM_COLLECTION, msgId), {
          [path]: alreadyReacted ? arrayRemove(user) : arrayUnion(user)
        });
      } else {
        toggleLocalReaction(msgId, emoji);
      }
    } catch (error) {
      console.error(error);
      setStatus("Could not update reaction. Check Firebase permissions.");
    }
  });
}

init();
