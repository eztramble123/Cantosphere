import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { onboardUser } from "@/lib/canton/onboard-user";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      username?: string | null;
    };
  }

  interface User {
    role: UserRole;
    username?: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db) as never,
  providers: [Google, GitHub],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      try {
        await onboardUser(
          user.id,
          user.role ?? "VALIDATOR",
          user.name ?? user.email ?? "User"
        );
      } catch (error) {
        console.error(
          "[Canton] Party allocation failed for user",
          user.id,
          error
        );
        // Non-blocking — user can still sign in, party gets allocated on retry
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as UserRole;
        session.user.username = token.username as string | null;
      }
      return session;
    },
  },
});
