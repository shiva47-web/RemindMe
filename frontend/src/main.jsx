
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import "./premium-theme.css";

import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";

import PushSetup from "./PushSetup.jsx";
import ReminderSync from "./ReminderSync.jsx";
import AIChatbox from "./AIChatbox.jsx";

// Register the service worker for push notifications.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log(
          "RemindMe service worker registered:",
          registration.scope
        );
      })
      .catch((error) => {
        console.error(
          "Service worker registration failed:",
          error
        );
      });
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
