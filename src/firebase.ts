import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser, Auth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, getDocFromServer, Firestore } from 'firebase/firestore';

let app: FirebaseApp;
export let auth: Auth;
export let db: Firestore;
export const googleProvider = new GoogleAuthProvider();

export async function initFirebase() {
  if (app) return { auth, db };

  try {
    const response = await fetch('/api/config/firebase');
    const config = await response.json();

    if (!config.apiKey) {
      throw new Error('Firebase configuration not found on server. Please ensure you have set FIREBASE_API_KEY, FIREBASE_PROJECT_ID, etc. in your Settings menu.');
    }

    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app, config.firestoreDatabaseId || '(default)');

    // Run connection test
    testConnection();

    return { auth, db };
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
  }
}

// Operation types for error handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

/**
 * Standardized error handler for Firestore operations
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (!auth) throw error; // Fallback if auth is not ready
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Test connection to Firestore
 */
export async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}

export { signInWithPopup, signOut, onAuthStateChanged };
export type { FirebaseUser };
