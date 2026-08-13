import { type NextRequest } from "next/server";
import { updateSession } from "./app/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|apple-touch-icon.png|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|gif)$).*)",
  ],
};
