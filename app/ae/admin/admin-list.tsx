"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type SessionStatus = "pending" | "active" | "complete" | "expired" | "archived";

export interface AdminSession {
  id: string;
  client_name: string;
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

export default function AdminList({ sessions }: { sessions: AdminSession[] }) {
  const [search, setSearch] = useState("");

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
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
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
            <SessionCard key={s.id} s={s} showAE />
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
                  <SessionCard key={s.id} s={s} showAE={false} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ s, showAE }: { s: AdminSession; showAE: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-gray-900">{s.client_name}</p>
        {s.vehicle_description && (
          <p className="truncate text-sm text-gray-500 mt-0.5">{s.vehicle_description}</p>
        )}
        {showAE && (
          <p className="text-xs text-gray-400 mt-0.5">{firstNameFromEmail(s.created_by)}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[s.status]}`}>
            {s.status}
          </span>
          <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
        </div>
      </div>
      <Link
        href={`/ae/sessions/${s.id}`}
        className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
      >
        View
      </Link>
    </li>
  );
}
