import { db, hasPlaceholderConfig } from "./firebase-config.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const VISITS_COLLECTION = "bday_analytics_visits";
const VISITOR_ID_KEY = "bday_visitor_id";

function generateVisitorId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `visitor_${Date.now().toString(36)}_${rand}`;
}

function getVisitorId() {
  try {
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);
    if (!visitorId) {
      visitorId = generateVisitorId();
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }
    return visitorId;
  } catch {
    return generateVisitorId();
  }
}

function detectDeviceType(userAgent) {
  const ua = (userAgent || "").toLowerCase();
  if (/tablet|ipad/.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/.test(ua)) return "mobile";
  return "desktop";
}

function getPhoneModelHint(userAgent) {
  const ua = userAgent || "";
  const iphoneMatch = ua.match(/iPhone OS [\d_]+/i);
  if (iphoneMatch) return iphoneMatch[0];

  const androidMatch = ua.match(/Android [\d.]+; ([^)]+)/i);
  if (androidMatch && androidMatch[1]) {
    return androidMatch[1].split(";")[0].trim();
  }
  return "unknown";
}

async function getIpAndLocation() {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) throw new Error("ip lookup failed");

    const payload = await response.json();
    return {
      ipAddress: payload.ip || null,
      city: payload.city || null,
      region: payload.region || null,
      country: payload.country_name || payload.country || null
    };
  } catch {
    return {
      ipAddress: null,
      city: null,
      region: null,
      country: null
    };
  }
}

async function trackVisit({ pageName, knownUser = null } = {}) {
  if (hasPlaceholderConfig || !db) return;

  const userAgent = navigator.userAgent || "";
  const ipLocation = await getIpAndLocation();

  const visitPayload = {
    pageName: pageName || document.title || "unknown",
    path: window.location.pathname || "",
    visitorId: getVisitorId(),
    knownUser: knownUser || null,
    referrer: document.referrer || null,
    userAgent,
    deviceType: detectDeviceType(userAgent),
    phoneModelHint: getPhoneModelHint(userAgent),
    language: navigator.language || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    platform: navigator.platform || null,
    screenWidth: window.screen?.width || null,
    screenHeight: window.screen?.height || null,
    viewportWidth: window.innerWidth || null,
    viewportHeight: window.innerHeight || null,
    ipAddress: ipLocation.ipAddress,
    city: ipLocation.city,
    region: ipLocation.region,
    country: ipLocation.country,
    createdAtMs: Date.now(),
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, VISITS_COLLECTION), visitPayload);
  } catch (error) {
    console.error("visit tracking failed", error);
  }
}

export { trackVisit, VISITS_COLLECTION };
