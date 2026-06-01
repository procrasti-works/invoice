import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isAuthRoute = createRouteMatcher([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

const isProtectedRoute = createRouteMatcher([
  "/admin(.*)",
  "/dashboard(.*)",
  "/onboarding(.*)",
]);

const authPaths = ["/login", "/signup", "/forgot-password", "/reset-password"];

function requestPath(request: { nextUrl: { pathname: string; search: string } }) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

function loginPathFor(request: { nextUrl: { pathname: string; search: string } }) {
  return `/login?next=${encodeURIComponent(requestPath(request))}`;
}

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  if (authPaths.some((path) => value === path || value.startsWith(`${path}?`))) {
    return "/dashboard";
  }

  return value;
}

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isAuthenticated = await convexAuth.isAuthenticated();

  if (isProtectedRoute(request) && !isAuthenticated) {
    return nextjsMiddlewareRedirect(request, loginPathFor(request));
  }

  if (isAuthRoute(request) && isAuthenticated) {
    return nextjsMiddlewareRedirect(
      request,
      safeNextPath(request.nextUrl.searchParams.get("next")),
    );
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/auth(.*)"],
};
