import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { getSupabaseClient } from "@/lib/supabase";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
      tenantId: process.env.AZURE_AD_TENANT_ID,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      // Upsert into our users table so every AE appears in the user list.
      // Non-fatal: if the table doesn't exist yet the sign-in still succeeds.
      try {
        const supabase = getSupabaseClient();
        await supabase.from("users").upsert(
          {
            email: user.email,
            name: user.name ?? null,
            last_login: new Date().toISOString(),
          },
          { onConflict: "email" },
        );
      } catch (err) {
        console.error("Auth: users upsert failed (table may not exist yet)", err);
      }
      return true;
    },

    async redirect({ url, baseUrl }) {
      return `${baseUrl}/ae/dashboard`;
    },
  },
};
