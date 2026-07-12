export const accessDeniedCopy = {
  eyebrow: "Authorized Access Required",
  title: "Access Restricted",
  body: "Your account has been authenticated successfully, but you do not have permission to access Hoop Frens Headquarters.",
  help: "If you believe this is an error, please contact a Headquarters administrator.",
} as const;

export function collectionManagerKey(collectionName: string) {
  return `admin-collection-${collectionName}`;
}
