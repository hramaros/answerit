"use client";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

/** État du compte formateur connecté (via le cookie de session). */
export function useAccount() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { ok, data } = await apiGet("/api/auth/me");
    const acc = ok ? data?.account || null : null;
    setAccount(acc);
    setLoading(false);
    return acc;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiPost("/api/auth/logout", {});
    setAccount(null);
  }, []);

  return { account, loading, refresh, setAccount, logout };
}
