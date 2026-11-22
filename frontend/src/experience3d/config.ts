/** Roles that see the 3D device gallery. The experiment starts with Foyer only;
 * Étudiant and Famille share the same Home page and data, so enabling them is
 * a one-line change here. Entreprise and STEG need their own scenes. */
export const EXPERIENCE_3D_ROLES: readonly string[] = ["foyer"];

export const experience3dEnabledFor = (role?: string | null) => !!role && EXPERIENCE_3D_ROLES.includes(role);
