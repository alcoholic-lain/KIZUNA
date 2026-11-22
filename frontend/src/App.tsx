import { type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { Shell } from "./components/Shell";
import { Skeleton } from "./components/ui";
import { homeFor, useMe } from "./lib/session";
import Company from "./pages/Company";
import Devices from "./pages/Devices";
import { Compare, Explore, Flows, Learn, Profile } from "./pages/Explore";
import Home from "./pages/Home";
import Insights from "./pages/Insights";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Rewards from "./pages/Rewards";
import { StegBuilding, StegBuildings, StegHousehold, StegIncidents, StegNetwork, StegPeak, StegRegistrations } from "./pages/Steg";

function Guard({ roles, children }: { roles?: string[]; children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  if (isLoading || !me) return <div className="p-10"><Skeleton className="h-40" /></div>;
  if (!me.authenticated || !me.user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(me.user.role)) return <Navigate to={homeFor(me.user.role)} replace />;
  return <>{children}</>;
}

function LegacyAtlasRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/app/steg", search, hash }} replace />;
}

const H = ["foyer", "etudiant", "famille", "entreprise"];

export default function App() {
  const { data: me } = useMe();
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<Guard><Shell /></Guard>}>
        <Route index element={<Navigate to={homeFor(me?.user?.role)} replace />} />
        <Route path="accueil" element={<Guard roles={H}><Home /></Guard>} />
        <Route path="appareils" element={<Guard roles={H}><Devices /></Guard>} />
        <Route path="analyse" element={<Guard roles={H}><Insights /></Guard>} />
        <Route path="recompenses" element={<Guard roles={H}><Rewards /></Guard>} />
        <Route path="explorer" element={<Guard roles={H}><Explore /></Guard>} />
        <Route path="flux" element={<Guard roles={H}><Flows /></Guard>} />
        <Route path="apprendre" element={<Guard roles={H}><Learn /></Guard>} />
        <Route path="profil" element={<Guard roles={H}><Profile /></Guard>} />
        <Route path="comparer" element={<Compare />} />
        <Route path="entreprise" element={<Guard roles={["entreprise"]}><Company /></Guard>} />
        <Route path="steg" element={<Guard roles={["steg"]}><StegNetwork /></Guard>} />
        <Route path="steg/batiments" element={<Guard roles={["steg"]}><StegBuildings /></Guard>} />
        <Route path="steg/batiments/:code" element={<Guard roles={["steg"]}><StegBuilding /></Guard>} />
        <Route path="steg/foyers/:code" element={<Guard roles={["steg"]}><StegHousehold /></Guard>} />
        <Route path="steg/incidents" element={<Guard roles={["steg"]}><StegIncidents /></Guard>} />
        <Route path="steg/enregistrements" element={<Guard roles={["steg"]}><StegRegistrations /></Guard>} />
        <Route path="steg/atlas" element={<LegacyAtlasRedirect />} />
        <Route path="steg/pointe" element={<Guard roles={["steg"]}><StegPeak /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
