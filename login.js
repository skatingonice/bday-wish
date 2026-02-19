const USERS = {
  meskat: "meskat30",
  skatingonice: "fallingdown"
};

const formEl = document.getElementById("login-form");
const statusEl = document.getElementById("login-status");
const usernameEl = document.getElementById("username");
const passwordEl = document.getElementById("password");

function setStatus(text) {
  statusEl.textContent = text;
}

function currentUser() {
  return sessionStorage.getItem("bday_chat_user");
}

function init() {
  if (currentUser()) {
    window.location.href = "chat.html";
    return;
  }

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = usernameEl.value.trim().toLowerCase();
    const password = passwordEl.value;

    if (!Object.prototype.hasOwnProperty.call(USERS, username)) {
      setStatus("Unknown username.");
      return;
    }

    if (USERS[username] !== password) {
      setStatus("Wrong password.");
      return;
    }

    sessionStorage.setItem("bday_chat_user", username);
    setStatus("Signed in. Redirecting...");
    window.location.href = "chat.html";
  });
}

init();
