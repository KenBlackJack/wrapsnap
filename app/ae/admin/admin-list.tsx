"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type SessionStatus = "pending" | "active" | "complete" | "expired" | "archived";

export interface AdminSession {
  id: string;
  token: string;
  client_name: string;
  client_phone: string | null;
  vehicle_description: string | null;
  created_by: string;
  status: SessionStatus;
  created_at: string;
}

const STATUS_STYLES: Record<SessionStatus, string> = {
  pending:  "bg-gray-100 text-gray-600",
  active:   "bg-blue-100 text-blue-700",
  complete: "bg-green-100 text-green-700",
  expired:  "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-500",
};

function isSelfScanSession(phone: string | null): boolean {
  const p = (phone ?? "").trim();
  return !p || p === "0000000000";
}

function firstNameFromEmail(email: string): string {
  const local = email.split("@")[0];
  const first = local.split(/[._-]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Session card with 3-dot menu ────────────────────────────────────────────

function SessionCard({
  s,
  showAE,
  onRemove,
}: {
  s: AdminSession;
  showAE: boolean;
  onRemove: (id: string) => void;
}) {
  const inProgress = isSelfScanSession(s.client_phone) && s.status === "pending";
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleArchive() {
    setMenuOpen(false);
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${s.id}`, { method: "PATCH" });
      if (res.ok) onRemove(s.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${s.id}`, { method: "DELETE" });
      if (res.ok) onRemove(s.id);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <li className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-900">{s.client_name}</p>
          {s.vehicle_description && (
            <p className="truncate text-sm text-gray-500 mt-0.5">{s.vehicle_description}</p>
          )}
          {showAE && (
            <p className="text-xs text-gray-400 mt-0.5">by {firstNameFromEmail(s.created_by)}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {inProgress ? (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                In Progress
              </span>
            ) : (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[s.status]}`}>
                {s.status}
              </span>
            )}
            <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href={`/ae/sessions/${s.id}`}
            className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
          >
            View
          </Link>

          {/* ⋯ menu */}
          <div className="relative">
            <button
              type="button"
              disabled={busy}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-40"
              aria-label="Session options"
            >
              {busy ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              )}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={handleArchive}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.8}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                      />
                    </svg>
                    Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.8}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </li>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Delete this session?
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete all photos and estimate data for{" "}
              <strong className="text-gray-700">{s.client_name}</strong>. This
              cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#DC2626" }}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Admin list ───────────────────────────────────────────────────────────────

export default function AdminList({ sessions: initialSessions }: { sessions: AdminSession[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [search, setSearch] = useState("");

  function handleRemove(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.client_name.toLowerCase().includes(q) ||
        (s.vehicle_description ?? "").toLowerCase().includes(q) ||
        s.created_by.toLowerCase().includes(q) ||
        firstNameFromEmail(s.created_by).toLowerCase().includes(q),
    );
  }, [sessions, search]);

  // Group by created_by — preserve insertion order (sessions are pre-sorted by AE then date)
  const groups = useMemo(() => {
    const map = new Map<string, AdminSession[]>();
    for (const s of filtered) {
      const existing = map.get(s.created_by);
      if (existing) existing.push(s);
      else map.set(s.created_by, [s]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const isSearching = search.trim().length > 0;

  return (
    <div>
      {/* Search */}
      <div className="mb-6 relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by client, vehicle, or AE name…"
          className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{ "--tw-ring-color": "#007BBA" } as React.CSSProperties}
        />
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
          <p className="text-sm font-medium text-gray-900">No sessions found</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center">
          <p className="text-sm text-gray-500">No sessions match &ldquo;{search}&rdquo;</p>
        </div>
      ) : isSearching ? (
        /* Flat list when searching — easier to scan across AEs */
        <ul className="space-y-3">
          {filtered.map((s) => (
            <SessionCard key={s.id} s={s} showAE onRemove={handleRemove} />
          ))}
        </ul>
      ) : (
        /* Grouped by AE when not searching */
        <div className="space-y-8">
          {groups.map(([aeEmail, aeSessions]) => (
            <section key={aeEmail}>
              <div className="mb-3 flex items-center gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: "#007BBA" }}
                >
                  {firstNameFromEmail(aeEmail).charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{firstNameFromEmail(aeEmail)}</p>
                  <p className="text-xs text-gray-400 truncate">{aeEmail}</p>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {aeSessions.length} {aeSessions.length === 1 ? "session" : "sessions"}
                </span>
              </div>
              <ul className="space-y-2">
                {aeSessions.map((s) => (
                  <SessionCard key={s.id} s={s} showAE={false} onRemove={handleRemove} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
