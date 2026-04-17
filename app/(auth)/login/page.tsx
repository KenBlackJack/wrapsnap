"use client";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-lg">
        {/* WrapSnap logo */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/wrapsnap-logo.jpg"
            alt="WrapSnap"
            width={280}
            height={80}
            className="w-full"
            style={{ maxWidth: 280, height: "auto" }}
            priority
          />
          <p className="mt-2 text-xs text-gray-400 tracking-wide">by Advertising Vehicles</p>
        </div>

        <p className="mb-6 text-center text-sm text-gray-500">
          Sign in with your Advertising Vehicles Microsoft account.
        </p>

        <button
          type="button"
          onClick={() => signIn("azure-ad", { callbackUrl: "/ae/dashboard" })}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#004876] focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{ backgroundColor: "#007BBA" }}
        >
          {/* Microsoft M icon */}
          <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}
