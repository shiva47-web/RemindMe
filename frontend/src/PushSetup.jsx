
import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, X } from "lucide-react";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://remindme-api-6sfw.onrender.com"
).replace(/\/+$/, "");

const TOKEN_KEY = "remindme_access_token";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }

  return output;
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Your login session has expired. Please log in again."
      );
    }

    throw new Error(
      data.detail || `Server error: ${response.status}`
    );
  }

  return data;
}

export default function PushSetup() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined"
      ? Notification.permission
      : "default"
  );

  const panelRef = useRef(null);

  useEffect(() => {
    if (!("Notification" in window)) return;

    const updatePermission = () => {
      setPermission(Notification.permission);
    };

    updatePermission();

    window.addEventListener("focus", updatePermission);

    return () => {
      window.removeEventListener("focus", updatePermission);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutsideClick
      );
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [open]);

  const enablePushNotifications = async () => {
    setLoading(true);
    setStatus("Checking your account...");

    try {
      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        throw new Error(
          "Please log in before enabling notifications."
        );
      }

      if (!("serviceWorker" in navigator)) {
        throw new Error(
          "Your browser does not support service workers."
        );
      }

      if (!("PushManager" in window)) {
        throw new Error(
          "Push notifications are not supported by this browser."
        );
      }

      if (!("Notification" in window)) {
        throw new Error(
          "Notifications are not supported by this browser."
        );
      }

      const permissionResult =
        await Notification.requestPermission();

      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        throw new Error(
          "Notification permission was not granted. Check your browser settings."
        );
      }

      setStatus("Connecting to RemindMe...");

      const keyResponse = await fetch(
        `${API_URL}/api/vapid-public-key`
      );

      const keyData = await readResponse(keyResponse);

      if (!keyData.publicKey) {
        throw new Error(
          "VAPID public key was not returned by the server."
        );
      }

      const registration =
        await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToUint8Array(keyData.publicKey),
          });
      }

      const subscriptionData = subscription.toJSON();

      if (
        !subscriptionData.endpoint ||
        !subscriptionData.keys?.p256dh ||
        !subscriptionData.keys?.auth
      ) {
        throw new Error(
          "The browser returned an invalid push subscription."
        );
      }

      setStatus("Saving your notification settings...");

      const saveResponse = await fetch(
        `${API_URL}/api/subscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(subscriptionData),
        }
      );

      await readResponse(saveResponse);

      setStatus("Sending a test notification...");

      const testResponse = await fetch(
        `${API_URL}/api/test-push`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        }
      );

      await readResponse(testResponse);

      setStatus(
        "Notifications enabled! Your test notification was sent."
      );

      setPermission("granted");
    } catch (error) {
      console.error("Push notification error:", error);

      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const statusIsError = status.startsWith("Error:");

  return (
    <div
      ref={panelRef}
      className="push-widget"
      aria-label="Notification settings"
    >
      {open && (
        <section
          className="push-panel"
          aria-label="Push notification settings"
        >
          <div className="push-panel-header">
            <div className="push-panel-title">
              <span className="push-panel-icon">
                <BellRing size={17} />
              </span>

              <div>
                <h3>Notifications</h3>
                <p>RemindMe alerts</p>
              </div>
            </div>

            <button
              type="button"
              className="push-close-button"
              onClick={() => setOpen(false)}
              aria-label="Close notification settings"
            >
              <X size={17} />
            </button>
          </div>

          <div className="push-status-row">
            <span
              className={`push-status-dot ${
                permission === "granted" ? "is-enabled" : ""
              }`}
            />

            <span>
              {permission === "granted"
                ? "Browser permission granted"
                : "Notifications not enabled"}
            </span>
          </div>

          <p className="push-description">
            Get reminder alerts even when RemindMe is not open.
            You can change notification permissions in your
            browser settings.
          </p>

          <button
            type="button"
            className="push-enable-button"
            onClick={enablePushNotifications}
            disabled={loading}
          >
            {loading ? (
              <span className="push-spinner" />
            ) : permission === "granted" ? (
              <Check size={17} />
            ) : (
              <Bell size={17} />
            )}

            {loading
              ? "Connecting..."
              : permission === "granted"
                ? "Enable / Test Notifications"
                : "Enable Notifications"}
          </button>

          {status && (
            <p
              className={`push-message ${
                statusIsError ? "is-error" : "is-success"
              }`}
              role="status"
              aria-live="polite"
            >
              {status}
            </p>
          )}
        </section>
      )}

      <button
        type="button"
        className="push-bell-button"
        onClick={() => setOpen((previous) => !previous)}
        aria-label={
          open
            ? "Close notification settings"
            : "Open notification settings"
        }
        aria-expanded={open}
        title="Notification settings"
      >
        <Bell size={20} strokeWidth={2} />

        {permission !== "granted" && (
          <span className="push-bell-indicator" />
        )}
      </button>
    </div>
  );
}
