"use client";

import { useEffect } from "react";

/** Registra o service worker que mostra a página "sem internet". */
export function RegistrarSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
