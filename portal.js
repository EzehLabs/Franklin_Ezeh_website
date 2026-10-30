const authView = document.querySelector("#auth-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginTab = document.querySelector("#login-tab");
const registerTab = document.querySelector("#register-tab");
const loginPanel = document.querySelector("#login-panel");
const registerPanel = document.querySelector("#register-panel");
const authFeedback = document.querySelector("#auth-feedback");
const proposalFeedback = document.querySelector("#proposal-feedback");
const proposalList = document.querySelector("#proposal-list");

function showFeedback(element, message, kind = "") {
  element.textContent = message;
  element.dataset.kind = kind;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "The request could not be completed.");
  return data;
}

function setAuthMode(mode) {
  const isLogin = mode === "login";
  loginTab.classList.toggle("is-active", isLogin);
  loginTab.setAttribute("aria-selected", String(isLogin));
  registerTab.classList.toggle("is-active", !isLogin);
  registerTab.setAttribute("aria-selected", String(!isLogin));
  loginPanel.hidden = !isLogin;
  registerPanel.hidden = isLogin;
  showFeedback(authFeedback, "");
}

function showDashboard(user) {
  authView.hidden = true;
  dashboardView.hidden = false;
  document.querySelector("#client-name").textContent = user.fullName.split(/\s+/)[0] + ".";
  document.querySelector("#card-name").textContent = user.fullName;
  document.querySelector("#client-id").textContent = user.clientId;
  document.querySelector("#member-since").textContent = new Date(user.createdAt).toLocaleDateString(
    undefined,
    { month: "short", year: "numeric" },
  );
  loadProposals();
}

function renderProposals(proposals) {
  proposalList.replaceChildren();
  if (!proposals.length) {
    const empty = document.createElement("p");
    empty.className = "proposal-empty";
    empty.textContent = "No proposals yet. Send your first project brief above.";
    proposalList.append(empty);
    return;
  }

  for (const proposal of proposals) {
    const row = document.createElement("article");
    row.className = "proposal-row";
    const summary = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = proposal.service_type;
    const description = document.createElement("p");
    description.textContent = proposal.description;
    const date = document.createElement("div");
    date.className = "proposal-date";
    date.textContent = new Date(proposal.created_at).toLocaleDateString();
    const status = document.createElement("span");
    status.className = "proposal-status";
    status.textContent = proposal.status;
    summary.append(title, description, date);
    row.append(summary, status);
    proposalList.append(row);
  }
}

async function loadProposals() {
  proposalList.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "proposal-empty";
  loading.textContent = "Loading your proposals…";
  proposalList.append(loading);
  try {
    const data = await apiRequest("/proposals");
    renderProposals(data.proposals);
  } catch (error) {
    proposalList.replaceChildren();
    const message = document.createElement("p");
    message.className = "proposal-empty";
    message.textContent = error.message;
    proposalList.append(message);
  }
}

loginTab.addEventListener("click", () => setAuthMode("login"));
registerTab.addEventListener("click", () => setAuthMode("register"));

loginPanel.addEventListener("submit", async (event) => {
  event.preventDefault();
  showFeedback(authFeedback, "Signing you in…");
  const form = new FormData(loginPanel);
  try {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    showDashboard(data.user);
  } catch (error) {
    showFeedback(authFeedback, error.message, "error");
  }
});

registerPanel.addEventListener("submit", async (event) => {
  event.preventDefault();
  showFeedback(authFeedback, "Creating your account…");
  const form = new FormData(registerPanel);
  try {
    const data = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: form.get("fullName"),
        email: form.get("email"),
        phone: form.get("phone"),
        password: form.get("password"),
      }),
    });
    registerPanel.reset();
    setAuthMode("login");
    showFeedback(authFeedback, `${data.message} Your client ID is ${data.clientId}.`, "success");
  } catch (error) {
    showFeedback(authFeedback, error.message, "error");
  }
});

document.querySelector("#resend-verification").addEventListener("click", async () => {
  const email = loginPanel.elements.email.value;
  if (!email) {
    showFeedback(authFeedback, "Enter your email address first.", "error");
    loginPanel.elements.email.focus();
    return;
  }
  showFeedback(authFeedback, "Sending verification email…");
  try {
    const data = await apiRequest("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    showFeedback(authFeedback, data.message, "success");
  } catch (error) {
    showFeedback(authFeedback, error.message, "error");
  }
});

document.querySelector("#proposal-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showFeedback(proposalFeedback, "Submitting your proposal…");
  const form = new FormData(event.currentTarget);
  try {
    await apiRequest("/proposals", {
      method: "POST",
      body: JSON.stringify({
        serviceType: form.get("serviceType"),
        description: form.get("description"),
        budgetRange: form.get("budgetRange"),
        timeline: form.get("timeline"),
      }),
    });
    event.currentTarget.reset();
    showFeedback(proposalFeedback, "Proposal submitted. You can follow its progress below.", "success");
    await loadProposals();
  } catch (error) {
    showFeedback(proposalFeedback, error.message, "error");
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
    dashboardView.hidden = true;
    authView.hidden = false;
    loginPanel.reset();
    setAuthMode("login");
  } catch (error) {
    showFeedback(proposalFeedback, error.message, "error");
  }
});

document.querySelector("#refresh-proposals").addEventListener("click", loadProposals);

apiRequest("/auth/me")
  .then(({ user }) => showDashboard(user))
  .catch((error) => {
    if (error.message !== "Authentication required." && !error.message.startsWith("Session expired")) {
      showFeedback(authFeedback, error.message, "error");
    }
  });
