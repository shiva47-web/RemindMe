import { useEffect, useState } from "react";
import { Share2, X, Users, Trash2, LoaderCircle } from "lucide-react";
import { sharingRequest } from "./sharingApi";
import "./SharedReminders.css";

export default function ShareReminderButton({ reminder }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("viewer");
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadShares() {
    setLoading(true);
    setError("");

    try {
      const result = await sharingRequest(
        `/api/reminders/${reminder.id}/shares`
      );

      setShares(result.shares || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      loadShares();
    }
  }, [open, reminder.id]);

  async function handleShare(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await sharingRequest(
        `/api/reminders/${reminder.id}/shares`,
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            permission,
          }),
        }
      );

      setSuccess(result.message || "Reminder shared successfully.");
      setEmail("");

      await loadShares();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePermission(share, newPermission) {
    setError("");
    setSuccess("");

    try {
      const result = await sharingRequest(
        `/api/reminders/${reminder.id}/shares`,
        {
          method: "POST",
          body: JSON.stringify({
            email: share.email,
            permission: newPermission,
          }),
        }
      );

      setSuccess(result.message);
      await loadShares();
    } catch (err) {
      setError(err.message);
    }
  }

  async function revokeAccess(share) {
    const confirmed = window.confirm(
      `Remove ${share.email}'s access to this reminder?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const result = await sharingRequest(
        `/api/reminders/${reminder.id}/shares/${share.id}`,
        { method: "DELETE" }
      );

      setSuccess(result.message);
      await loadShares();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <button
        type="button"
        className="task-more share-task-button"
        title="Share reminder"
        onClick={() => setOpen(true)}
      >
        <Share2 size={16} />
      </button>

      {open && (
        <div
          className="share-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div
            className="share-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
          >
            <div className="share-modal-header">
              <div>
                <span className="share-eyebrow">
                  COLLABORATION
                </span>

                <h2 id="share-modal-title">
                  Share reminder
                </h2>

                <p>{reminder.title}</p>
              </div>

              <button
                type="button"
                className="share-close-button"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="share-form"
              onSubmit={handleShare}
            >
              <label htmlFor={`share-email-${reminder.id}`}>
                Recipient email
              </label>

              <input
                id={`share-email-${reminder.id}`}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="person@example.com"
                required
              />

              <label htmlFor={`share-permission-${reminder.id}`}>
                Permission
              </label>

              <select
                id={`share-permission-${reminder.id}`}
                value={permission}
                onChange={(event) =>
                  setPermission(event.target.value)
                }
              >
                <option value="viewer">
                  Viewer — Can view the reminder
                </option>

                <option value="editor">
                  Editor — Can edit the reminder
                </option>
              </select>

              <button
                type="submit"
                className="share-submit-button"
                disabled={saving}
              >
                {saving ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Share2 size={17} />
                )}

                {saving ? "Sharing..." : "Share reminder"}
              </button>
            </form>

            {error && (
              <div className="share-message error">
                {error}
              </div>
            )}

            {success && (
              <div className="share-message success">
                {success}
              </div>
            )}

            <div className="share-people-section">
              <h3>
                <Users size={18} />
                People with access
              </h3>

              {loading ? (
                <div className="share-loading">
                  <LoaderCircle className="spin" size={20} />
                  Loading...
                </div>
              ) : shares.length === 0 ? (
                <p className="share-empty">
                  Nobody else has access yet.
                </p>
              ) : (
                <div className="share-people-list">
                  {shares.map((share) => (
                    <div className="share-person" key={share.id}>
                      <div className="share-person-info">
                        <strong>{share.email}</strong>

                        <select
                          value={share.permission}
                          onChange={(event) =>
                            changePermission(
                              share,
                              event.target.value
                            )
                          }
                          aria-label={`Permission for ${share.email}`}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        className="share-revoke-button"
                        title="Remove access"
                        onClick={() => revokeAccess(share)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="share-footnote">
              Recipients must sign in to RemindMe using this
              exact email address. No invitation email is sent.
            </p>
          </div>
        </div>
      )}
    </>
  );
}