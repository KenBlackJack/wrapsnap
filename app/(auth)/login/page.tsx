"use client";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-2 text-center text-2xl font-semibold text-gray-900">
          WrapSnap
        </h1>
        <p className="mb-6 text-center text-sm text-gray-600">
          Sign in with your Advertising Vehicles Microsoft account.
        </p>
        <button
          type="button"
          onClick={() => signIn("azure-ad", { callbackUrl: "/ae/dashboard" })}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}