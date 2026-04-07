import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight, ShoppingBag, ShieldCheck, Zap, ChevronLeft, Loader2, CreditCard, Lock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { storage } from '../lib/storage';
import { RugConfig } from '../types';
import { useFirebase } from '../components/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { PRICING_TIERS } from '../constants';
import { shopifyService } from '../services/shopifyService';
import { imageService } from '../services/imageService';

import { CONSTRUCTIONS } from '../constants';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useFirebase();
  const [submitted, setSubmitted] = useState(false);
  const [config, setConfig] = useState<RugConfig | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Payment Form State
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [email, setEmail] = useState(user?.email || '');

  const isDeposit = location.state?.type === 'deposit';
  const depositAmount = location.state?.amount || 500;
  const targetTierId = location.state?.tier;
  const targetTier = PRICING_TIERS.find(t => t.id === targetTierId);

  useEffect(() => {
    const loadData = async () => {
      const savedConfig = await storage.getLarge<RugConfig>('rug_current_config');
      const savedImage = await storage.getLarge<string>('rug_selected_image');
      if (savedConfig && savedImage) {
        setConfig(savedConfig);
        setSelectedImage(savedImage);
      }
    };
    loadData();
  }, []);

  const handlePayment = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!user) {
      setError('Please sign in to complete your purchase.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      // 1. If it's a deposit or rug order, use Shopify
      if (isDeposit || (!targetTier && config)) {
        let imageUrl = selectedImage;
        if (selectedImage && !selectedImage.startsWith('http')) {
          try {
            // Use ImgBB exclusively for image storage
            imageUrl = await imageService.uploadToImgBB(selectedImage);
          } catch (imgbbError: any) {
            console.error('ImgBB upload failed:', imgbbError);
            throw new Error(`Failed to store image: ${imgbbError.message || 'Please check your ImgBB API key.'}`);
          }
        }

        const constructionName = CONSTRUCTIONS.find(c => c.id === config.construction)?.name.split(' — ')[0] || config.construction;
        const dynamicTitle = `${config.prompt} ${constructionName} Rug${!isDeposit ? ' Sample' : ''}`.toLowerCase();

        const checkoutUrl = await shopifyService.createDynamicCheckout({
          title: dynamicTitle,
          price: isDeposit ? depositAmount : (location.state?.amount || 50),
          imageUrl: imageUrl || '',
          email: user.email || '',
          attributes: shopifyService.formatRugAttributes(config, imageUrl || ''),
          type: isDeposit ? 'deposit' : 'sample',
        });

        if (checkoutUrl) {
          // Log the order attempt in Firestore before redirect
          const orderData = {
            userId: user.uid,
            type: isDeposit ? 'Deposit' : 'Rug Order',
            status: 'Redirected to Shopify',
            amount: isDeposit ? depositAmount : 0,
            currency: 'USD',
            paymentMethod: 'Shopify',
            config: config,
            imageUrl: imageUrl,
            createdAt: serverTimestamp(),
          };
          await addDoc(collection(db, 'orders'), orderData);
          
          window.open(checkoutUrl, '_blank');
          return;
        } else {
          throw new Error('Failed to create Shopify checkout. Please check your Storefront Access Token and Domain.');
        }
      }

      // 2. Handle Plan Upgrade via Shopify
      if (targetTier) {
        if (shopifyService.isConfigured) {
          const { invoiceUrl, draftOrderId } = await shopifyService.createPlanUpgradeCheckout(email || user.email || '', user.uid);
          
          // Store the draft order ID in Firestore to verify later
          await updateDoc(doc(db, 'users', user.uid), {
            pendingUpgradeId: draftOrderId.toString(),
            pendingTierId: targetTier.id
          });

          // Open in same tab so "Return to Store" works correctly
          window.location.href = invoiceUrl;
          return;
        }
      }

      // 3. Simulate Payment Processing for internal tiers (Fallback or if not Shopify)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 2. Create Order in Firestore
      let imageUrl = selectedImage;
      if (selectedImage && !selectedImage.startsWith('http')) {
        try {
          imageUrl = await imageService.uploadToImgBB(selectedImage);
        } catch (imgbbError: any) {
          console.error('ImgBB upload failed for internal order:', imgbbError);
          // We can still proceed with the order even if image upload fails for internal mock orders
        }
      }

      const orderData = {
        userId: user.uid,
        type: targetTier ? 'Plan Upgrade' : (isDeposit ? 'Deposit' : 'Rug Order'),
        status: 'Paid',
        amount: targetTier ? targetTier.price : (isDeposit ? depositAmount : 0),
        currency: 'USD',
        paymentMethod: 'Credit Card (Mock)',
        config: config,
        imageUrl: imageUrl,
        createdAt: serverTimestamp(),
      };

      const path = 'orders';
      try {
        await addDoc(collection(db, path), orderData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }

      // 3. Update User Profile if it's a tier upgrade
      if (targetTier) {
        const userPath = `users/${user.uid}`;
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            tier: targetTier.id,
            credits: (profile?.credits || 0) + targetTier.credits,
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        }
      }

      setSubmitted(true);
      
      // Cleanup storage after successful order
      if (!targetTier) {
        await storage.remove('rug_current_config');
        await storage.remove('rug_selected_image');
      }

    } catch (err: any) {
      console.error('Payment Error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 flex flex-col items-center justify-center text-center space-y-8">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-serif font-bold mb-4">Payment Successful!</h1>
          <p className="text-black/40 text-lg leading-relaxed">
            Thank you for your purchase. Your order has been confirmed and is being processed.
            {targetTier ? ` Your account has been upgraded to the ${targetTier.name} plan.` : ' Our team will contact you shortly regarding your custom rug.'}
          </p>
        </div>
        <button 
          onClick={() => navigate('/dashboard')}
          className="px-12 py-4 bg-black text-white rounded-full font-bold hover:bg-black/80 transition-all flex items-center gap-2"
        >
          Go to Dashboard <ArrowRight className="w-5 h-5" />
        </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: Order Summary */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-black/5 p-8 rounded-[2.5rem] border border-black/10">
            <h2 className="text-xl font-serif font-bold mb-6">Order Summary</h2>
            {targetTier ? (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-[#EFBB76]/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Zap className="w-10 h-10 text-[#EFBB76]" />
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-serif font-bold text-black">{targetTier.name} Plan</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Subscription Upgrade</p>
                </div>
              </div>
            ) : selectedImage && (
              <div className="aspect-square rounded-2xl overflow-hidden mb-6 border border-black/10">
                <img src={selectedImage} alt="Rug Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
            <div className="space-y-4 border-t border-black/10 pt-6">
              <div className="flex justify-between text-xs">
                <span className="text-black/40 uppercase font-bold tracking-widest">Item</span>
                <span className="font-bold">{targetTier ? `${targetTier.name} Subscription` : 'Custom Designer Rug'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-black/40 uppercase font-bold tracking-widest">Type</span>
                <span className="font-bold">{targetTier ? 'Plan Upgrade' : (isDeposit ? 'Deposit Payment' : 'Full Payment')}</span>
              </div>
              <div className="flex justify-between text-xl font-serif font-bold pt-4 border-t border-black/10">
                <span>Total Due</span>
                <span className="text-[#EFBB76]">${targetTier ? targetTier.price : (isDeposit ? depositAmount.toLocaleString() : 'TBD')}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 p-6 bg-[#EFBB76]/5 rounded-2xl border border-[#EFBB76]/20">
            <ShieldCheck className="w-6 h-6 text-[#EFBB76] shrink-0" />
            <p className="text-[10px] text-black/60 leading-relaxed font-bold uppercase tracking-wider">
              Secure checkout. Your payment information is encrypted and processed securely.
            </p>
          </div>
        </div>

        {/* Right: Payment Form */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-black/10 shadow-2xl">
          {shopifyService.isConfigured ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-8 py-12">
              <div className="w-24 h-24 bg-[#EFBB76]/10 rounded-full flex items-center justify-center">
                {targetTier ? <Zap className="w-12 h-12 text-[#EFBB76]" /> : <ShoppingBag className="w-12 h-12 text-[#EFBB76]" />}
              </div>
              <div className="max-w-md">
                <h2 className="text-4xl font-serif font-bold mb-4">Shopify Checkout</h2>
                <p className="text-black/40 text-lg leading-relaxed">
                  We use Shopify to process our payments securely. You'll be redirected to complete your {targetTier ? 'plan upgrade' : (isDeposit ? 'deposit' : 'purchase')}.
                </p>
              </div>
              
              <div className="w-full max-w-md space-y-4">
                <button 
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full py-6 bg-[#EFBB76] text-black font-black text-xl rounded-full hover:bg-[#DBA762] transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Redirecting to Shopify...
                    </>
                  ) : (
                    <>
                      Proceed to Shopify Checkout <ArrowRight className="w-6 h-6" />
                    </>
                  )}
                </button>
                <p className="text-[10px] font-bold uppercase tracking-widest text-black/20 flex items-center justify-center gap-2">
                  <Lock className="w-3 h-3" /> Secure External Checkout
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-8">
                <CreditCard className="w-8 h-8 text-[#EFBB76]" />
                <h2 className="text-3xl font-serif font-bold text-black">Payment Details</h2>
              </div>

              <form onSubmit={handlePayment} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full p-4 rounded-xl border border-black/10 focus:border-[#EFBB76] outline-none transition-colors"
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Cardholder Name</label>
                <input 
                  type="text" 
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  required
                  className="w-full p-4 rounded-xl border border-black/10 focus:border-[#EFBB76] outline-none transition-colors"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Card Number</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                  required
                  className="w-full p-4 pl-12 rounded-xl border border-black/10 focus:border-[#EFBB76] outline-none transition-colors"
                  placeholder="0000 0000 0000 0000"
                />
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/20" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Expiry Date</label>
                <input 
                  type="text" 
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  required
                  className="w-full p-4 rounded-xl border border-black/10 focus:border-[#EFBB76] outline-none transition-colors"
                  placeholder="MM/YY"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">CVC</label>
                <input 
                  type="text" 
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  required
                  className="w-full p-4 rounded-xl border border-black/10 focus:border-[#EFBB76] outline-none transition-colors"
                  placeholder="123"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold uppercase tracking-widest">
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={isProcessing}
              className="w-full py-6 bg-[#EFBB76] text-black font-black text-xl rounded-full hover:bg-[#DBA762] transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  Pay ${targetTier ? targetTier.price : (isDeposit ? depositAmount.toLocaleString() : '0')} <ArrowRight className="w-6 h-6" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/40">
              <Lock className="w-3 h-3" /> Encrypted & Secure Payment
            </div>
          </form>

          <div className="mt-12 flex items-center gap-6 opacity-20 filter grayscale justify-center">
            <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-6" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-4" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-8" />
          </div>
          </>
          )}
        </div>
      </div>
    </motion.div>
  );
};
