"use client";

import { useState, useEffect, useCallback } from "react";

const OWNER_EMAIL = "ken@est03.com";

interface User {
  email: string;
  name: string | null;
  last_login: string | null;
  is_admin: boolean;
  granted_by: string | null;
  granted_at: string | null;
}

type ToastState = { type: "success" | "error"; message: string } | null;

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function firstNameFromEmail(email: string) {
  const local = email.split("@")[0];
  const first = local.split(/[._-]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl transition-all ${
        toast.type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      {toast.type === "success" ? (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      )}
      {toast.message}
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  user,
  onConfirm,
  onCancel,
  busy,
}: {
  user: User;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Remove admin access?
        </h3>
        <p className="text-sm text-gray-500 mb-5">
          <strong className="text-gray-700">{user.name ?? firstNameFromEmail(user.email)}</strong>{" "}
          ({user.email}) will no longer be able to access the admin panel or manage users.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#DC2626" }}
          >
            {busy ? "Removing…" : "Remove admin"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<User | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  async function loadUsers() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: User[] = await res.json();
      setUsers(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function grantAdmin(user: User) {
    setBusyEmail(user.email);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setUsers((prev) =>
        prev.map((u) => (u.email === user.email ? { ...u, is_admin: true } : u)),
      );
      setToast({ type: "success", message: `Admin granted to ${user.name ?? firstNameFromEmail(user.email)}` });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to grant admin." });
    } finally {
      setBusyEmail(null);
    }
  }

  async function revokeAdmin(user: User) {
    setBusyEmail(user.email);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setUsers((prev) =>
        prev.map((u) => (u.email === user.email ? { ...u, is_admin: false } : u)),
      );
      setToast({ type: "success", message: `Admin removed from ${user.name ?? firstNameFromEmail(user.email)}` });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to revoke admin." });
    } finally {
      setBusyEmail(null);
      setPendingRevoke(null);
    }
  }

  function handleCheckboxChange(user: User, checked: boolean) {
    if (checked) {
      grantAdmin(user);
    } else {
      setPendingRevoke(user);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="h-6 w-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700 font-medium mb-3">{fetchError}</p>
        <button
          onClick={loadUsers}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#007BBA" }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
        <p className="text-sm font-medium text-gray-900">No users yet</p>
        <p className="mt-1 text-sm text-gray-500">Users appear here after their first login.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Name
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">
                Email
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">
                Last Login
              </th>
              <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 w-24">
                Admin
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => {
              const isOwner = user.email === OWNER_EMAIL;
              const isBusy = busyEmail === user.email;

              return (
                <tr key={user.email} className="transition hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">
                      {user.name ?? firstNameFromEmail(user.email)}
                    </p>
                    <p className="text-xs text-gray-400 sm:hidden truncate max-w-[180px]">{user.email}</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">
                    {user.email}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 hidden md:table-cell whitespace-nowrap">
                    {formatDate(user.last_login)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {isOwner ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          type="checkbox"
                          checked
                          disabled
                          className="h-4 w-4 cursor-not-allowed rounded accent-blue-600"
                          title="Owner — cannot remove admin"
                        />
                        <span className="text-[10px] font-medium text-gray-400">Owner</span>
                      </div>
                    ) : isBusy ? (
                      <div className="flex justify-center">
                        <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      </div>
                    ) : (
                      <input
                        type="checkbox"
                        checked={user.is_admin}
                        onChange={(e) => handleCheckboxChange(user, e.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded accent-blue-600"
                        title={user.is_admin ? "Click to remove admin" : "Click to grant admin"}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirm revoke dialog */}
      {pendingRevoke && (
        <ConfirmDialog
          user={pendingRevoke}
          onConfirm={() => revokeAdmin(pendingRevoke)}
          onCancel={() => setPendingRevoke(null)}
          busy={busyEmail === pendingRevoke.email}
        />
      )}

      {/* Toast */}
      <Toast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
