import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, useApi } from "./api";

export type Me = {
  authenticated: boolean;
  demo: { role: string; name: string; email: string }[];
  password: string;
  categories: { code: string; label: string; room: string; watts: number }[];
  user?: {
    name: string; email: string; role: string; city: string; onboarded: boolean;
    household: { code: string; label: string; building: string; region: string; goal: number; occupants: number; kva: number } | null;
  };
};

export function useMe() {
  return useApi<Me>("auth/me");
}

export const homeFor = (role?: string) => (role === "steg" ? "/app/steg" : role === "entreprise" ? "/app/entreprise" : "/app/accueil");

export function useSwitch() {
  const qc = useQueryClient();
  const nav = useNavigate();
  return async (role: string, to?: string) => {
    const me = await api<Me>("auth/demo", { method: "POST", body: { role } });
    qc.clear();
    qc.setQueryData(["auth/me"], me);
    nav(to || homeFor(me.user?.role));
  };
}

export function useLogout() {
  const qc = useQueryClient();
  const nav = useNavigate();
  return async () => {
    await api("auth/logout", { method: "POST" }).catch(() => {});
    qc.clear();
    nav("/login");
  };
}
