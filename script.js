const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector(".primary-nav");

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  primaryNav.classList.toggle("is-open", !isOpen);
});

primaryNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    primaryNav.classList.remove("is-open");
  }
});

const filterButtons = document.querySelectorAll(".filter-chip");
const projectCards = document.querySelectorAll(".project-card");
const emptyProjects = document.querySelector("#empty-projects");

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    let visibleProjects = 0;
    filterButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    projectCards.forEach((card) => {
      const visible = filter === "all" || card.dataset.category === filter;
      card.classList.toggle("is-hidden", !visible);
      if (visible) visibleProjects += 1;
    });
    emptyProjects.hidden = visibleProjects > 0;
  });
});

const dialog = document.querySelector(".inquiry-dialog");
const openDialogButton = document.querySelector("[data-open-dialog]");
const closeDialogButton = document.querySelector(".dialog-close");
const inquiryForm = document.querySelector("#inquiry-form");

openDialogButton.addEventListener("click", () => {
  dialog.showModal();
  document.body.classList.add("dialog-open");
});

closeDialogButton.addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

inquiryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const details = new FormData(inquiryForm);
  const subject = `Project inquiry: ${details.get("service")}`;
  const body = [
    `Name: ${details.get("name")}`,
    `Email: ${details.get("email")}`,
    `Area: ${details.get("service")}`,
    "",
    details.get("brief"),
  ].join("\n");
  window.location.href = `mailto:ezehfranklin17@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

document.querySelector("#current-year").textContent = new Date().getFullYear();
