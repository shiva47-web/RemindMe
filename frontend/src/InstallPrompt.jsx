
import { useEffect, useState } from "react";
import "./InstallPrompt.css";

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!isMobile) return;

    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    const ios =
      /iPhone|iPad|iPod/i.test(navigator.userAgent);

    setIsIOS(ios);

    const dismissed = sessionStorage.getItem("remindme-install-dismissed");

    if (dismissed) return;

    const timer = setTimeout(() => setShowPrompt(true), 1200);

    const handleInstallAvailable = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setShowPrompt(true);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleInstallAvailable
    );

    return () => {
      clearTimeout(timer);
      window.removeEventListener(
        "beforeinstallprompt",
        handleInstallAvailable
      );
    };
  }, []);

  const installApp = async () => {
    if (!installEvent) return;

    installEvent.prompt();

    const result = await installEvent.userChoice;

    if (result.outcome === "accepted") {
      setShowPrompt(false);
    }

    setInstallEvent(null);
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    sessionStorage.setItem("remindme-install-dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="install-overlay">
      <div className="install-popup">
        <button
          className="install-close"
          onClick={dismissPrompt}
          aria-label="Close"
        >
          ×
        </button>

        <div className="install-logo">R</div>

        <h2>Install RemindMe</h2>

        <p>
          Keep your reminders close. Install RemindMe
          on your phone for a convenient app experience.
        </p>

        {isIOS ? (
          <div className="ios-install-help">
            Tap the <strong>Share</strong> button in Safari,
            then choose <strong>Add to Home Screen</strong>.
          </div>
        ) : (
          <button
            className="install-action"
            onClick={installApp}
            disabled={!installEvent}
          >
            Install App
          </button>
        )}

        <button
          className="install-later"
          onClick={dismissPrompt}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
