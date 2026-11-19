import { useState } from "react";
import { Bell, BellRing } from "lucide-react";

const API_URL = "http://127.0.0.1:8000";
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

  const enablePushNotifications = async () => {
    setLoading(true);
    setStatus("Checking your account...");

    try {
      // Check login token.
      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        throw new Error(
          "Please log in to RemindMe before enabling notifications."
        );
      }

      // Check browser support.
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

      // Request notification permission.
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error(
          "Notification permission was not granted."
        );
      }

      setStatus("Connecting to RemindMe server...");

      // Get VAPID public key.
      const keyResponse = await fetch(
        `${API_URL}/api/vapid-public-key`
      );

      const keyData = await readResponse(keyResponse);

      if (!keyData.publicKey) {
        throw new Error(
          "VAPID public key was not returned."
        );
      }

      // Wait for service worker.
      const registration =
        await navigator.serviceWorker.ready;

      // Check existing subscription.
      let subscription =
        await registration.pushManager.getSubscription();

      // Create subscription if necessary.
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
          "Browser returned an invalid push subscription."
        );
      }

      setStatus(
        "Saving your notification subscription..."
      );

      // Save subscription with JWT authentication.
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

      setStatus(
        "Subscription saved! Sending test notification..."
      );

      // Send authenticated test notification.
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
        "Success! Your RemindMe test notification was sent."
      );

    } catch (error) {
      console.error(
        "Push notification error:",
        error
      );

      setStatus(
        `Error: ${error.message}`
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        right: "22px",
        bottom: "22px",
        width: "310px",
        maxWidth: "calc(100vw - 30px)",
        padding: "16px",
        background: "#201e2b",
        border: "1px solid #504265",
        borderRadius: "15px",
        boxShadow: "0 10px 35px rgba(0,0,0,0.4)",
        zIndex: 2000,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          color: "#c5adff",
          fontSize: "13px",
          fontWeight: "700",
          marginBottom: "12px",
        }}
      >
        <BellRing size={19} />
        BACKGROUND NOTIFICATIONS
      </div>

      <p
        style={{
          color: "#aaa7b7",
          fontSize: "11px",
          lineHeight: "1.6",
          marginBottom: "13px",
        }}
      >
        Enable push notifications to receive reminders
        when RemindMe is not open.
      </p>

      <button
        onClick={enablePushNotifications}
        disabled={loading}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "9px",
          width: "100%",
          padding: "12px",
          border: "none",
          borderRadius: "9px",
          background: loading ? "#655b7d" : "#a68afa",
          color: "#21192f",
          fontWeight: "700",
          fontSize: "12px",
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Bell size={17} />

        {loading
          ? "Connecting..."
          : "Enable Push Notifications"}
      </button>

      {status && (
        <p
          role="status"
          style={{
            color: status.startsWith("Error:")
              ? "#ff9da8"
              : "#a7e3b5",
            fontSize: "11px",
            lineHeight: "1.5",
            marginTop: "12px",
            overflowWrap: "anywhere",
          }}
        >
          {status}
        </p>
      )}
    </div>
  );
}