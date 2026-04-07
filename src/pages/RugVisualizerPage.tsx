import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Loader2, 
  ChevronLeft, 
  Plus, 
  Minus, 
  Save, 
  Maximize2, 
  RefreshCw,
  Sparkles,
  Coins,
  Lock,
  Zap,
  Star,
  Crown,
  LayoutGrid,
  Building2,
  Check,
  X
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";
import jsPDF from 'jspdf';
import { RugConfig, SavedDesign } from '../types';
import { CONSTRUCTIONS, PILE_TYPES, PILE_HEIGHTS, SURFACE_FINISHES, PRICING_MATRIX, API_COSTS, PRICING_TIERS, MATERIAL_TYPES } from '../constants';
import { calculateEstimate } from '../lib/pricing';
import { useFirebase } from '../components/FirebaseProvider';
import { db, handleFirestoreError, OperationType, signInWithPopup, googleProvider, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';

import { storage } from '../lib/storage';

export const RugVisualizerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRegenFromUrl = searchParams.get('isRegeneration') === 'true';

  const { user, profile, profileLoading } = useFirebase();
  const [config, setConfig] = useState<RugConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenMode, setIsRegenMode] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAuthWall, setShowAuthWall] = useState(false);
  const [showPlanSelection, setShowPlanSelection] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState(false);

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }), []);

  const hasLoadedInitial = React.useRef(false);

  useEffect(() => {
    const loadInitialData = async () => {
      if (hasLoadedInitial.current) return;
      hasLoadedInitial.current = true;

      const savedConfig = await storage.getLarge<RugConfig>('rug_current_config');
      const savedImages = await storage.getLarge<string[]>('rug_generated_images');
      const savedSelection = storage.getSmall('rug_selected_variation');

      if (savedConfig) {
        setConfig(savedConfig);
        
        if (isRegenFromUrl) {
          // If coming from design page for regeneration, trigger it
          generateImage(savedConfig, true);
          // Clear the param from URL to prevent re-triggering on refresh
          navigate('/visualizer', { replace: true });
        } else if (savedImages && savedImages.length > 0) {
          setImageUrls(savedImages);
          if (savedSelection !== null) {
            setSelectedVariation(parseInt(savedSelection));
          }
        } else if (!isGenerating) {
          generateImage(savedConfig);
        }
      } else {
        navigate('/');
      }
    };

    // Only start initial generation if auth is ready and profile is not loading
    if (!profileLoading) {
      loadInitialData();
    }
  }, [profileLoading, isRegenFromUrl, navigate]);

  // Handle pending generation after sign-in
  useEffect(() => {
    if (pendingGeneration && !profileLoading && profile && config && !isGenerating) {
      setPendingGeneration(false);
      generateImage(config);
    }
  }, [pendingGeneration, profileLoading, profile, config, isGenerating]);

  // Persist images and selection
  useEffect(() => {
    if (imageUrls.length > 0) {
      storage.setLarge('rug_generated_images', imageUrls);
    }
  }, [imageUrls]);

  useEffect(() => {
    if (selectedVariation !== null) {
      storage.setSmall('rug_selected_variation', selectedVariation.toString());
    } else {
      storage.remove('rug_selected_variation');
    }
  }, [selectedVariation]);

  const generateImage = async (currentConfig: RugConfig, isRegeneration = false) => {
    if (!currentConfig.prompt) return;

    // Credit Check
    const cost = isRegeneration ? API_COSTS.regeneration : API_COSTS.generation;
    
    if (user) {
      // If profile is still loading, set pending and return
      if (profileLoading) {
        setPendingGeneration(true);
        return;
      }
      if (!profile || profile.credits < cost) {
        setShowPlanSelection(true);
        return;
      }
    } else {
      // Guest logic: Use same 5 credit limit as free tier
      const guestCredits = parseInt(storage.getSmall('guest_credits') || '5');
      if (guestCredits < cost) {
        setShowAuthWall(true);
        return;
      }
      // If first generation as guest, we show the wall *while* it generates
      if (guestCredits === 5 && !isRegeneration) {
        setShowAuthWall(true);
      }
    }

    setIsGenerating(true);
    setIsRegenMode(isRegeneration);
    setError(null);
    setSelectedVariation(null);
    
    // If not regeneration, clear all.
    if (!isRegeneration) {
      setImageUrls([]);
      await storage.remove('rug_generated_images');
    }
    
    try {
      // Save prompt for dashboard tracking
      if (user) {
        addDoc(collection(db, 'prompts'), {
          userId: user.uid,
          text: currentConfig.prompt,
          createdAt: serverTimestamp()
        }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'prompts'));
      }

      const construction = CONSTRUCTIONS.find(c => c.id === currentConfig.construction)?.name;
      const pileType = PILE_TYPES.find(p => p.id === currentConfig.pileType)?.name;
      const pileHeight = PILE_HEIGHTS.find(p => p.id === currentConfig.pileHeight)?.name;
      const finishes = currentConfig.surfaceFinishes.map(id => SURFACE_FINISHES.find(f => f.id === id)?.name).join(', ');

      const fullPrompt = `A high-quality, professional top-down studio photograph of a single custom designer rug. 
      The rug dimensions are ${currentConfig.width}ft x ${currentConfig.length}ft. 
      Design concept: ${currentConfig.prompt}. 
      Color Palette: ${currentConfig.colors.join(', ')}. 
      Construction: ${construction}. 
      Texture: ${pileType} with ${pileHeight} height. 
      Finishing details: ${finishes}. 
      The rug should be perfectly centered on a PURE WHITE background. No shadows, no floor texture, just the rug on white. Highly detailed textile texture, realistic fibers, luxury aesthetic.`;

      const ratio = currentConfig.width / currentConfig.length;
      let aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1";
      if (ratio > 1.15) aspectRatio = "4:3";
      if (ratio > 1.4) aspectRatio = "16:9";
      if (ratio < 0.85) aspectRatio = "3:4";
      if (ratio < 0.65) aspectRatio = "9:16";

      const results: (string | null)[] = [];
      const numVariations = isRegeneration ? 1 : 4;
      
      // Generate variations sequentially with backoff to avoid 429 errors
      for (let i = 1; i <= numVariations; i++) {
        setGeneratingIndex(i);
        let retryCount = 0;
        const maxRetries = 3;
        let success = false;

        while (retryCount <= maxRetries && !success) {
          try {
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: {
                parts: [{ text: `${fullPrompt} - Variation ${i}. Strictly maintain the ${aspectRatio} aspect ratio. The rug must occupy at least 80% of the frame.` }],
              },
              config: {
                imageConfig: {
                  aspectRatio: aspectRatio
                },
                seed: (currentConfig.seed + (isRegeneration ? Math.floor(Math.random() * 1000000) : i * 789)) % 2147483647,
              }
            });

            const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
            const imageUrl = part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : null;
            if (imageUrl) {
              results.push(imageUrl);
              success = true;
            } else {
              throw new Error("No image data received");
            }
          } catch (err: any) {
            const isRateLimit = err?.message?.includes('429') || 
                               err?.status === 'RESOURCE_EXHAUSTED' ||
                               err?.message?.includes('RESOURCE_EXHAUSTED') ||
                               (err?.error && typeof err.error === 'object' && err.error.code === 429);
            
            if (isRateLimit && retryCount < maxRetries) {
              retryCount++;
              const delay = (Math.pow(2, retryCount) * 1000) + (Math.random() * 1000);
              setError(`AI is busy. Retrying in ${Math.round(delay/1000)}s... (Attempt ${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              setError(null);
            } else {
              console.warn(`Variation ${i} failed:`, err);
              success = true; // Move to next variation even if this one failed
            }
          }
        }
      }
      const validImages = results.filter((img): img is string => img !== null);
      
      if (validImages.length > 0) {
        setImageUrls(validImages);
        if (isRegeneration) {
          setSelectedVariation(0);
        }
        await storage.setLarge('rug_generated_images', validImages);
        storage.setSmall('rug_last_gen_time', Date.now().toString());
        if (isRegeneration) {
          storage.setSmall('rug_selected_variation', '0');
        }

        // Deduct Credits
        if (user) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            credits: increment(-cost)
          });
        } else {
          const guestCredits = parseInt(storage.getSmall('guest_credits') || '5');
          storage.setSmall('guest_credits', Math.max(0, guestCredits - cost).toString());
        }
      } else {
        throw new Error("Failed to generate rug visualizations. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsGenerating(false);
      setGeneratingIndex(null);
    }
  };

  const handleSave = async () => {
    if (selectedVariation === null || !config) return;
    
    setIsSaving(true);
    const selectedImageUrl = imageUrls[selectedVariation];

    try {
      // Save current selection for pricing review and detail page fallback
      await storage.setLarge('rug_selected_image', selectedImageUrl);
      await storage.setLarge('rug_current_config', config);
      
      // Navigate to the detail page without a specific Firestore ID
      // The detail page will load from localStorage fallback
      navigate('/design-detail');
    } catch (error) {
      console.error("Failed to save selection locally", error);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateRate = () => {
    if (!config) return 0;
    const constructionMatrix = PRICING_MATRIX[config.construction] || PRICING_MATRIX['tufted'];
    const materialCost = config.materialTypes.reduce((acc, materialName) => {
      const price = constructionMatrix[materialName] || 0;
      return acc + price;
    }, 0) / config.materialTypes.length;
    
    const finishCost = config.surfaceFinishes.reduce((acc, id) => {
      const finish = SURFACE_FINISHES.find(f => f.id === id);
      return acc + (finish?.pricePerSqFt || 0);
    }, 0);

    return Math.round(materialCost + finishCost);
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setShowAuthWall(false);
      if (config && !isGenerating) {
        // After sign in, trigger the generation that was blocked
        generateImage(config);
      }
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  if (!config) return null;

  const rate = calculateRate();
  const constructionName = CONSTRUCTIONS.find(c => c.id === config.construction)?.name;
  const estimate = calculateEstimate(config);

  const pileHeightName = PILE_HEIGHTS.find(p => p.id === config.pileHeight)?.name;
  const materialNames = Array.from(new Set(config.materialTypes)).join(' & ');

  const rugRatio = config ? config.width / config.length : 1;
  const getAspectClass = (ratio: number) => {
    if (ratio > 1.4) return 'aspect-video';
    if (ratio > 1.15) return 'aspect-[4/3]';
    if (ratio < 0.65) return 'aspect-[9/16]';
    if (ratio < 0.85) return 'aspect-[3/4]';
    return 'aspect-square';
  };
  const aspectClass = getAspectClass(rugRatio);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[calc(100vh-80px)] flex flex-col bg-white"
    >
      <div className="relative flex-1 overflow-hidden">
        <button 
          onClick={() => navigate('/design')}
          className="absolute top-8 left-8 flex items-center gap-2 text-black/40 hover:text-[#EFBB76] transition-colors group z-50"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back to Edit
        </button>

        <div className="absolute top-8 right-8 flex items-center gap-4 bg-white/60 backdrop-blur-xl px-6 py-3 rounded-full border border-black/10 z-50 shadow-2xl">
          {user && profile && (
            <div className="flex items-center gap-2 pr-4 border-r border-black/10">
              <Coins className="w-4 h-4 text-[#EFBB76]" />
              <span className="text-xs font-black">{profile.credits}</span>
            </div>
          )}
          <div className="flex items-center gap-3 pr-4 border-r border-black/10">
            <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="text-black/60 hover:text-[#EFBB76] transition-colors"><Minus className="w-5 h-5" /></button>
            <input type="range" min="50" max="300" value={zoom} onChange={(e) => setZoom(parseInt(e.target.value))} className="w-24 accent-[#EFBB76] cursor-pointer" />
            <button onClick={() => setZoom(z => Math.min(300, z + 25))} className="text-black/60 hover:text-[#EFBB76] transition-colors"><Plus className="w-5 h-5" /></button>
          </div>
          <span className="text-xs font-mono font-bold text-[#EFBB76] w-12 text-center">{zoom}%</span>
        </div>

        <div className="w-full h-full overflow-auto p-8 lg:p-16 pt-32 lg:pt-40 custom-scrollbar">
          <div className="relative transition-all duration-300 mx-auto" style={{ width: `${zoom}%`, maxWidth: zoom <= 100 ? '1200px' : 'none' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {isGenerating ? (
                  (isRegenMode ? [1] : [1, 2, 3, 4]).map((i) => (
                    <div key={`loader-container-${i}`} className="flex flex-col gap-4">
                      <motion.div key={`loader-${i}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={`${aspectClass} bg-black/5 rounded-3xl border border-black/10 flex flex-col items-center justify-center gap-4 overflow-hidden relative`}>
                        {generatingIndex === i ? (
                          <>
                            <Loader2 className="w-8 h-8 animate-spin text-[#EFBB76]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-black/40">Generating Variation {i}...</span>
                          </>
                        ) : generatingIndex !== null && i < generatingIndex ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                            </div>
                            <span className="text-[10px] font-bold tracking-widest uppercase text-black/20">Variation {i} Ready</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold tracking-widest uppercase text-black/10">Waiting...</span>
                        )}
                      </motion.div>
                      <div className="h-[44px] w-full bg-black/5 rounded-2xl animate-pulse" />
                    </div>
                  ))
                ) : imageUrls.length > 0 ? (
                  imageUrls.map((url, i) => (
                    <div key={`rug-container-${i}`} className="flex flex-col gap-4">
                      <motion.div
                        key={`rug-${i}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`relative group rounded-3xl overflow-hidden border transition-all duration-500 ${aspectClass} bg-white ${selectedVariation === i ? 'ring-4 ring-[#EFBB76] border-transparent scale-[1.02] z-10 shadow-2xl' : 'border-black/10 hover:border-black/30'}`}
                      >
                        <img src={url} alt={`Variation ${i + 1}`} className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
                        
                        {/* Hover Actions */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-6">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedVariation === i) {
                                setSelectedVariation(null);
                              } else {
                                setSelectedVariation(i);
                              }
                            }}
                            className={`w-full py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${selectedVariation === i ? 'bg-[#EFBB76] text-black' : 'btn-primary'}`}
                          >
                            {selectedVariation === i ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Selected</span>
                                <X className="w-3 h-3 ml-auto opacity-40 hover:opacity-100 transition-opacity" />
                              </>
                            ) : (
                              'Select Design'
                            )}
                          </button>
                          <button 
                            onClick={() => setFullScreenImage(url)}
                            className="btn-secondary w-full py-2 text-[8px]"
                          >
                            <Maximize2 className="w-3 h-3" /> Expand
                          </button>
                        </div>
                      </motion.div>
                      <button 
                        onClick={() => setFullScreenImage(url)}
                        className="btn-primary w-full py-3 text-[10px] shadow-lg"
                      >
                        <Maximize2 className="w-3 h-3" /> Preview Design
                      </button>
                    </div>
                  ))
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* Details Section */}
          <div className="max-w-6xl mx-auto mt-16 mb-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 border-t border-black/5 pt-12">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#EFBB76]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Material & Fiber</span>
              </div>
              <div className="flex flex-col gap-2">
                {Array.from(new Set(config.materialTypes)).map((id, idx) => {
                  const m = MATERIAL_TYPES.find(mat => mat.id === id);
                  return (
                    <div key={idx} className="flex flex-col">
                      <span className="text-sm font-bold text-black uppercase tracking-wider">{idx + 1}. {m?.name || id}</span>
                    </div>
                  );
                })}
                <span className="text-[10px] font-bold text-black/20 uppercase tracking-widest mt-1">Premium Quality</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-black/20" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Pile Height</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-black">{PILE_HEIGHTS.find(p => p.id === config.pileHeight)?.name.split(' — ')[0]}</span>
                <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest leading-tight">
                  {PILE_HEIGHTS.find(p => p.id === config.pileHeight)?.name.split(' — ')[1]}
                </span>
                <span className="text-[10px] font-bold text-black/20 uppercase tracking-widest mt-1">Texture Profile</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-black/40" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Construction</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-black">{constructionName}</p>
                <p className="text-[10px] font-bold text-[#EFBB76] uppercase tracking-widest">${rate.toFixed(2)} / SQFT</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-black" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Production</span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-black/30 mb-1">Lead Time</p>
                  <p className="text-xs font-bold text-black">{estimate.leadTime}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-black/30 mb-1">Origin</p>
                  <p className="text-xs font-bold text-black leading-tight">Artisan-made in Nepal/India</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Modal */}
      <AnimatePresence>
        {fullScreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-8"
            onClick={() => setFullScreenImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`relative max-w-5xl w-full ${aspectClass} bg-white rounded-3xl overflow-hidden p-12`}
              onClick={e => e.stopPropagation()}
            >
              <img src={fullScreenImage} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              <button 
                onClick={() => setFullScreenImage(null)}
                className="absolute top-6 right-6 w-10 h-10 bg-black/5 hover:bg-black/10 rounded-full flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-6 h-6 rotate-180" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedVariation !== null && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bg-white border-t border-black/5 p-6 flex items-center justify-between shadow-2xl z-50"
        >
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-black/10">
              <img src={imageUrls[selectedVariation]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest">Design Selected</h3>
              <p className="text-[10px] text-black/40 font-bold uppercase tracking-widest mt-1">Ready for Pricing & Production</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                // Save current selection as the base for regeneration
                const selectedImageUrl = imageUrls[selectedVariation];
                await storage.setLarge('rug_selected_image', selectedImageUrl);
                await storage.setLarge('rug_current_config', config);
                navigate('/design?mode=regenerate');
              }} 
              className="btn-secondary px-6 py-3 text-[10px]"
            >
              <RefreshCw className="w-4 h-4" /> Edit & Regenerate
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              className="btn-primary px-8 py-3 text-[10px] disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Continue to Pricing <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full text-xs font-bold shadow-xl flex items-center gap-3 z-[100]">
          {error}
          <button onClick={() => generateImage(config, isRegenMode)} className="underline uppercase tracking-widest">Retry</button>
        </div>
      )}

      {/* Auth Wall Overlay */}
      <AnimatePresence>
        {showAuthWall && !user && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-white/40 backdrop-blur-2xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl border border-black/5 text-center space-y-8"
            >
              <div className="w-20 h-20 bg-[#EFBB76]/10 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-[#EFBB76]" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-serif font-bold text-black">Sign in to Visualize</h2>
                <p className="text-sm text-black/40 leading-relaxed">Your design is being crafted. Sign in to see the results and save your creations to your profile.</p>
              </div>
              <button 
                onClick={handleGoogleSignIn}
                className="btn-primary w-full py-4 text-[10px]"
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                Continue with Google
              </button>
              <button 
                onClick={() => setShowAuthWall(false)}
                className="text-[10px] font-bold uppercase tracking-widest text-black/20 hover:text-black transition-colors"
              >
                Maybe Later
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plan Selection Overlay */}
      <AnimatePresence>
        {showPlanSelection && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6 overflow-y-auto"
          >
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="max-w-6xl w-full bg-white rounded-[4rem] p-12 shadow-2xl relative my-8"
            >
              <button 
                onClick={() => setShowPlanSelection(false)}
                className="absolute top-8 right-8 w-12 h-12 bg-black/5 hover:bg-black/10 rounded-full flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-6 h-6 rotate-180" />
              </button>

              <div className="text-center mb-12">
                <h2 className="text-4xl font-serif font-bold text-black mb-4">Out of Credits</h2>
                <p className="text-black/40 text-sm font-bold uppercase tracking-widest">Choose a plan to continue creating your masterpiece</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {PRICING_TIERS.filter(t => t.id !== 'free').map((tier) => (
                  <div 
                    key={tier.id} 
                    className={`p-8 rounded-[3rem] border border-black/5 flex flex-col transition-all duration-300 hover:scale-[1.02] ${
                      tier.id === 'pro' || tier.id === 'studio' || tier.id === 'enterprise' ? 'bg-black text-white' : 'bg-white text-black'
                    } ${tier.popular ? 'ring-2 ring-[#EFBB76]' : ''}`}
                  >
                    <div className="mb-6">
                      <h3 className="text-xl font-serif font-bold mb-2">{tier.name}</h3>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-3xl font-black">${tier.price}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">/ month</span>
                      </div>
                      <p className="text-[10px] leading-relaxed opacity-60 font-bold uppercase tracking-widest">{tier.description}</p>
                    </div>

                    <div className="flex-1 space-y-3 mb-8">
                      <div className="flex items-center gap-2">
                        <Check className="w-3 h-3 text-[#EFBB76]" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{tier.credits} Credits</span>
                      </div>
                      {tier.features.slice(0, 3).map((feature) => (
                        <div key={feature} className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-[#EFBB76]" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => navigate('/checkout', { state: { tier: tier.id } })}
                      className="btn-primary w-full py-3 text-[10px]"
                    >
                      Upgrade to this plan
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ArrowRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);
