import { useEffect, useMemo, type ReactNode } from "react";
import { createLibrary } from "./library";
import { MaterialsContext } from "./useMats";

/** Creates the shared material library once per scene and disposes it on unmount. */
export function MaterialsProvider({ children }: { children: ReactNode }) {
  const lib = useMemo(createLibrary, []);
  useEffect(() => () => lib.dispose(), [lib]);
  return <MaterialsContext.Provider value={lib}>{children}</MaterialsContext.Provider>;
}