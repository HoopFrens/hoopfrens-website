export const headquartersLoginRoute = "/admin/login";

export async function completeHeadquartersSignOut(
  signOutUser: () => Promise<void>,
  redirect: (path: string) => void,
) {
  await signOutUser();
  redirect(headquartersLoginRoute);
}
