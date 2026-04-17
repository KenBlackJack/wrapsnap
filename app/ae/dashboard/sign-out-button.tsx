"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1"
      style={{ color: "#004876", borderColor: "#004876" }}
    >
      Sign Out
    </button>
  );
}
