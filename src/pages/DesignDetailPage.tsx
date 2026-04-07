import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ArrowRight, Sparkles, Palette, Ruler, Layers, Move, Download, Share2, Loader2, AlertCircle, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { RugConfig } from '../types';
import { CONSTRUCTIONS, PILE_TYPES, PILE_HEIGHTS, SURFACE_FINISHES, MATERIAL_TYPES } from '../constants';
import { calculateEstimate } from '../lib/pricing';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage } from '../lib/storage';
import { useFirebase } from '../components/FirebaseProvider';
import { imageService } from '../services/imageService';

export const DesignDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useFirebase();
  const [config, setConfig] = useState<RugConfig | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddingToWishlist, setIsAddingToWishlist] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);

  const handleAddToWishlist = async (shouldNavigate = true) => {
    if (!config || !selectedImage) return;
    setIsAddingToWishlist(true);
    if (!user) {
      // Guest save
      const saved = await storage.getLarge<any[]>('rug_saved_designs') || [];
      const newDesign = {
        id: `guest_${Date.now()}`,
        name: config.prompt || 'Untitled Design',
        imageUrl: selectedImage,
        config,
        createdAt: new Date().toISOString()
      };
      await storage.setLarge('rug_saved_designs', [newDesign, ...saved]);
      if (shouldNavigate) navigate('/wishlist');
    } else {
      try {
        // Use ImgBB exclusively for image storage
        let imageUrl = selectedImage;
        if (selectedImage && !selectedImage.startsWith('http')) {
          try {
            imageUrl = await imageService.uploadToImgBB(selectedImage);
          } catch (imgbbError: any) {
            console.error('ImgBB upload failed for wishlist:', imgbbError);
            throw new Error(`Failed to store image: ${imgbbError.message || 'Please check your ImgBB API key.'}`);
          }
        }

        await addDoc(collection(db, 'designs'), {
          userId: user.uid,
          name: config.prompt || 'Untitled Design',
          imageUrl,
          prompt: config.prompt,
          config,
          status: 'Saved',
          createdAt: serverTimestamp()
        });
        if (shouldNavigate) navigate('/wishlist');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'designs');
      } finally {
        setIsAddingToWishlist(false);
      }
    }
  };

  const handleModifyDesign = async (saveFirst: boolean) => {
    if (saveFirst) {
      await handleAddToWishlist(false);
    }
    navigate('/design');
  };

  const generateTearsheet = async () => {
    if (!config || !selectedImage) return;
    
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Header
    try {
      // Use the logo from the provided image
      const logoUrl = 'https://cdn.shopify.com/s/files/1/0718/2712/8409/files/logo_png.png?v=1774858443';
      const logoImg = new Image();
      logoImg.crossOrigin = "Anonymous";
      logoImg.src = logoUrl;
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
      });
      
      const logoWidth = 20;
      const logoHeight = (logoImg.height * logoWidth) / logoImg.width;
      doc.addImage(logoImg, 'PNG', margin, 10, logoWidth, logoHeight);
    } catch (e) {
      console.error("Failed to add logo to PDF", e);
      // Fallback to text if logo fails
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('Opul Mkt Inc', margin, 20);
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Custom Rug Design Specification', pageWidth - margin, 20, { align: 'right' });

    // Divider
    doc.setDrawColor(239, 187, 118); // #EFBB76
    doc.setLineWidth(0.5);
    doc.line(margin, 35, pageWidth - margin, 35);

    // Image (Top Right)
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = selectedImage;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const imgMaxWidth = 90;
      const imgMaxHeight = 120;
      let imgWidth = imgMaxWidth;
      let imgHeight = (img.height * imgWidth) / img.width;
      
      if (imgHeight > imgMaxHeight) {
        imgHeight = imgMaxHeight;
        imgWidth = (img.width * imgHeight) / img.height;
      }
      
      // Position image at top right, slightly below header divider
      doc.addImage(img, 'PNG', pageWidth - margin - imgWidth, 38, imgWidth, imgHeight);
    } catch (e) {
      console.error("Failed to add image to PDF", e);
    }

    // Details Table (Left Side)
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    let y = 50;
    const rowHeight = 10;
    const labelWidth = 35;

    const details = [
      ['Design ID', `#${config.seed}`],
      ['Dimensions', `${config.width}' x ${config.length}'`],
      ['Construction', CONSTRUCTIONS.find(c => c.id === config.construction)?.name || ''],
      ['Material', Array.from(new Set(config.materialTypes)).map(id => MATERIAL_TYPES.find(m => m.id === id)?.name).join(', ')],
      ['Pile Type', PILE_TYPES.find(p => p.id === config.pileType)?.name || ''],
      ['Pile Height', PILE_HEIGHTS.find(p => p.id === config.pileHeight)?.name || ''],
      ['Finishes', config.surfaceFinishes.map(id => SURFACE_FINISHES.find(f => f.id === id)?.name).join(', ')],
      ['Lead Time', estimate.leadTime],
      ['Origin', 'Artisan-made in Nepal/India']
    ];

    details.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(150, 150, 150);
      doc.text(`${label}:`, margin, y);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      // Wrap text if it's too long, keep width narrow (45) to avoid image overlap
      const splitValue = doc.splitTextToSize(String(value), 45);
      doc.text(splitValue, margin + labelWidth, y);
      
      y += (splitValue.length * 5) + 3;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.text('Opul Mkt Inc • Luxury Custom Rugs', pageWidth / 2, footerY, { align: 'center' });
    doc.text('Email: info@opulmkt.com • www.opulmkt.com', pageWidth / 2, footerY + 5, { align: 'center' });

    doc.save(`Rug_Design_${config.seed}.pdf`);
  };

  useEffect(() => {
    const fetchDesign = async () => {
      try {
        if (id) {
          const designDoc = await getDoc(doc(db, 'designs', id));
          if (designDoc.exists()) {
            const data = designDoc.data();
            setConfig(data.config);
            setSelectedImage(data.imageUrl);
            // Sync to IndexedDB for 'Edit Design' and 'Pricing' pages
            await storage.setLarge('rug_current_config', data.config);
            await storage.setLarge('rug_selected_image', data.imageUrl);
          } else {
            navigate('/dashboard');
          }
        } else {
          const savedConfig = await storage.getLarge<RugConfig>('rug_current_config');
          const savedImage = await storage.getLarge<string>('rug_selected_image');
          if (savedConfig && savedImage) {
            setConfig(savedConfig);
            setSelectedImage(savedImage);
          } else {
            navigate('/');
          }
        }
      } catch (error) {
        if (id) {
          handleFirestoreError(error, OperationType.GET, `designs/${id}`);
        } else {
          console.error("Failed to load local design:", error);
          navigate('/');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDesign();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#EFBB76]" />
      </div>
    );
  }

  if (!config || !selectedImage) return null;

  const construction = CONSTRUCTIONS.find(c => c.id === config.construction)?.name;
  const pileType = PILE_TYPES.find(p => p.id === config.pileType)?.name;
  const pileHeight = PILE_HEIGHTS.find(p => p.id === config.pileHeight)?.name;
  const finishes = config.surfaceFinishes.map(id => SURFACE_FINISHES.find(f => f.id === id)?.name);
  const uniqueMaterials = Array.from(new Set(config.materialTypes)).join(' & ');
  const estimate = calculateEstimate(config);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-6 py-12"
    >
      {/* Modify Confirmation Modal */}
      {showModifyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[32px] max-w-md w-full p-8 shadow-2xl relative"
          >
            <button 
              onClick={() => setShowModifyModal(false)}
              className="absolute top-6 right-6 p-2 hover:bg-black/5 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 bg-[#EFBB76]/10 rounded-2xl flex items-center justify-center mb-6">
              <AlertCircle className="w-8 h-8 text-[#EFBB76]" />
            </div>

            <h2 className="text-2xl font-serif font-bold mb-4">Modify Design?</h2>
            <p className="text-black/60 leading-relaxed mb-8">
              You will lose your current design if you modify it. Would you like to add it to your wishlist first to save it?
            </p>

            <div className="space-y-3">
              <button 
                onClick={() => handleModifyDesign(true)}
                className="btn-primary w-full py-4 text-sm shadow-lg"
              >
                Add to Wishlist & Modify
              </button>
              <button 
                onClick={() => handleModifyDesign(false)}
                className="btn-primary w-full py-4 text-sm shadow-lg"
              >
                Modify Anyway
              </button>
              <button 
                onClick={() => setShowModifyModal(false)}
                className="btn-secondary w-full py-4 text-sm"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <button 
        onClick={() => navigate(-1)}
        className="btn-secondary flex items-center gap-2 px-6 py-3 group mb-12"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Left: Prominent Selected Image */}
        <div className="space-y-8">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="aspect-[3/4] bg-black/5 rounded-[40px] overflow-hidden border border-black/10 shadow-2xl relative group"
          >
            <img 
              src={selectedImage} 
              alt="Selected Rug Design" 
              className="w-full h-full object-contain p-8"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
               <button 
                 onClick={generateTearsheet}
                 className="p-4 bg-white border-2 border-[#EFBB76] text-[#EFBB76] rounded-full shadow-xl hover:bg-[#EFBB76] hover:text-black transition-all hover:scale-110"
                 title="Download Tearsheet"
               >
                 <Download className="w-6 h-6" />
               </button>
            </div>
          </motion.div>
          
          <div className="flex items-center justify-between px-4">
            <div className="flex gap-4">
              <button 
                onClick={generateTearsheet}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors"
              >
                <Download className="w-4 h-4" /> Download Tearsheet
              </button>
              <button className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors">
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
            <span className="text-[10px] font-mono text-black/20 uppercase tracking-widest">ID: {config.seed}</span>
          </div>
        </div>

        {/* Right: All Details */}
        <div className="space-y-12">
          <header>
            <span className="inline-block px-3 py-1 bg-[#EFBB76]/10 text-[#EFBB76] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 border border-[#EFBB76]/20">
              Review & Pricing
            </span>
            <h1 className="text-5xl font-serif font-bold text-black mb-6 leading-tight">Your Custom Rug</h1>
            <p className="text-black/60 text-lg leading-relaxed font-medium italic">
              "{config.prompt}"
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Technical Specs */}
            <div className="space-y-8">
              <section>
                <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-black/30 mb-4">
                  <Ruler className="w-3 h-3" /> Dimensions
                </label>
                <p className="text-2xl font-bold text-black">{config.width}' x {config.length}' <span className="text-black/20 text-sm font-medium ml-2">({config.width * config.length} sq.ft)</span></p>
              </section>

              <section>
                <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-black/30 mb-4">
                  <Layers className="w-3 h-3" /> Construction & Materials
                </label>
                <div className="space-y-2">
                  <p className="text-xl font-bold text-black uppercase tracking-wider">{construction}</p>
                  <p className="text-sm font-bold text-[#EFBB76] uppercase tracking-widest">{uniqueMaterials}</p>
                </div>
              </section>

              <section>
                <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-black/30 mb-4">
                  <Move className="w-3 h-3" /> Texture & Finish
                </label>
                <div className="space-y-2">
                  <p className="text-sm font-bold text-black uppercase tracking-widest">Pile: {pileType} ({pileHeight})</p>
                  <div className="flex flex-wrap gap-2">
                    {finishes.map((f, i) => (
                      <span key={i} className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase tracking-widest text-black/60">{f}</span>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            {/* Color & Materials */}
            <div className="space-y-8">
              <section>
                <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-black/30 mb-4">
                  <Palette className="w-3 h-3" /> Color Palette & Materials
                </label>
                <div className="space-y-4">
                  {config.colors.map((color, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg border border-black/10 shadow-sm" style={{ backgroundColor: color }} />
                      <div>
                        <p className="text-[10px] font-mono font-bold text-black/40 uppercase">{color}</p>
                        <p className="text-xs font-bold text-black uppercase tracking-wider">{config.materialTypes[i]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          {/* Pricing & Delivery Section */}
          <div className="p-8 bg-black/5 rounded-[32px] border border-black/10 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block mb-2">Estimated Range</label>
                <p className="text-3xl font-serif font-bold text-black">
                  ${estimate.lowestTotal.toLocaleString()} - ${estimate.highestTotal.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block mb-2">Lead Time</label>
                <p className="text-xl font-bold text-black">{estimate.leadTime}</p>
              </div>
            </div>

            {estimate.manualReview && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Manual Review Required</p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Due to the complexity of your design (colors, size, or shape), our master weavers will review this configuration to ensure the highest quality production.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-black/5 flex justify-between items-center">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block mb-2">Origin</label>
                <p className="text-sm font-bold text-black">Artisan-made in Nepal/India</p>
              </div>
              <p className="text-[10px] text-black/30 font-medium uppercase tracking-widest">Includes all selected materials, construction, and finishing surcharges.</p>
            </div>
          </div>

          {/* Design Notes / Production Options */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-4">Production Notes (Optional)</label>
            <textarea 
              className="w-full p-6 bg-black/5 border border-black/10 rounded-[32px] text-sm focus:outline-none focus:ring-2 focus:ring-[#EFBB76]/50 transition-all min-h-[120px] resize-none font-medium"
              placeholder="Tell us if you want to adjust size, materials, or construction. Our weavers will review your notes."
            />
          </div>

          <div className="pt-12 border-t border-black/10 flex flex-col gap-4">
            <button 
              onClick={() => navigate('/checkout', { state: { type: 'deposit', amount: Math.round(estimate.recommendedQuote * 0.2) } })}
              className="btn-primary w-full py-6 text-lg shadow-xl"
            >
              Start Production with Deposit <ArrowRight className="w-5 h-5" />
            </button>
            <button 
              onClick={() => navigate('/samples')}
              className="btn-primary w-full py-6 text-lg shadow-xl"
            >
              Order Sample <ArrowRight className="w-5 h-5" />
            </button>
            <button 
              disabled={isAddingToWishlist}
              onClick={() => handleAddToWishlist(true)}
              className="btn-primary w-full py-6 text-lg shadow-xl disabled:opacity-50"
            >
              {isAddingToWishlist ? 'Adding...' : 'Add to wishlist'}
            </button>
            <button 
              onClick={() => setShowModifyModal(true)}
              className="btn-primary w-full py-6 text-lg shadow-xl"
            >
              Modify Design
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
