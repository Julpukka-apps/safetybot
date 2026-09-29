export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; message?: string };
  if (err.name === "TypeError") return true;
  const message = err.message || "";
  return /failed to fetch|load failed|networkerror|network request failed/i.test(message);
}

/** True only when this browser can get an HTTP response from the app. */
export async function isReachable(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  try {
    const response = await fetch("/api/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    return response.status > 0;
  } catch {
    return false;
  }
}
