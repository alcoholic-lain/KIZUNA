/** Roles that see the 3D device gallery on the Home page. Foyer, Étudiant and
 * Famille are household profiles: `/api/live` returns each one's own
 * installations (server-side `household_of`), so they share one implementation.
 * Entreprise (which can also open /app/accueil) and STEG are deliberately
 * excluded until they get their own scenes and models. */
export const EXPERIENCE_3D_ROLES: readonly string[] = ["foyer", "etudiant", "famille"];

export const experience3dEnabledFor = (role?: string | null) => !!role && EXPERIENCE_3D_ROLES.includes(role);
