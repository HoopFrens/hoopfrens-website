export const accessDeniedCopy = {
  title: "Access Restricted",
  body: "Your account has been authenticated, but it is not authorized to access Hoop Frens Headquarters.",
  help: "If you believe this is an error, contact a Headquarters administrator.",
} as const;

export function collectionManagerKey(collectionName: string) {
  return `admin-collection-${collectionName}`;
}
