import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const hasPlaceholderConfig = Object.values(firebaseConfig).some((value) =>
  String(value).includes("YOUR_")
);

let app;
if (!hasPlaceholderConfig) {
  app = initializeApp(firebaseConfig);
}

const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

export { auth, db, hasPlaceholderConfig };
