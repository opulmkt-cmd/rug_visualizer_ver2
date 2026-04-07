import React from 'react';
import { motion } from 'motion/react';
import { Check, X, Sparkles, Zap, Crown, ArrowRight, Star, Building2, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFirebase } from '../components/FirebaseProvider';
import { PRICING_TIERS } from '../constants';

export const FeatureTiersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useFirebase();

  const getIcon = (id: string) => {
    switch (id) {
      case 'free': return <Sparkles className="w-8 h-8 text-black/20" />;
      case 'creator': return <Zap className="w-8 h-8 text-[#EFBB76]" />;
      default: return <Sparkles className="w-8 h-8 text-black/20" />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-6 py-12"
    >
      <header className="mb-20 text-center">
        <span className="inline-block px-4 py-1.5 bg-[#EFBB76]/10 text-[#EFBB76] rounded-full text-[10px] font-bold uppercase tracking-[0.3em] mb-8 border border-[#EFBB76]/20">
          DESIGN EXPERIENCE BY OPUL
        </span>
        <h1 className="text-5xl md:text-7xl font-serif font-bold text-black mb-8 leading-[1.1] tracking-tight">
          Design Custom Rugs — <br />
          <span className="text-[#EFBB76]">Faster, Smarter, Production-Ready</span>
        </h1>
        <p className="text-lg md:text-xl text-black/60 max-w-3xl mx-auto mb-4 font-medium leading-relaxed">
          Generate, refine, and move into real production — all within Opul Mkt
        </p>
        <p className="text-sm md:text-base text-[#EFBB76] font-bold uppercase tracking-[0.2em] mb-12">
          Powered by AI. Built by artisans.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
          <button 
            onClick={() => navigate('/design')}
            className="px-12 py-6 bg-[#EFBB76] text-black font-black text-xl rounded-full hover:bg-[#DBA762] transition-all shadow-xl flex items-center gap-3 group"
          >
            Start Designing <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </header>

      <div className="mb-12">
        <h2 className="text-3xl font-serif font-bold text-black text-left">Explore Plans</h2>
      </div>

      <div id="pricing-grid" className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-8 mb-20">
        {PRICING_TIERS.map((tier) => (
          <div 
            key={tier.id} 
            className={`relative p-10 rounded-[3rem] border border-black/5 flex flex-col transition-all duration-300 hover:scale-[1.02] bg-white text-black ${tier.popular ? 'shadow-2xl border-[#EFBB76]/50' : 'shadow-sm'}`}
          >
            {tier.popular && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-[#EFBB76] text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                CORE PLAN
              </div>
            )}
            
            <div className="mb-8">
              <div className="mb-6">{getIcon(tier.id)}</div>
              <h3 className="text-2xl font-serif font-bold mb-2">{tier.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-black">${tier.price}</span>
                {tier.price > 0 && <span className="text-xs font-bold uppercase tracking-widest opacity-40">/ month</span>}
              </div>
              <p className="text-sm leading-relaxed opacity-60">{tier.description}</p>
            </div>

            <div className="flex-1 space-y-4 mb-10">
              {tier.features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-[#EFBB76] mt-0.5 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-widest leading-tight">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              {!user ? (
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-black text-white hover:bg-black/80"
                >
                  Login to Upgrade <ArrowRight className="w-3 h-3" />
                </button>
              ) : profile?.tier === tier.id || (profile?.tier === 'pro' && tier.id === 'creator') ? (
                <div className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-center bg-black/5 text-black/40 border border-black/10">
                  {profile?.tier === tier.id ? 'Current Plan' : 'Included in Pro'}
                </div>
              ) : (
                <button 
                  onClick={() => {
                    if (tier.id === 'free') {
                      navigate('/design');
                    } else {
                      navigate('/checkout', { state: { tier: tier.id } });
                    }
                  }}
                  className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    tier.id === 'free' || tier.id === 'creator'
                      ? 'bg-[#EFBB76] text-black hover:bg-[#DBA762]' 
                      : 'bg-black text-white hover:bg-black/80'
                  }`}
                >
                  {tier.id === 'free' ? 'Start Designing' : 'Upgrade Now'}
                  {(tier.id === 'free' || tier.id === 'creator') && <ArrowRight className="w-3 h-3" />}
                </button>
              )}
              {tier.id === 'free' && (
                <p className="text-[10px] text-center font-bold text-black/40 uppercase tracking-widest">
                  For exploration only
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-black p-12 rounded-[3rem] border border-white/10 text-center space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white">For Studios, Developers & Procurement Teams</h3>
        <p className="text-xs text-white/40 max-w-xl mx-auto leading-relaxed">Access custom workflows, private production networks, and project-based pricing tools.</p>
        <button 
          onClick={() => window.open('mailto:hello@opul.mkt')}
          className="px-8 py-4 bg-[#EFBB76] text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-[#DBA762] transition-all flex items-center justify-center gap-2 mx-auto"
        >
          Contact Us <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
