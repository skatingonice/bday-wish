import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAY73BUstbhiSZOK3VCv1Ctlm7yq6DMq2Y",
  authDomain: "crush0chat.firebaseapp.com",
  projectId: "crush0chat",
  storageBucket: "crush0chat.firebasestorage.app",
  messagingSenderId: "712066742549",
  appId: "1:712066742549:web:00bc235544f87c3986111c",
  measurementId: "G-NRZYGKLK91"
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

