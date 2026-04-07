import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Folder as FolderIcon, User, LogOut, LogIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFirebase } from './FirebaseProvider';
import { auth, googleProvider, signInWithPopup, signOut } from '../firebase';

interface LayoutProps {
  children: React.ReactNode;
}

const PAGE_SEQUENCE = [
  '/',
  '/design',
  '/visualizer',
  '/design-detail',
  '/pricing',
  '/samples',
  '/checkout',
  '/wishlist',
  '/dashboard',
  '/tiers'
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading } = useFirebase();
  
  const currentIndex = PAGE_SEQUENCE.indexOf(location.pathname);
  const prevPage = currentIndex > 0 ? PAGE_SEQUENCE[currentIndex - 1] : null;
  const nextPage = currentIndex < PAGE_SEQUENCE.length - 1 ? PAGE_SEQUENCE[currentIndex + 1] : null;

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Tiers', path: '/tiers' },
    { name: 'Dashboard', path: '/dashboard' },
  ];

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-[#EFBB76] selection:text-black overflow-x-hidden flex flex-col">
      <nav className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b border-black/5 z-40 px-6 sm:px-12 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
              <img 
                src="https://cdn.shopify.com/s/files/1/0718/2712/8409/files/logo_png.png?v=1774858443" 
                alt="Opul Mkt Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tighter leading-none">OPUL MKT INC</h1>
              <span className="text-[10px] font-bold text-[#EFBB76] tracking-[0.2em] uppercase">Luxury Rugs</span>
            </div>
          </Link>

          <div className="hidden xl:flex items-center gap-1 bg-black/5 p-1 rounded-xl">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg ${
                  location.pathname === item.path 
                    ? 'bg-white text-black shadow-sm' 
                    : 'text-black/40 hover:text-black'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
           {loading ? (
             <div className="w-8 h-8 rounded-full bg-black/5 animate-pulse" />
           ) : user ? (
             <div className="flex items-center gap-4">
               <Link to="/dashboard" className="flex items-center gap-2 p-2 hover:bg-black/5 rounded-full transition-colors">
                 {user.photoURL ? (
                   <img src={user.photoURL} alt={user.displayName || ''} className="w-6 h-6 rounded-full" />
                 ) : (
                   <User className="w-5 h-5" />
                 )}
                 <span className="hidden md:block text-[10px] font-bold uppercase tracking-widest">{user.displayName?.split(' ')[0]}</span>
               </Link>
               <button 
                 onClick={handleLogout}
                 className="p-2 hover:bg-black/5 rounded-full transition-colors"
                 title="Logout"
               >
                 <LogOut className="w-5 h-5" />
               </button>
             </div>
           ) : (
             <button 
               onClick={handleLogin}
               className="btn-secondary flex items-center gap-2 px-4 py-2 text-[10px]"
             >
               <LogIn className="w-4 h-4" />
               Login
             </button>
           )}
           
           {(!user || profile?.tier === 'free') && (
             <Link 
                to="/tiers"
                className="btn-primary px-6 py-3 text-[10px]"
              >
                Upgrade
              </Link>
           )}
        </div>
      </nav>

      <main className="pt-20 flex-grow pb-24">
        {children}
      </main>

      {/* Navigation Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none z-30">
        <div className="max-w-7xl mx-auto flex justify-between pointer-events-auto">
          {prevPage ? (
            <button 
              onClick={() => navigate(prevPage)}
              className="btn-secondary px-6 py-3 text-xs"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back
            </button>
          ) : <div />}

          {nextPage ? (
            <button 
              onClick={() => navigate(nextPage)}
              className="btn-primary px-6 py-3 text-xs"
            >
              Next <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          ) : <div />}
        </div>
      </div>
    </div>
  );
};
