import { StrictMode } from "react";

import { createRoot } from "react-dom/client";

import "./index.css";
import "./premium-theme.css";

import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";

import PushSetup from "./PushSetup.jsx";
import ReminderSync from "./ReminderSync.jsx";

import AIChatbox from "./AIChatbox.jsx";


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