import { useEffect, useState } from "react";
import "./InstallPrompt.css";

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState(
    () => window.__remindMeInstallPrompt || null
  );
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [message, setMessage] = useState("");
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsIOS(ios);

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (isStandalone) return;

    const handleAvailable = () => {
      const event = window.__remindMeInstallPrompt;
      if (event) {
        setInstallEvent(event);
        setMessage("");
        setShowPrompt(true);
      }
    };

    const handleInstalled = () => {
      window.__remindMeInstallPrompt = null;
      setInstallEvent(null);
      setShowPrompt(false);
    };

    window.addEventListener("remindme:install-available", handleAvailable);
    window.addEventListener("remindme:app-installed", handleInstalled);

    // Pick up an event captured before this component mounted.
    handleAvailable();

    // iOS Safari does not support beforeinstallprompt; show its instructions.
    if (ios && !sessionStorage.getItem("remindme-install-dismissed")) {
      setShowPrompt(true);
    }

    return () => {
      window.removeEventListener("remindme:install-available", handleAvailable);
      window.removeEventListener("remindme:app-installed", handleInstalled);
    };
  }, []);

  const installApp = async () => {
    const promptEvent = installEvent || window.__remindMeInstallPrompt;

    if (!promptEvent) {
      setMessage(
        "Chrome has not made RemindMe installable yet. Check that the site is updated and reload it after the PWA setup is deployed."
      );
      return;
    }

    try {
      setInstalling(true);
      // prompt() is called directly from the user's click.
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      if (choice?.outcome === "accepted") {
        setShowPrompt(false);
      } else {
        setMessage("Installation was cancelled. You can try again.");
      }
    } catch (error) {
      console.error("RemindMe installation failed:", error);
      setMessage("Chrome could not start installation. Reload the page and try again.");
    } finally {
      window.__remindMeInstallPrompt = null;
      setInstallEvent(null);
      setInstalling(false);
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    sessionStorage.setItem("remindme-install-dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="install-overlay">
      <div className="install-popup" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <button className="install-close" onClick={dismissPrompt} aria-label="Close">
          ×
        </button>

        <div className="install-logo">R</div>
        <h2 id="install-title">Install RemindMe</h2>
        <p>
          Keep your reminders close. Install RemindMe on your phone for a
          convenient app experience.
        </p>

        {isIOS ? (
          <div className="ios-install-help">
            Tap the <strong>Share</strong> button in Safari, then choose{" "}
            <strong>Add to Home Screen</strong>.
          </div>
        ) : installEvent ? (
          <button className="install-action" onClick={installApp} disabled={installing}>
            {installing ? "Opening installer..." : "Install App"}
          </button>
        ) : (
          <div className="ios-install-help">
            RemindMe is preparing for installation. Reload this page after the
            latest version has finished deploying.
          </div>
        )}

        {message && <p className="install-message" role="status">{message}</p>}

        <button className="install-later" onClick={dismissPrompt}>Maybe later</button>
      </div>
    </div>
  );
}
