const authView = document.querySelector("#auth-view");
const dashboardView = document.querySelector("#dashboard-view");
const adminDashboard = document.querySelector("#admin-dashboard");
const loginTab = document.querySelector("#login-tab");
const registerTab = document.querySelector("#register-tab");
const loginPanel = document.querySelector("#login-panel");
const registerPanel = document.querySelector("#register-panel");
const adminOtpPanel = document.querySelector("#admin-otp-panel");
const portalTabs = document.querySelector("#portal-tabs");
const authFeedback = document.querySelector("#auth-feedback");
const proposalFeedback = document.querySelector("#proposal-feedback");
const proposalList = document.querySelector("#proposal-list");
const adminClientList = document.querySelector("#admin-client-list");
const adminProposalList = document.querySelector("#admin-proposal-list");
let adminChallengeToken = "";
const adminProposalStatuses = ["In review", "Quoted", "Accepted", "In progress", "Completed", "Declined"];

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
  adminChallengeToken = "";
  portalTabs.hidden = false;
  loginTab.classList.toggle("is-active", isLogin);
  loginTab.setAttribute("aria-selected", String(isLogin));
  registerTab.classList.toggle("is-active", !isLogin);
  registerTab.setAttribute("aria-selected", String(!isLogin));
  loginPanel.hidden = !isLogin;
  registerPanel.hidden = isLogin;
  adminOtpPanel.hidden = true;
  showFeedback(authFeedback, "");
}

function showDashboard(user) {
  authView.hidden = true;
  const isAdmin = user.role === "admin";
  dashboardView.hidden = isAdmin;
  adminDashboard.hidden = !isAdmin;
  if (isAdmin) {
    document.querySelector("#admin-name").textContent = "Franklin Ezeh";
    loadAdminData();
    return;
  }

  document.querySelector("#client-name").textContent = user.fullName.split(/\s+/)[0] + ".";
  document.querySelector("#card-name").textContent = user.fullName;
  document.querySelector("#client-id").textContent = user.clientId;
  document.querySelector("#member-since").textContent = new Date(user.createdAt).toLocaleDateString(
    undefined,
    { month: "short", year: "numeric" },
  );
  loadProposals();
}

function showListMessage(container, message) {
  const empty = document.createElement("p");
  empty.className = "proposal-empty";
  empty.textContent = message;
  container.replaceChildren(empty);
}

function renderAdminClients(clients) {
  document.querySelector("#admin-client-count").textContent = String(clients.length);
  if (!clients.length) {
    showListMessage(adminClientList, "No client accounts yet.");
    return;
  }

  const list = document.createDocumentFragment();
  for (const client of clients) {
    const row = document.createElement("article");
    row.className = "admin-client-row";
    const identity = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = client.full_name;
    const email = document.createElement("p");
    email.textContent = client.email;
    identity.append(name, email);
    const meta = document.createElement("div");
    meta.className = "admin-client-meta";
    meta.textContent = `${client.client_id} · ${client.proposal_count} proposals · ${client.email_verified ? "Verified" : "Unverified"}`;
    row.append(identity, meta);
    list.append(row);
  }
  adminClientList.replaceChildren(list);
}

function renderAdminProposals(proposals) {
  document.querySelector("#admin-proposal-count").textContent = String(proposals.length);
  if (!proposals.length) {
    showListMessage(adminProposalList, "No project proposals have been submitted yet.");
    return;
  }

  const list = document.createDocumentFragment();
  for (const proposal of proposals) {
    const row = document.createElement("article");
    row.className = "admin-proposal-row";
    const heading = document.createElement("div");
    heading.className = "admin-proposal-heading";
    const title = document.createElement("h3");
    title.textContent = proposal.service_type;
    const status = document.createElement("span");
    status.className = "proposal-status";
    status.textContent = proposal.status;
    heading.append(title, status);

    const client = document.createElement("p");
    client.className = "admin-proposal-client";
    client.textContent = `${proposal.client_name} · ${proposal.client_email} · ${proposal.client_number}`;
    const description = document.createElement("p");
    description.className = "admin-proposal-description";
    description.textContent = proposal.description;
    const detail = document.createElement("p");
    detail.className = "admin-proposal-description";
    detail.textContent = `Budget: ${proposal.budget_range} · Timeline: ${proposal.timeline}`;

    const form = document.createElement("form");
    form.className = "admin-proposal-update";
    const statusLabel = document.createElement("label");
    statusLabel.textContent = "Update status";
    const select = document.createElement("select");
    select.name = "status";
    select.required = true;
    if (!adminProposalStatuses.includes(proposal.status)) {
      const current = document.createElement("option");
      current.value = proposal.status;
      current.textContent = proposal.status;
      current.disabled = true;
      current.selected = true;
      select.append(current);
    }
    for (const value of adminProposalStatuses) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = value === proposal.status;
      select.append(option);
    }
    statusLabel.append(select);
    const noteLabel = document.createElement("label");
    noteLabel.textContent = "Private admin note";
    const note = document.createElement("textarea");
    note.name = "privateNote";
    note.rows = 2;
    note.maxLength = 3000;
    note.value = proposal.private_notes ?? "";
    noteLabel.append(note);
    const save = document.createElement("button");
    save.className = "button button-outline";
    save.type = "submit";
    save.textContent = "Save update";
    form.append(statusLabel, noteLabel, save);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      save.disabled = true;
      try {
        await apiRequest(`/admin/proposals/${encodeURIComponent(proposal.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: select.value,
            privateNote: note.value,
          }),
        });
        showFeedback(document.querySelector("#admin-feedback"), "Proposal updated.", "success");
        await loadAdminData();
      } catch (error) {
        showFeedback(document.querySelector("#admin-feedback"), error.message, "error");
        save.disabled = false;
      }
    });

    row.append(heading, client, description, detail, form);
    list.append(row);
  }
  adminProposalList.replaceChildren(list);
}

async function loadAdminData() {
  showListMessage(adminClientList, "Loading clients…");
  showListMessage(adminProposalList, "Loading proposals…");
  showFeedback(document.querySelector("#admin-feedback"), "");
  const [clientsResult, proposalsResult] = await Promise.allSettled([
    apiRequest("/admin/clients"),
    apiRequest("/admin/proposals"),
  ]);
  if (clientsResult.status === "fulfilled") {
    renderAdminClients(clientsResult.value.clients);
  } else {
    showListMessage(adminClientList, clientsResult.reason.message);
  }
  if (proposalsResult.status === "fulfilled") {
    renderAdminProposals(proposalsResult.value.proposals);
  } else {
    showListMessage(adminProposalList, proposalsResult.reason.message);
  }
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
    if (data.requiresOtp) {
      adminChallengeToken = data.challengeToken;
      loginPanel.hidden = true;
      registerPanel.hidden = true;
      portalTabs.hidden = true;
      adminOtpPanel.hidden = false;
      adminOtpPanel.elements.code.focus();
      showFeedback(authFeedback, data.message, "success");
      return;
    }
    showDashboard(data.user);
  } catch (error) {
    showFeedback(authFeedback, error.message, "error");
  }
});

adminOtpPanel.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!adminChallengeToken) {
    setAuthMode("login");
    showFeedback(authFeedback, "Your sign-in challenge expired. Sign in again.", "error");
    return;
  }
  showFeedback(authFeedback, "Verifying your code…");
  try {
    const data = await apiRequest("/auth/verify-admin-otp", {
      method: "POST",
      body: JSON.stringify({
        challengeToken: adminChallengeToken,
        code: new FormData(adminOtpPanel).get("code"),
      }),
    });
    adminChallengeToken = "";
    showDashboard(data.user);
  } catch (error) {
    showFeedback(authFeedback, error.message, "error");
  }
});

document.querySelector("#back-to-login").addEventListener("click", () => setAuthMode("login"));

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
  if (!email || !email.includes("@")) {
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

async function signOut() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
    dashboardView.hidden = true;
    adminDashboard.hidden = true;
    authView.hidden = false;
    loginPanel.reset();
    adminOtpPanel.reset();
    setAuthMode("login");
  } catch (error) {
    showFeedback(proposalFeedback, error.message, "error");
  }
}

document.querySelector("#logout-button").addEventListener("click", signOut);
document.querySelector("#admin-logout-button").addEventListener("click", signOut);
document.querySelector("#refresh-proposals").addEventListener("click", loadProposals);
document.querySelector("#refresh-admin").addEventListener("click", loadAdminData);

apiRequest("/auth/me")
  .then(({ user }) => showDashboard(user))
  .catch((error) => {
    if (error.message !== "Authentication required." && !error.message.startsWith("Session expired")) {
      showFeedback(authFeedback, error.message, "error");
    }
  });
