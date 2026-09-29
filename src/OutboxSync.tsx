"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { bindFlushNavigate, requestFlush } from "@/outbox-flush";

export function OutboxSync() {
  const router = useRouter();

  useEffect(() => {
    bindFlushNavigate((path) => router.push(path));
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    const run = () => {
      void requestFlush();
    };
    run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [router]);

  return null;
}
