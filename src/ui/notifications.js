export function createToastManager(toastContainer) {
  function dismissToast(toast) {
    if (!toast) return;
    if (toast._dismissTimer) {
      clearTimeout(toast._dismissTimer);
      toast._dismissTimer = null;
    }
    toast.remove();
  }

  function pushToast({ title, message, glowColor = null, timeoutMs = null } = {}) {
    if (!toastContainer) return null;
    const safeTitle = title || "Notice";
    const safeMessage = message || "";

    const toast = document.createElement("div");
    toast.className = "toast";
    if (glowColor) {
      toast.classList.add("toast--glow");
      toast.style.setProperty("--toast-glow", glowColor);
    }

    const header = document.createElement("div");
    header.className = "toast-header";

    const titleEl = document.createElement("div");
    titleEl.className = "toast-title";
    titleEl.textContent = safeTitle;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "toast-close";
    closeBtn.setAttribute("aria-label", "Dismiss notification");
    closeBtn.textContent = "x";
    closeBtn.addEventListener("click", () => dismissToast(toast));

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "toast-body";
    body.textContent = safeMessage;

    toast.appendChild(header);
    toast.appendChild(body);
    toastContainer.appendChild(toast);

    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      toast._dismissTimer = setTimeout(() => dismissToast(toast), timeoutMs);
    }

    return toast;
  }

  return { pushToast };
}
