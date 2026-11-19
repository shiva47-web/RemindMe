const API_BASE = "http://127.0.0.1:8000";

export async function sharingRequest(path, options = {}) {
  const token = localStorage.getItem("remindme_access_token");

  if (!token) {
    throw new Error("Session expired. Please log in again.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  let result = {};

  try {
    result = await response.json();
  } catch {
    // No JSON response.
  }

  if (!response.ok) {
    throw new Error(
      result.detail || `Request failed (${response.status}).`
    );
  }

  return result;
}