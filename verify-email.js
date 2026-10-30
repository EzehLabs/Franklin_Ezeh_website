const token = new URLSearchParams(window.location.search).get("token");
const button = document.querySelector("#verify-button");
const message = document.querySelector("#verify-message");

button.addEventListener("click", async () => {
  if (!token) {
    message.textContent = "This verification link is missing its token. Request another link from the client portal.";
    button.disabled = true;
    return;
  }

  button.disabled = true;
  message.textContent = "Verifying your email…";
  try {
    const response = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Email verification failed.");
    message.textContent = data.message;
    button.textContent = "Email verified";
    button.querySelector("span")?.remove();
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
});

if (!token) {
  message.textContent = "This verification link is missing its token. Request another link from the client portal.";
}
