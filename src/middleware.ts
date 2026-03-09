import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const protectedRoutes = ["/validator", "/developer", "/admin"];
const authRoutes = ["/login", "/register"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;
  const userRole = req.auth?.user?.role;

  // Allow authenticated users without a username to access /register for onboarding
  const username = req.auth?.user?.username;
  if (isAuthenticated && pathname.startsWith("/register")) {
    if (username) {
      // Already onboarded, redirect to dashboard
      const dashboardRoute =
        userRole === "DEVELOPER" ? "/developer" : "/validator";
      return NextResponse.redirect(new URL(dashboardRoute, req.url));
    }
    return NextResponse.next();
  }

  // Redirect logged-in users away from login page
  if (isAuthenticated && pathname.startsWith("/login")) {
    const dashboardRoute =
      userRole === "DEVELOPER" ? "/developer" : "/validator";
    return NextResponse.redirect(new URL(dashboardRoute, req.url));
  }

  // Protect dashboard routes
  if (
    !isAuthenticated &&
    protectedRoutes.some((r) => pathname.startsWith(r))
  ) {
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url)
    );
  }

  // Role-based access control
  if (pathname.startsWith("/developer") && userRole !== "DEVELOPER" && userRole !== "ADMIN") {
    return NextResponse.redirect(new URL("/validator", req.url));
  }

  if (pathname.startsWith("/admin") && userRole !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
