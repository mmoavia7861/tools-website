import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  browserSessionPersistence,
  setPersistence,
  getIdTokenResult,
  reload,
  signOut,
  onIdTokenChanged,
  type User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  getDocs,
  getDocsFromServer,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Initialize Firestore with explicit database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
// Admin authentication uses Firebase email/password only; no Google popup provider.

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo: currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Read-only health probe against the same named Firestore database used by
 * the public CMS and the private admin inbox. A backend /api/health 200 is NOT
 * proof that Firebase Security Rules permit Firestore reads.
 *
 * These checks read only; no probe documents or test messages are created.
 */
export type FirestoreConnectionResult = {
  ok: boolean;
  publicRead: boolean;
  adminRead: boolean;
  code: string;
  detail: string;
  databaseId: string;
};

const connectionResult = (
  publicRead: boolean, adminRead: boolean, code: string, detail: string
): FirestoreConnectionResult => ({
  ok: publicRead && adminRead, publicRead, adminRead, code, detail,
  databaseId: firebaseConfig.firestoreDatabaseId
});

function explainConnectionError(error: unknown, context: 'public' | 'admin'): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code).replace(/^firestore\//, '') : 'unknown';
  switch (code) {
    case 'permission-denied':
      return context === 'admin'
        ? 'Permission denied for owner inquiry reads. Verify this named database has the deployed OTP-only Firestore Rules and that your Firebase custom-token session has the admin claim.'
        : 'Permission denied for public CMS reads. Verify the Firestore Rules have been published to the configured named database.';
    case 'unauthenticated':
      return 'Firebase session is no longer valid. Sign out, then log in and complete your email OTP again.';
    case 'not-found':
      return 'The configured named Firestore database may not exist in this Firebase project. Check the exact database ID.';
    case 'failed-precondition':
      return 'Firestore query could not execute. Verify the configured database, database state and required indexes.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'Firestore is temporarily unreachable. Check your network, browser blockers and Firebase service availability.';
    case 'resource-exhausted':
      return 'Firestore quota or rate limits may have been reached. Review Firebase usage.';
    default:
      return 'Firestore check failed (' + code.slice(0, 50) + '). Inspect the browser console and Firestore settings without sharing credentials.';
  }
}

/** Use only after the owner has finished server-verified email OTP login. */
export async function diagnoseAdminFirestore(): Promise<FirestoreConnectionResult> {
  // A missing document is acceptable: a successful server get proves access.
  try {
    await getDocFromServer(doc(db, 'site_content', 'homepage'));
  } catch (error) {
    return connectionResult(false, false, 'public-read-failed', explainConnectionError(error, 'public'));
  }

  try {
    const current = auth.currentUser;
    if (!current) {
      return connectionResult(true, false, 'signed-out', 'Sign in and complete the email OTP before testing owner-only Firestore reads.');
    }
    const token = await getIdTokenResult(current);
    if (current.email?.toLowerCase() !== 'moaviah760@gmail.com' ||
        token.signInProvider !== 'custom' || token.claims.toolscresta_otp !== true) {
      return connectionResult(true, false, 'otp-required', 'Complete the verified-owner email OTP step to read private Firestore collections.');
    }
    // Empty inbox is success too; no private message content is returned to UI.
    await getDocsFromServer(query(collection(db, 'contact_messages'), limit(1)));
    return connectionResult(true, true, 'connected', 'Public CMS and owner-only inquiry reads are both authorized by Firestore.');
  } catch (error) {
    return connectionResult(true, false, 'admin-read-failed', explainConnectionError(error, 'admin'));
  }
}

/** Historical public test kept for callers that only expect a boolean. */
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'site_content', 'homepage'));
    return true;
  } catch {
    return false;
  }
}

export {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  browserSessionPersistence,
  setPersistence,
  getIdTokenResult,
  reload,
  signOut,
  onIdTokenChanged,
  getDocFromServer,
  doc,
  collection,
  getDocs,
  getDocsFromServer,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  type User
};
