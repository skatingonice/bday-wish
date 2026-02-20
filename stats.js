import { db, hasPlaceholderConfig } from "./firebase-config.js";
import { VISITS_COLLECTION, trackVisit } from "./analytics.js";
import { collection, getDocs, limit, orderBy, query } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ALLOWED_USERS = new Set(["meskat", "skatingonice"]);

const statusEl = document.getElementById("status");
const totalVisitsEl = document.getElementById("total-visits");
const uniqueVisitorsEl = document.getElementById("unique-visitors");
const uniqueIpsEl = document.getElementById("unique-ips");
const latestVisitEl = document.getElementById("latest-visit");
const topPagesEl = document.getElementById("top-pages");
const topDevicesEl = document.getElementById("top-devices");
const topLocationsEl = document.getElementById("top-locations");
const visitsBodyEl = document.getElementById("visits-body");
const refreshBtn = document.getElementById("refresh-btn");

function setStatus(text) {
  statusEl.textContent = text;
}

function getCurrentUser() {
  return (sessionStorage.getItem("bday_chat_user") || "").toLowerCase();
}

function safeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

function formatVisitTime(ms) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString();
}

function countBy(rows, getter) {
  const map = new Map();
  rows.forEach((row) => {
    const key = getter(row);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderTopList(el, entries, emptyText) {
  el.innerHTML = "";
  if (!entries.length) {
    const item = document.createElement("li");
    item.textContent = emptyText;
    el.appendChild(item);
    return;
  }

  entries.slice(0, 6).forEach(([label, count]) => {
    const item = document.createElement("li");

    const left = document.createElement("span");
    left.textContent = safeText(label);

    const right = document.createElement("span");
    right.className = "count";
    right.textContent = `${count} visit${count === 1 ? "" : "s"}`;

    item.append(left, right);
    el.appendChild(item);
  });
}

function renderTable(rows) {
  visitsBodyEl.innerHTML = "";

  const addCell = (tr, text, className = "") => {
    const td = document.createElement("td");
    if (className) td.className = className;
    td.textContent = text;
    tr.appendChild(td);
  };

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    const location = [row.city, row.region, row.country].filter(Boolean).join(", ");
    const ipText = row.ipAddress || "";
    const visitorId = safeText(row.visitorId);
    addCell(tr, safeText(formatVisitTime(row.createdAtMs)));
    addCell(tr, safeText(row.knownUser, "guest"));
    addCell(tr, safeText(row.pageName));
    addCell(tr, safeText(ipText, "not available"), ipText ? "" : "ip-empty");
    addCell(tr, safeText(location, "unknown"));
    addCell(tr, safeText(row.deviceType));
    addCell(tr, safeText(row.phoneModelHint, "unknown"));
    addCell(tr, visitorId);

    visitsBodyEl.appendChild(tr);
  });
}

function renderSummary(rows) {
  const uniqueVisitors = new Set(rows.map((row) => row.visitorId).filter(Boolean)).size;
  const uniqueIps = new Set(rows.map((row) => row.ipAddress).filter(Boolean)).size;
  const latestVisitMs = Math.max(...rows.map((row) => Number(row.createdAtMs || 0)), 0);

  totalVisitsEl.textContent = String(rows.length);
  uniqueVisitorsEl.textContent = String(uniqueVisitors);
  uniqueIpsEl.textContent = String(uniqueIps);
  latestVisitEl.textContent = latestVisitMs ? formatVisitTime(latestVisitMs) : "-";

  const topPages = countBy(rows, (row) => row.pageName);
  const topDevices = countBy(rows, (row) => row.deviceType);
  const topLocations = countBy(rows, (row) => [row.city, row.country].filter(Boolean).join(", "));

  renderTopList(topPagesEl, topPages, "No page data");
  renderTopList(topDevicesEl, topDevices, "No device data");
  renderTopList(topLocationsEl, topLocations, "No location data");
}

async function loadStats() {
  if (hasPlaceholderConfig || !db) {
    setStatus("Firebase is not configured. Stats are unavailable.");
    return;
  }

  setStatus("Loading analytics...");

  try {
    const q = query(collection(db, VISITS_COLLECTION), orderBy("createdAtMs", "desc"), limit(300));
    const snapshot = await getDocs(q);
    const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    renderSummary(rows);
    renderTable(rows);
    setStatus(`Loaded ${rows.length} visits.`);
  } catch (error) {
    console.error(error);
    setStatus("Failed to load stats. Check Firestore rules/indexes.");
  }
}

function init() {
  const user = getCurrentUser();
  if (!ALLOWED_USERS.has(user)) {
    window.location.href = "login.html?next=stats.html";
    return;
  }

  trackVisit({
    pageName: "stats",
    knownUser: user
  });

  refreshBtn.addEventListener("click", () => {
    loadStats();
  });

  loadStats();
}

init();
