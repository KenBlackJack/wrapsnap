"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewSessionPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = e.currentTarget;
    const vehicleDescription = (form.elements.namedItem("vehicle_description") as HTMLInputElement).value.trim();
    const body = {
      client_name: (form.elements.namedItem("client_name") as HTMLInputElement).value.trim(),
      client_phone: (form.elements.namedItem("client_phone") as HTMLInputElement).value.trim(),
      vehicle_description: vehicleDescription || undefined,
      expires_in_hours: Number((form.elements.namedItem("expires_in_hours") as HTMLSelectElement).value),
    };

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }

      router.push("/ae/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header style={{ backgroundColor: "#004876" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Link
              href="/ae/dashboard"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
              aria-label="Back to dashboard"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>

            <div className="flex flex-col justify-center">
              <Image
                src="/wrapsnap-logo.jpg"
                alt="WrapSnap"
                width={140}
                height={36}
                style={{ height: 36, width: "auto" }}
                priority
              />
              <p className="text-[11px] text-white/60 mt-0.5">Powered by Advertising Vehicles</p>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">New Session</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter the client&apos;s details. They&apos;ll receive a text with a secure link and PIN.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          {/* Client name */}
          <div>
            <label htmlFor="client_name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Client name
            </label>
            <input
              id="client_name"
              name="client_name"
              type="text"
              required
              autoComplete="off"
              placeholder="Jane Smith"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Client phone */}
          <div>
            <label htmlFor="client_phone" className="block text-sm font-medium text-gray-700 mb-1.5">
              Client mobile number
            </label>
            <input
              id="client_phone"
              name="client_phone"
              type="tel"
              required
              autoComplete="off"
              placeholder="(555) 867-5309"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Vehicle description */}
          <div>
            <label htmlFor="vehicle_description" className="block text-sm font-medium text-gray-700 mb-1.5">
              Vehicle description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="vehicle_description"
              name="vehicle_description"
              type="text"
              autoComplete="off"
              placeholder='e.g. "Service Route Van #3"'
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Expiry */}
          <div>
            <label htmlFor="expires_in_hours" className="block text-sm font-medium text-gray-700 mb-1.5">
              Session expiry
            </label>
            <select
              id="expires_in_hours"
              name="expires_in_hours"
              defaultValue="24"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
              <option value="72">72 hours</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60"
            style={{ backgroundColor: "#007BBA" }}
          >
            {pending ? "Creating…" : "Create Session & Send Text"}
          </button>
        </form>
      </main>
    </div>
  );
}
