"use client";

import { useState } from "react";
import Link from "next/link";

type SessionStatus = "pending" | "active" | "complete" | "expired" | "archived";

interface ArchivedSession {
  id: string;
  client_name: string;
  vehicle_description: string | null;
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ArchiveList({ sessions }: { sessions: ArchivedSession[] }) {
  const [search, setSearch] = useState("");

  const filtered = sessions.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.client_name.toLowerCase().includes(q) ||
      (s.vehicle_description ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Search bar */}
      <div className="mb-5 relative">
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
          placeholder="Search by client name or vehicle…"
          className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{ "--tw-ring-color": "#007BBA" } as React.CSSProperties}
        />
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
          <svg className="h-9 w-9 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <p className="text-sm font-medium text-gray-900">No archived sessions</p>
          <p className="mt-1 text-sm text-gray-400">Sessions are automatically archived after 30 days.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center">
          <p className="text-sm text-gray-500">No sessions match &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm opacity-80"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-gray-700">{s.client_name}</p>
                {s.vehicle_description && (
                  <p className="truncate text-sm text-gray-400 mt-0.5">{s.vehicle_description}</p>
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
                className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
