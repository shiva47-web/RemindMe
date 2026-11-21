
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import "./premium-theme.css";

import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";

import PushSetup from "./PushSetup.jsx";
import ReminderSync from "./ReminderSync.jsx";
import AIChatbox from "./AIChatbox.jsx";

// Capture Chrome's install event before React components mount.
// The PWA plugin registers the Workbox service worker from vite.config.js.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    window.__remindMeInstallPrompt = event;
    window.dispatchEvent(new Event("remindme:install-available"));
  });

  window.addEventListener("appinstalled", () => {
    window.__remindMeInstallPrompt = null;
    window.dispatchEvent(new Event("remindme:app-installed"));
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthGate>
      <>
        <App />
        <AIChatbox />
        <PushSetup />
        <ReminderSync />
      </>
    </AuthGate>
  </StrictMode>
);
