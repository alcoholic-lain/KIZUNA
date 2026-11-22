import { createContext, useContext } from "react";
import type { MaterialLibrary } from "./library";

export const MaterialsContext = createContext<MaterialLibrary | null>(null);

export function useMats(): MaterialLibrary {
  const lib = useContext(MaterialsContext);
  if (!lib) throw new Error("useMats must be used inside <MaterialsProvider>");
  return lib;
}