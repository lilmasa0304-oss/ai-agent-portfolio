const INSTALL_DISMISS_KEY = "appshelf-install-dismissed";

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", {
        scope: "./",
      });
      console.info("[AppShelf] Service Worker registered:", registration.scope);
    } catch (error) {
      console.warn("[AppShelf] Service Worker registration failed:", error);
    }
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function initInstallPrompt() {
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (!isStandalone() && !localStorage.getItem(INSTALL_DISMISS_KEY)) {
      showInstallBanner();
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideInstallBanner();
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
  });

  document.getElementById("install-banner-btn")?.addEventListener("click", async () => {
    hideInstallBanner();
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
  });

  document.getElementById("install-banner-dismiss")?.addEventListener("click", () => {
    hideInstallBanner();
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
  });
}

function showInstallBanner() {
  document.getElementById("install-banner")?.classList.remove("hidden");
}

function hideInstallBanner() {
  document.getElementById("install-banner")?.classList.add("hidden");
}

registerServiceWorker();
initInstallPrompt();
