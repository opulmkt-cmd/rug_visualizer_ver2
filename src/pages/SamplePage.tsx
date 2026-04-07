import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Check, ArrowRight, Package, Truck, ShieldCheck, ChevronLeft, Mail, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../lib/storage';
import { RugConfig } from '../types';
import { useFirebase } from '../components/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { shopifyService } from '../services/shopifyService';
import { imageService } from '../services/imageService';

import { CONSTRUCTIONS } from '../constants';
import { calculateEstimate } from '../lib/pricing';

export const SamplePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useFirebase();
  const [config, setConfig] = useState<RugConfig | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const estimate = config ? calculateEstimate(config) : null;
  const depositAmount = estimate ? Math.round(estimate.recommendedQuote * 0.2) : 500;

  useEffect(() => {
    const loadData = async () => {
      const savedConfig = await storage.getLarge<RugConfig>('rug_current_config');
      const savedImage = await storage.getLarge<string>('rug_selected_image');
      if (savedConfig && savedImage) {
        setConfig(savedConfig);
        setSelectedImage(savedImage);
      } else {
        navigate('/');
      }
      setLoading(false);
    };
    loadData();
  }, [navigate]);

  const handleRequestSample = async () => {
    if (!config || !selectedImage) return;
    setIsSubmitting(true);
    
    try {
      // 1. Upload image to ImgBB
      let imageUrl = selectedImage;
      if (selectedImage && !selectedImage.startsWith('http')) {
        try {
          imageUrl = await imageService.uploadToImgBB(selectedImage);
        } catch (imgbbError: any) {
          console.error('ImgBB upload failed for sample:', imgbbError);
          throw new Error(`Failed to store image: ${imgbbError.message || 'Please check your ImgBB API key.'}`);
        }
      }

      // 2. Try Shopify Checkout for Sample
      const constructionName = CONSTRUCTIONS.find(c => c.id === config.construction)?.name.split(' — ')[0] || config.construction;
      const dynamicTitle = `${config.prompt} ${constructionName} Rug Sample`.toLowerCase();

      const checkoutUrl = await shopifyService.createDynamicCheckout({
        title: dynamicTitle,
        price: 50, // Fixed price for samples
        imageUrl: imageUrl || '',
        email: user?.email || '',
        attributes: shopifyService.formatRugAttributes(config, imageUrl),
        type: 'sample',
      });

      if (checkoutUrl) {
        // Log to Firestore
        if (user) {
          await addDoc(collection(db, 'sample_requests'), {
            userId: user.uid,
            userEmail: user.email,
            imageUrl,
            config,
            status: 'Redirected to Shopify',
            createdAt: serverTimestamp()
          });
        }
        window.open(checkoutUrl, '_blank');
        return;
      }

      // 3. Fallback to mailto if Shopify not configured
      if (user) {
        await addDoc(collection(db, 'sample_requests'), {
          userId: user.uid,
          userEmail: user.email,
          imageUrl,
          config,
          status: 'Pending (Email Sent)',
          createdAt: serverTimestamp()
        });
      }

      // Construct mailto link
      const subject = encodeURIComponent(`Sample Request: ${config.prompt || 'Custom Rug'}`);
      const body = encodeURIComponent(`
Hi Opul Team,

I would like to request a sample for my custom rug design.

Design Details:
- Prompt: ${config.prompt}
- Dimensions: ${config.width}' x ${config.length}'
- Construction: ${config.construction}
- Pile Type: ${config.pileType}
- Pile Height: ${config.pileHeight}
- Materials: ${config.materialTypes.join(', ')}
- Finishes: ${config.surfaceFinishes.join(', ')}

Image URL: ${selectedImage}

User Email: ${user?.email || 'Guest'}
      `);
      
      window.open(`mailto:opulmkt@gmail.com?subject=${subject}&body=${body}`, '_blank');
      
      alert('Sample request recorded! Your email client should open now to send the final request.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sample_requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#EFBB76] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!config || !selectedImage) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto px-6 py-12"
    >
      <button 
        onClick={() => navigate('/pricing-review')}
        className="flex items-center gap-2 text-black/40 hover:text-[#EFBB76] transition-colors group mb-12"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back to Pricing Review
      </button>

      <header className="mb-16">
        <h1 className="text-5xl font-serif font-bold text-black mb-4">Request a Sample</h1>
        <p className="text-black/40 text-lg max-w-2xl">Review your design details and request a physical sample to feel the quality of our premium fibers.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-20">
        {/* Left: Design Preview */}
        <div className="space-y-8">
          <div className="aspect-square bg-black/5 rounded-3xl overflow-hidden border border-black/10 shadow-2xl">
            <img 
              src={selectedImage} 
              alt="Selected Rug" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          
          <div className="bg-black/5 p-8 rounded-3xl border border-black/10 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest border-b border-black/10 pb-4 mb-4">Design Specifications</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest block">Dimensions</span>
                <p className="text-sm font-bold">{config.width}' x {config.length}'</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest block">Construction</span>
                <p className="text-sm font-bold uppercase">{config.construction.replace('-', ' ')}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest block">Pile Type</span>
                <p className="text-sm font-bold uppercase">{config.pileType}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest block">Pile Height</span>
                <p className="text-sm font-bold">{config.pileHeight}mm</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="space-y-12">
          <div className="space-y-6">
            <div className="bg-[#EFBB76]/10 p-8 rounded-[2.5rem] border border-[#EFBB76]/20">
              <h3 className="text-xl font-serif font-bold mb-4">Sample Order Details</h3>
              <p className="text-sm text-black/60 mb-8 leading-relaxed">
                We'll send you a 1ft x 1ft sample of your exact design configuration. The cost of the sample is credited back to your final order.
              </p>
              <div className="space-y-4">
                <button 
                  onClick={handleRequestSample}
                  disabled={isSubmitting}
                  className="w-full py-5 bg-[#EFBB76] text-black font-black text-lg rounded-full hover:bg-[#DBA762] transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : <><Mail className="w-5 h-5" /> Request for Sample</>}
                </button>
                <button 
                  onClick={() => navigate('/checkout', { state: { type: 'deposit', amount: depositAmount } })}
                  className="w-full py-5 bg-black text-white font-black text-lg rounded-full hover:bg-black/80 transition-all shadow-xl flex items-center justify-center gap-3"
                >
                  <CreditCard className="w-5 h-5" /> Pay Deposit for Full Rug
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="flex gap-4 p-6 bg-black/5 rounded-2xl border border-black/10">
                <Package className="w-6 h-6 text-[#EFBB76] shrink-0" />
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest mb-1">Premium Packaging</h4>
                  <p className="text-[10px] text-black/40 leading-relaxed">Carefully packed to preserve texture and color accuracy.</p>
                </div>
              </div>
              <div className="flex gap-4 p-6 bg-black/5 rounded-2xl border border-black/10">
                <Truck className="w-6 h-6 text-[#EFBB76] shrink-0" />
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest mb-1">Global Shipping</h4>
                  <p className="text-[10px] text-black/40 leading-relaxed">Worldwide delivery within 3-5 business days.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
