import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  FolderPlus, 
  Folder as FolderIcon, 
  Plus, 
  X, 
  Maximize2, 
  Download, 
  ArrowRight,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  ChevronLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SavedDesign, Folder } from '../types';
import { useFirebase } from '../components/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp, orderBy, onSnapshot, limit } from 'firebase/firestore';

import { storage } from '../lib/storage';

export const WishlistPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthReady } = useFirebase();
  const [savedDesigns, setSavedDesigns] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState('default');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady) return;

    let unsubscribeDesigns: () => void;
    let unsubscribeFolders: () => void;

    const loadData = async () => {
      if (user) {
        // Real-time listener for designs
        const designsQuery = query(
          collection(db, 'designs'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        
        unsubscribeDesigns = onSnapshot(designsQuery, (snapshot) => {
          const fetchedDesigns = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toMillis() || Date.now()
          }));
          setSavedDesigns(fetchedDesigns);
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'designs');
        });

        // Real-time listener for folders (projects)
        const foldersQuery = query(
          collection(db, 'projects'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        unsubscribeFolders = onSnapshot(foldersQuery, (snapshot) => {
          const fetchedFolders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setFolders([{ id: 'default', name: 'My Designs' }, ...fetchedFolders]);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'projects');
        });
      } else {
        // Guest fallback
        const saved = await storage.getLarge<any[]>('rug_saved_designs');
        const savedFolders = await storage.getLarge<any[]>('rug_folders');
        setSavedDesigns(saved || []);
        setFolders(savedFolders || [{ id: 'default', name: 'My Designs' }]);
        setLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubscribeDesigns) unsubscribeDesigns();
      if (unsubscribeFolders) unsubscribeFolders();
    };
  }, [user, isAuthReady]);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      if (user) {
        await addDoc(collection(db, 'projects'), {
          userId: user.uid,
          name: newFolderName.trim(),
          createdAt: serverTimestamp(),
          designIds: []
        });
      } else {
        const newFolder: Folder = {
          id: Math.random().toString(36).substr(2, 9),
          name: newFolderName.trim(),
          createdAt: Date.now()
        };
        const updatedFolders = [...folders, newFolder];
        setFolders(updatedFolders);
        await storage.setLarge('rug_folders', updatedFolders);
      }
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  const deleteDesign = async (id: string) => {
    try {
      if (user) {
        await deleteDoc(doc(db, 'designs', id));
      } else {
        const updated = savedDesigns.filter(d => d.id !== id);
        setSavedDesigns(updated);
        await storage.setLarge('rug_saved_designs', updated);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `designs/${id}`);
    }
  };

  const deleteFolder = async (id: string) => {
    if (id === 'default') return;
    
    try {
      if (user) {
        await deleteDoc(doc(db, 'projects', id));
        // Note: Designs are not deleted, just orphaned from this project
      } else {
        const updatedFolders = folders.filter(f => f.id !== id);
        setFolders(updatedFolders);
        await storage.setLarge('rug_folders', updatedFolders);
        
        const updatedDesigns = savedDesigns.filter(d => d.folderId !== id);
        setSavedDesigns(updatedDesigns);
        await storage.setLarge('rug_saved_designs', updatedDesigns);
      }
      if (selectedFolderId === id) setSelectedFolderId('default');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
    }
  };

  const currentFolderDesigns = savedDesigns.filter(d => 
    selectedFolderId === 'default' ? true : d.folderId === selectedFolderId
  );

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#EFBB76]" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-6 py-12"
    >
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-black/40 hover:text-[#EFBB76] transition-colors group mb-8"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back
      </button>

      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-4xl font-serif font-bold text-black mb-2">Your Collections</h1>
          <p className="text-black/40 text-sm font-bold uppercase tracking-widest">Organize and manage your custom rug designs</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-black/5 p-1 rounded-xl mr-4">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black'}`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={() => setIsCreatingFolder(true)}
            className="px-6 py-3 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black/80 transition-all flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" /> New Collection
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* Sidebar: Folders */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-4">Collections</h3>
          <div className="space-y-1">
            {folders.map(folder => (
              <div key={folder.id} className="group flex items-center justify-between">
                <button 
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                    selectedFolderId === folder.id 
                    ? 'bg-[#EFBB76]/10 text-[#EFBB76]' 
                    : 'hover:bg-black/5 text-black/60'
                  }`}
                >
                  <FolderIcon className={`w-4 h-4 ${selectedFolderId === folder.id ? 'text-[#EFBB76]' : 'text-black/20'}`} />
                  {folder.name}
                  <span className="ml-auto text-[10px] opacity-40">
                    {savedDesigns.filter(d => d.folderId === folder.id).length}
                  </span>
                </button>
                {folder.id !== 'default' && (
                  <button 
                    onClick={() => deleteFolder(folder.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-red-500/40 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content: Designs */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {currentFolderDesigns.length > 0 ? (
              <motion.div 
                key={selectedFolderId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8" : "space-y-4"}
              >
                {currentFolderDesigns.map((design) => (
                  <div 
                    key={design.id} 
                    className={`group bg-white border border-black/10 rounded-[2rem] overflow-hidden hover:border-[#EFBB76] transition-all ${viewMode === 'list' ? 'flex items-center p-4 gap-6' : ''}`}
                  >
                    <div className={`relative overflow-hidden ${viewMode === 'list' ? 'w-24 h-24 rounded-xl shrink-0' : 'aspect-square'}`}>
                      <img 
                        src={design.imageUrl} 
                        alt={design.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg transition-colors"><Maximize2 className="w-4 h-4" /></button>
                        <button className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg transition-colors"><Download className="w-4 h-4" /></button>
                      </div>
                    </div>
                    
                    <div className={`p-6 flex-1 ${viewMode === 'list' ? 'p-0' : ''}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-sm font-bold uppercase tracking-widest mb-1">{design.name}</h4>
                          <p className="text-[10px] text-black/40 font-bold uppercase tracking-widest">
                            {new Date(design.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button 
                          onClick={() => deleteDesign(design.id)}
                          className="p-2 text-black/10 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="space-y-2 mb-6">
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-black/30">
                          <span>Construction</span>
                          <span className="text-black/60">{design.config.construction.replace('-', ' ')}</span>
                        </div>
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-black/30">
                          <span>Size</span>
                          <span className="text-black/60">{design.config.width}' x {design.config.length}'</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => navigate(`/design-detail/${design.id}`)}
                        className="w-full py-3 bg-black/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#EFBB76] hover:text-black transition-all flex items-center justify-center gap-2"
                      >
                        View Details <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-32 flex flex-col items-center justify-center text-center space-y-6 bg-black/5 rounded-[3rem] border border-dashed border-black/10"
              >
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm">
                  <Plus className="w-10 h-10 text-black/10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-serif font-bold text-black">No designs in this collection</h3>
                  <p className="text-black/40 text-sm max-w-xs mx-auto">Start designing your custom rug and save your favorites here.</p>
                </div>
                <button 
                  onClick={() => navigate('/design')}
                  className="px-8 py-3 bg-[#EFBB76] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#DBA762] transition-all"
                >
                  Start Designing
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* New Folder Modal */}
      <AnimatePresence>
        {isCreatingFolder && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreatingFolder(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[2rem] p-8 z-[110] shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-serif font-bold text-black">New Collection</h3>
                <button onClick={() => setIsCreatingFolder(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-4">Collection Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full bg-black/5 border border-transparent rounded-2xl px-6 py-4 focus:outline-none focus:border-[#EFBB76]/50 transition-all text-sm"
                    placeholder="e.g., Living Room Project"
                  />
                </div>
                <button 
                  onClick={createFolder}
                  className="w-full py-4 bg-[#EFBB76] text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-[#DBA762] transition-all shadow-lg"
                >
                  Create Collection
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
