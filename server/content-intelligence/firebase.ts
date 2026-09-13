import "server-only";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { IntelligenceError } from "@/domain/content-intelligence/types";

export function serverFirebase() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new IntelligenceError("server-configuration-required", 503);
  if (process.env.NODE_ENV === "production" && (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
    throw new IntelligenceError("server-configuration-required", 503);
  }
  const app = getApps().find(app => app.name === "hoopfrens-content-intelligence")
    || initializeApp({ projectId, credential: applicationDefault() }, "hoopfrens-content-intelligence");
  return { db: getFirestore(app), auth: getAuth(app) };
}
export function authenticationFailure(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const denied = ["auth/argument-error", "auth/invalid-argument", "auth/invalid-id-token", "auth/id-token-expired", "auth/id-token-revoked", "auth/user-disabled", "auth/user-not-found"];
  return typeof code === "string" && denied.includes(code)
    ? new IntelligenceError("sign-in-required", 401)
    : new IntelligenceError("server-connection-unavailable", 503);
}
export async function authenticate(request: Request) {
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ") || bearer.length > 8192) throw new IntelligenceError("sign-in-required", 401);
  const { auth, db } = serverFirebase();
  let uid: string;
  try { uid = (await auth.verifyIdToken(bearer.slice(7), true)).uid; }
  catch (error) { throw authenticationFailure(error); }
  const profile = await db.collection("users").doc(uid).get();
  if (profile.data()?.role !== "admin") throw new IntelligenceError("administrator-required", 403);
  return uid;
}
