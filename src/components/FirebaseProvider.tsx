import * as React from 'react';
import type { FirebaseUser } from '../firebase';
import { initFirebase, onAuthStateChanged, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  credits: number;
  tier: string;
  role: 'user' | 'admin';
  pendingUpgradeId?: string | null;
  pendingTierId?: string | null;
  createdAt: any;
}

interface FirebaseContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  isAuthReady: boolean;
  firebaseReady: boolean;
}

const FirebaseContext = React.createContext<FirebaseContextType | undefined>(undefined);

export function useFirebase() {
  const context = React.useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

const ADMIN_EMAILS: string[] = [];

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<FirebaseUser | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [firebaseReady, setFirebaseReady] = React.useState(false);

  React.useEffect(() => {
    let unsubscribeAuth: (() => void) | null = null;
    let unsubscribeProfile: (() => void) | null = null;

    const setup = async () => {
      try {
        const { auth, db } = await initFirebase();
        setFirebaseReady(true);

        unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
          setUser(currentUser);
          setIsAuthReady(true);
          
          if (currentUser) {
            setProfileLoading(true);
            // Sync user profile to Firestore
            const userRef = doc(db, 'users', currentUser.uid);
            try {
              const userDoc = await getDoc(userRef);
              if (!userDoc.exists()) {
                // Check for guest credits to sync
                const guestCreditsStr = localStorage.getItem('guest_credits');
                const guestCredits = guestCreditsStr ? parseInt(guestCreditsStr) : 5;
                
                const initialProfile = {
                  uid: currentUser.uid,
                  email: currentUser.email,
                  displayName: currentUser.displayName,
                  photoURL: currentUser.photoURL,
                  credits: ADMIN_EMAILS.includes(currentUser.email || '') ? 999 : (isNaN(guestCredits) ? 5 : Math.max(0, Math.min(guestCredits, 5))), 
                  tier: ADMIN_EMAILS.includes(currentUser.email || '') ? 'pro' : 'free',
                  role: ADMIN_EMAILS.includes(currentUser.email || '') ? 'admin' : 'user',
                  createdAt: serverTimestamp(),
                };
                await setDoc(userRef, initialProfile);
                // Clear guest credits after sync
                localStorage.removeItem('guest_credits');
              } else if (ADMIN_EMAILS.includes(currentUser.email || '')) {
                // Refresh admin credits and role on sign in
                await setDoc(userRef, { 
                  credits: 999, 
                  role: 'admin',
                  tier: 'pro',
                  lastLogin: serverTimestamp() 
                }, { merge: true });
              }

              // Listen for profile changes
              unsubscribeProfile = onSnapshot(userRef, (doc) => {
                if (doc.exists()) {
                  setProfile(doc.data() as UserProfile);
                }
                setProfileLoading(false);
              }, (error) => {
                handleFirestoreError(error, OperationType.GET, 'users/' + currentUser.uid);
                setProfileLoading(false);
              });

            } catch (error) {
              console.error("Error syncing user profile:", error);
              setProfileLoading(false);
            }
          } else {
            setProfile(null);
            setProfileLoading(false);
            if (unsubscribeProfile) {
              unsubscribeProfile();
              unsubscribeProfile = null;
            }
          }
          
          setLoading(false);
        });
      } catch (error) {
        console.error("Firebase setup failed:", error);
        setLoading(false);
      }
    };

    setup();

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <FirebaseContext.Provider value={{ user, profile, loading, profileLoading, isAuthReady, firebaseReady }}>
      {!firebaseReady && loading ? (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#EFBB76] border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Initializing Application...</p>
          </div>
        </div>
      ) : children}
    </FirebaseContext.Provider>
  );
}

/**
 * Error Boundary to catch and display Firestore errors
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        // Try to parse JSON error if it's a Firestore error
        const parsed = JSON.parse(this.state.error?.message || '{}');
        if (parsed.error) {
          errorMessage = `Database Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path}`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-white text-black p-8">
          <div className="max-w-md w-full bg-black/5 backdrop-blur-xl border border-black/10 rounded-[2rem] p-8 text-center">
            <h2 className="text-2xl font-serif font-bold mb-4 text-red-500 uppercase tracking-widest">Application Error</h2>
            <p className="text-black/60 mb-6 text-sm font-medium leading-relaxed">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-[#EFBB76] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#DBA762] transition-all shadow-lg"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
