import type { NextRequest } from "next/server";
import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";

// Optimistic auth gate only (Next 16 proxy). Real enforcement lives in
// server layouts and server actions via lib/auth.ts — never trust this alone.
export default function proxy(request: NextRequest) {
  return withAuth(request, { isReturnToCurrentPage: true });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/friends/:path*",
    "/lobbies/:path*",
    "/lobby/:path*",
    "/player/:path*",
    "/settings/:path*",
  ],
};
