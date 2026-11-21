import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  Activity, Building2, ChevronsUpDown, Compass, Factory, Gift, Home, LogOut, Map, Moon, Plug, Siren, Sparkles, Sun, Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useApi } from "@/lib/api";
import { timeS } from "@/lib/format";
import { useLogout, useMe, useSwitch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { DemoGuide } from "./DemoGuide";
import { ErrorBoundary } from "./ErrorBoundary";
import { LiveDot } from "./ui";

const NAV = {
  household: [
    { to: "/app/accueil", label: "Accueil", icon: Home },
    { to: "/app/appareils", label: "Appareils", icon: Plug },
    { to: "/app/analyse", label: "Analyse IA", icon: Sparkles, badge: true },
    { to: "/app/recompenses", label: "Récompenses", icon: Gift },
    { to: "/app/explorer", label: "Explorer", icon: Compass },
  ],
  company: [
    { to: "/app/entreprise", label: "Entreprise", icon: Factory },
    { to: "/app/accueil", label: "Énergie", icon: Activity },
    { to: "/app/appareils", label: "Équipements", icon: Plug },
    { to: "/app/analyse", label: "Analyse IA", icon: Sparkles, badge: true },
    { to: "/app/explorer", label: "Explorer", icon: Compass },
  ],
  steg: [
    { to: "/app/steg", label: "Réseau", icon: Map, end: true },
    { to: "/app/steg/batiments", label: "Bâtiments", icon: Building2 },
    { to: "/app/steg/incidents", label: "Incidents", icon: Siren, badge: true },
    { to: "/app/steg/pointe", label: "Pointe", icon: Activity },
    { to: "/app/comparer", label: "Tunisie–Japon", icon: Compass },
  ],
};

function useDark(): [boolean, () => void] {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch { /* private mode */ }
  }, [dark]);
  return [dark, () => setDark((d) => !d)];
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img src="/static/mieruka/mieruka-app-icon-v8-rounded.svg" alt="" className="size-8 rounded-[10px]" />
      <span className="text-[17px] font-semibold tracking-tight">Mieruka</span>
    </div>
  );
}

export function Shell() {
  const { data: me } = useMe();
  const role = me?.user?.role;
  const items = role === "steg" ? NAV.steg : role === "entreprise" ? NAV.company : NAV.household;
  const { data: live } = useApi<any>("live", { refetch: 2500 });
  const switchTo = useSwitch();
  const logout = useLogout();
  const [dark, toggleDark] = useDark();
  const loc = useLocation();
  const alerts = live?.open_alerts ?? live?.open ?? 0;
  const sim = live?.source !== "reelle";
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-card px-3 py-5 lg:flex">
        <NavLink to="/" className="px-2"><Logo /></NavLink>
        <nav className="mt-8 grid gap-0.5">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={(it as any).end}
              className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium text-ink-2 transition hover:bg-muted hover:text-ink", isActive && "bg-muted text-ink")}>
              <it.icon className="size-[18px]" />{it.label}
              {it.badge && alerts > 0 && <span className="ml-auto rounded-full bg-bad px-1.5 text-[11px] font-semibold text-white tabular">{alerts}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto grid gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-ink-2">
            <LiveDot />
            <span className="tabular">{live?.now ? timeS(live.now) : "--:--:--"}</span>
            <span className="ml-auto">{sim ? "Simulé" : "Capteurs"}</span>
          </div>
          <AccountMenu me={me} switchTo={switchTo} logout={logout} dark={dark} toggleDark={toggleDark} />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-lg lg:hidden">
        <NavLink to="/"><Logo /></NavLink>
        <div className="flex items-center gap-2 text-xs text-ink-2"><LiveDot /><span className="tabular">{live?.now ? timeS(live.now) : ""}</span>
          <AccountMenu compact me={me} switchTo={switchTo} logout={logout} dark={dark} toggleDark={toggleDark} /></div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <ErrorBoundary key={loc.pathname}><Outlet /></ErrorBoundary>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={(it as any).end}
            className={({ isActive }) => cn("relative flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-medium text-ink-3", isActive && "text-ink")}>
            <it.icon className="size-5" />{it.label}
            {it.badge && alerts > 0 && <span className="absolute right-[22%] top-1.5 size-2 rounded-full bg-bad" />}
          </NavLink>
        ))}
      </nav>
      <DemoGuide />
    </div>
  );
}

function AccountMenu({ me, switchTo, logout, dark, toggleDark, compact }: any) {
  const u = me?.user;
  const roles: Record<string, string> = { foyer: "Foyer", etudiant: "Étudiant", famille: "Famille", entreprise: "Entreprise", steg: "STEG" };
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        {compact ? (
          <button className="grid size-8 place-items-center rounded-full bg-ink text-[11px] font-semibold text-bg">{u?.name?.[0]}</button>
        ) : (
          <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted">
            <span className="grid size-9 place-items-center rounded-full bg-ink text-xs font-semibold text-bg">{u?.name?.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}</span>
            <span className="min-w-0 flex-1"><b className="block truncate text-sm font-medium">{u?.name}</b><span className="text-xs text-ink-3">{roles[u?.role] || ""}</span></span>
            <ChevronsUpDown className="size-4 text-ink-3" />
          </button>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content side={compact ? "bottom" : "top"} align="end" sideOffset={8} className="z-50 w-60 rounded-xl border border-line bg-card p-1.5 shadow-xl">
          <Menu.Label className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">Comptes de démo</Menu.Label>
          {me?.demo.map((d: any) => (
            <Menu.Item key={d.role} onSelect={() => switchTo(d.role)} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted">
              {d.name}<span className="text-xs text-ink-3">{roles[d.role]}</span>
            </Menu.Item>
          ))}
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Item onSelect={toggleDark} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}{dark ? "Thème clair" : "Thème sombre"}
          </Menu.Item>
          {u?.role !== "steg" && (
            <Menu.Item asChild><NavLink to="/app/profil" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted"><Zap className="size-4" />Profil et contrat</NavLink></Menu.Item>
          )}
          <Menu.Item onSelect={logout} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-bad outline-none data-[highlighted]:bg-muted">
            <LogOut className="size-4" />Déconnexion
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
