import * as firebaseConfigModule from "./firebase-config.js?v=20260219-2";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
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
const REACTION_OPTIONS = [
  { key: "heart", emoji: "\u2764\uFE0F" },
  { key: "laugh", emoji: "\uD83D\uDE02" },
  { key: "wow", emoji: "\uD83D\uDE2E" },
  { key: "sad", emoji: "\uD83D\uDE22" },
  { key: "like", emoji: "\uD83D\uDC4D" }
];
const REACTION_KEYS = new Set(REACTION_OPTIONS.map((item) => item.key));

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

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

function getCurrentUser() {
  return (sessionStorage.getItem("bday_chat_user") || "").toLowerCase();
}

function formatTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "sending...";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "sending...";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function deriveStableId(msg) {
  if (msg.id) return String(msg.id);
  return `${String(msg.sender || "")}-${Number(msg.createdAtMs || 0)}-${String(msg.text || "").slice(0, 30)}`;
}

function parseCreatedAtMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value === "object") {
    if (typeof value.toMillis === "function") {
      const millis = value.toMillis();
      if (Number.isFinite(millis)) return millis;
    }
    if (typeof value.seconds === "number") {
      const nanos = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
      const millis = value.seconds * 1000 + Math.floor(nanos / 1000000);
      if (Number.isFinite(millis)) return millis;
    }
  }
  return Date.now();
}

function normalizeMessage(msg) {
  const rawReactions =
    msg && typeof msg.reactions === "object" && msg.reactions !== null ? msg.reactions : {};
  const reactions = {};

  Object.entries(rawReactions).forEach(([reactionKey, users]) => {
    if (!REACTION_KEYS.has(reactionKey) || !Array.isArray(users)) return;
    const cleanedUsers = [...new Set(users.map((name) => String(name || "").toLowerCase()).filter(Boolean))];
    if (cleanedUsers.length) reactions[reactionKey] = cleanedUsers;
  });

  const messageText = [msg?.text, msg?.message, msg?.content, msg?.body]
    .map((value) => (value == null ? "" : String(value)))
    .find((value) => value.trim().length > 0) || "";

  return {
    id: deriveStableId(msg),
    sender: String(msg.sender || ""),
    text: messageText,
    createdAtMs: parseCreatedAtMs(msg.createdAtMs),
    reactions
  };
}

function getReactionCount(msg, reactionKey) {
  const list =
    msg.reactions && Array.isArray(msg.reactions[reactionKey]) ? msg.reactions[reactionKey] : [];
  return list.length;
}

function didUserReact(msg, reactionKey) {
  const list =
    msg.reactions && Array.isArray(msg.reactions[reactionKey]) ? msg.reactions[reactionKey] : [];
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

    const bodyRow = document.createElement("div");
    bodyRow.className = "msg-row";
    bodyRow.appendChild(text);

    if (msg.sender === user) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-btn";
      deleteBtn.dataset.deleteMsg = "1";
      deleteBtn.dataset.msgId = msg.id;
      deleteBtn.setAttribute("aria-label", "Delete message");
      deleteBtn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-1 6h2v9H8V9Zm6 0h2v9h-2V9ZM6 9h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9Z"/></svg>';
      bodyRow.appendChild(deleteBtn);
    }

    item.append(meta, bodyRow);

    if (msg.sender !== user) {
      const reactions = document.createElement("div");
      reactions.className = "reactions";

      REACTION_OPTIONS.forEach((reaction) => {
        const count = getReactionCount(msg, reaction.key);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `react-btn ${didUserReact(msg, reaction.key) ? "active" : ""}`.trim();
        button.dataset.reactBtn = "1";
        button.dataset.msgId = msg.id;
        button.dataset.reactionKey = reaction.key;
        button.dataset.reactionEmoji = reaction.emoji;
        button.textContent = count > 0 ? `${reaction.emoji} ${count}` : reaction.emoji;
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

function toggleLocalReaction(msgId, reactionKey) {
  const messages = readLocalMessages();
  const index = messages.findIndex((msg) => msg.id === msgId);
  if (index < 0) return;
  if (messages[index].sender === user) return;

  const existing = Array.isArray(messages[index].reactions[reactionKey])
    ? messages[index].reactions[reactionKey]
    : [];
  const hasReacted = existing.includes(user);
  const next = hasReacted ? existing.filter((name) => name !== user) : [...existing, user];

  if (next.length) {
    messages[index].reactions[reactionKey] = next;
  } else {
    delete messages[index].reactions[reactionKey];
  }

  localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages.slice(-200)));
  renderMessages(messages);
}

function removeLocalMessage(msgId) {
  const messages = readLocalMessages();
  const nextMessages = messages.filter((msg) => msg.id !== msgId);
  localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(nextMessages.slice(-200)));
  renderMessages(nextMessages);
}

function spawnReactionFx(button, emoji) {
  if (!button || !emoji) return;
  const rect = button.getBoundingClientRect();
  const fx = document.createElement("span");
  fx.className = "reaction-fx";
  fx.textContent = emoji;
  fx.style.left = `${rect.left + rect.width / 2}px`;
  fx.style.top = `${rect.top + rect.height / 2}px`;
  document.body.appendChild(fx);

  window.setTimeout(() => {
    fx.remove();
  }, 700);
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
    const deleteButton = event.target.closest("button[data-delete-msg='1']");
    if (deleteButton) {
      const msgId = deleteButton.dataset.msgId;
      if (!msgId) return;
      const message = currentMessages.find((item) => item.id === msgId);
      if (!message || message.sender !== user) return;

      const messageEl = deleteButton.closest(".message");
      if (messageEl) messageEl.classList.add("deleting");
      await delay(220);

      try {
        if (!hasPlaceholderConfig && db) {
          await deleteDoc(doc(db, ROOM_COLLECTION, msgId));
        } else {
          removeLocalMessage(msgId);
        }
      } catch (error) {
        if (messageEl) messageEl.classList.remove("deleting");
        console.error(error);
        setStatus("Could not delete message. Check Firebase permissions.");
      }
      return;
    }

    const button = event.target.closest("button[data-react-btn='1']");
    if (!button) return;

    const msgId = button.dataset.msgId;
    const reactionKey = button.dataset.reactionKey;
    if (!msgId || !reactionKey) return;

    const msg = currentMessages.find((item) => item.id === msgId);
    if (!msg || msg.sender === user) return;

    try {
      button.classList.add("bump");
      window.setTimeout(() => button.classList.remove("bump"), 260);
      const emoji = button.dataset.reactionEmoji || "";
      spawnReactionFx(button, emoji);

      if (!hasPlaceholderConfig && db) {
        const alreadyReacted = didUserReact(msg, reactionKey);
        const path = `reactions.${reactionKey}`;
        await updateDoc(doc(db, ROOM_COLLECTION, msgId), {
          [path]: alreadyReacted ? arrayRemove(user) : arrayUnion(user)
        });
      } else {
        toggleLocalReaction(msgId, reactionKey);
      }
    } catch (error) {
      console.error(error);
      setStatus("Could not update reaction. Check Firebase permissions.");
    }
  });
}

init();
