import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import SignOutButton from "./sign-out-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <section className="w-full max-w-xl rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Welcome, {session.user.name ?? "User"}!
        </h1>
        <p className="mb-1 text-sm text-gray-600">
          <span className="font-medium text-gray-800">Name:</span>{" "}
          {session.user.name ?? "Not available"}
        </p>
        <p className="mb-6 text-sm text-gray-600">
          <span className="font-medium text-gray-800">Email:</span>{" "}
          {session.user.email ?? "Not available"}
        </p>
        <SignOutButton />
      </section>
    </main>
  );
}
