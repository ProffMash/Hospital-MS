// Accept either User or Staff shapes — runtime only checks for a 'role' property.
export function isRole(user: any | null | undefined, role: string) {
  if (!user || !user.role) return false;
  return String(user.role).toLowerCase() === String(role).toLowerCase();
}

export function roleIncludes(user: any | null | undefined, substring: string) {
  if (!user || !user.role) return false;
  return String(user.role).toLowerCase().includes(String(substring).toLowerCase());
}
