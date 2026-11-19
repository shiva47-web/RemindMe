import { useState } from "react";
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  FileText,
  LoaderCircle,
  ChevronDown,
} from "lucide-react";

import "./AttachmentPanel.css";

const API_BASE = "http://127.0.0.1:8000";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
];

async function attachmentRequest(path, options = {}) {
  const token = localStorage.getItem("remindme_access_token");

  if (!token) {
    throw new Error("Your session has expired. Please log in again.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  let result = {};

  try {
    result = await response.json();
  } catch {
    // The response may not contain JSON.
  }

  if (!response.ok) {
    throw new Error(
      result.detail || `Request failed (${response.status}).`
    );
  }

  return result;
}

export default function AttachmentPanel({ reminderId }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  // Load attachments
  const loadAttachments = async () => {
    if (loaded || loading) return;

    setLoading(true);
    setError("");

    try {
      const result = await attachmentRequest(
        `/api/reminders/${encodeURIComponent(reminderId)}/attachments`
      );

      setAttachments(
        Array.isArray(result.attachments)
          ? result.attachments
          : []
      );

      setLoaded(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  // Open attachment section
  const handleOpen = (event) => {
    if (event.currentTarget.open) {
      loadAttachments();
    }
  };

  // Upload attachment
  const uploadAttachment = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    event.target.value = "";

    const extension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError("This file type is not supported.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Maximum file size is 10 MB.");
      return;
    }

    if (file.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const token = localStorage.getItem(
        "remindme_access_token"
      );

      if (!token) {
        throw new Error("Please log in again.");
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_BASE}/api/reminders/${encodeURIComponent(
          reminderId
        )}/attachments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Unable to upload attachment."
        );
      }

      if (result.attachment) {
        setAttachments((previous) => [
          result.attachment,
          ...previous,
        ]);

        setLoaded(true);
      }
    } catch (requestError) {
      setError(
        requestError.message || "Unable to upload attachment."
      );
    } finally {
      setUploading(false);
    }
  };

  // Download attachment
  const downloadAttachment = async (attachment) => {
    setDownloadingId(attachment.id);
    setError("");

    try {
      const token = localStorage.getItem(
        "remindme_access_token"
      );

      if (!token) {
        throw new Error("Please log in again.");
      }

      const response = await fetch(
        `${API_BASE}/api/reminders/${encodeURIComponent(
          reminderId
        )}/attachments/${encodeURIComponent(
          attachment.id
        )}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let result = {};

        try {
          result = await response.json();
        } catch {
          // Ignore non-JSON error responses.
        }

        throw new Error(
          result.detail || "Unable to download attachment."
        );
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.original_filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDownloadingId(null);
    }
  };

  // Delete attachment
  const deleteAttachment = async (attachmentId) => {
    if (deletingId || downloadingId) return;

    setDeletingId(attachmentId);
    setError("");

    try {
      await attachmentRequest(
        `/api/reminders/${encodeURIComponent(
          reminderId
        )}/attachments/${encodeURIComponent(attachmentId)}`,
        {
          method: "DELETE",
        }
      );

      setAttachments((previous) =>
        previous.filter((item) => item.id !== attachmentId)
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <details
      className="attachment-panel"
      onToggle={handleOpen}
    >
      <summary className="attachment-toggle">
        <span className="attachment-toggle-left">
          <Paperclip size={16} />

          <span>Attachments</span>

          <span className="attachment-count">
            {attachments.length}
          </span>
        </span>

        <ChevronDown
          size={16}
          className="attachment-chevron"
        />
      </summary>

      <div className="attachment-content">
        {loading && (
          <div className="attachment-loading">
            <LoaderCircle
              size={16}
              className="attachment-spinner"
            />
            Loading attachments...
          </div>
        )}

        {!loading && attachments.length === 0 && loaded && (
          <p className="attachment-empty">
            No attachments yet. Upload a file to get started.
          </p>
        )}

        <div className="attachment-list">
          {attachments.map((attachment) => (
            <div
              className="attachment-item"
              key={attachment.id}
            >
              <div className="attachment-file-icon">
                <FileText size={17} />
              </div>

              <div className="attachment-file-details">
                <strong>
                  {attachment.original_filename}
                </strong>

                <span>
                  {formatFileSize(attachment.file_size)}
                </span>
              </div>

              <button
                type="button"
                className="attachment-action"
                onClick={() => downloadAttachment(attachment)}
                disabled={downloadingId !== null}
                title="Download"
                aria-label="Download attachment"
              >
                {downloadingId === attachment.id ? (
                  <LoaderCircle
                    size={15}
                    className="attachment-spinner"
                  />
                ) : (
                  <Download size={15} />
                )}
              </button>

              <button
                type="button"
                className="attachment-action attachment-delete"
                onClick={() =>
                  deleteAttachment(attachment.id)
                }
                disabled={deletingId !== null}
                title="Delete"
                aria-label="Delete attachment"
              >
                {deletingId === attachment.id ? (
                  <LoaderCircle
                    size={15}
                    className="attachment-spinner"
                  />
                ) : (
                  <Trash2 size={15} />
                )}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="attachment-error">{error}</p>
        )}

        <label
          className={`attachment-upload ${
            uploading ? "uploading" : ""
          }`}
        >
          <input
            type="file"
            accept={ALLOWED_EXTENSIONS.join(",")}
            onChange={uploadAttachment}
            disabled={uploading}
            hidden
          />

          {uploading ? (
            <>
              <LoaderCircle
                size={16}
                className="attachment-spinner"
              />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={16} />
              Upload file
            </>
          )}
        </label>

        <p className="attachment-hint">
          PDF, Word, Excel, TXT, CSV and images. Maximum 10 MB.
        </p>
      </div>
    </details>
  );
}