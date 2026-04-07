import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles, Palette, Ruler, Layers, ShieldCheck, Globe, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { storage } from '../lib/storage';

import { useFirebase } from '../components/FirebaseProvider';
import { auth, googleProvider, signInWithPopup } from '../firebase';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useFirebase();
  const [prompt, setPrompt] = React.useState('');

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleStartDesigning = () => {
    if (prompt.trim()) {
      storage.setSmall('rug_initial_prompt', prompt);
    }
    // Initialize guest credits if not set
    if (!storage.getSmall('guest_credits')) {
      storage.setSmall('guest_credits', '5');
    }
    navigate('/design');
  };

  return (
    <div className="bg-white text-black">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-6">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white z-10" />
          <img 
            src="https://picsum.photos/seed/rug-luxury/1920/1080?blur=2" 
            alt="Luxury Rug Background" 
            className="w-full h-full object-cover opacity-20"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block px-4 py-1.5 bg-[#EFBB76]/10 text-[#EFBB76] rounded-full text-[10px] font-bold uppercase tracking-[0.3em] mb-8 border border-[#EFBB76]/20">
              DESIGN EXPERIENCE BY OPUL
            </span>
            <h1 className="text-6xl md:text-8xl font-serif font-bold text-black mb-8 leading-[0.9] tracking-tighter">
              Where Vision <br />
              <span className="text-[#EFBB76]">Meets Craft.</span>
            </h1>
            <p className="text-lg md:text-xl text-black/60 max-w-2xl mx-auto mb-12 font-medium leading-relaxed">
              Design your rug using our digital tool, then bring it into real production through Opul’s global network.
            </p>
            
            <div className="max-w-2xl mx-auto mb-12 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#EFBB76] to-[#DBA762] rounded-full blur opacity-25 group-focus-within:opacity-50 transition duration-1000 group-focus-within:duration-200"></div>
              <div className="relative flex items-center bg-white rounded-full p-2 shadow-2xl border border-black/5">
                <Sparkles className="w-6 h-6 text-[#EFBB76] ml-6 shrink-0" />
                <input 
                  type="text" 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStartDesigning()}
                  placeholder="Describe your rug — style, colors, materials, size…"
                  className="w-full px-6 py-4 bg-transparent text-black placeholder:text-black/20 focus:outline-none text-lg font-medium"
                />
                <button 
                  onClick={handleStartDesigning}
                  className="btn-primary px-8 py-4 text-sm shrink-0"
                >
                  Start Designing <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
              {prompt.trim() && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleStartDesigning}
                  className="btn-primary px-10 py-5 text-lg"
                >
                  Customize Design
                </motion.button>
              )}
              <button 
                onClick={() => navigate('/how-it-works')}
                className="btn-secondary px-10 py-5 text-lg"
              >
                How it Works
              </button>
            </div>

            {/* Scrolling Headline */}
            <div className="mt-20 overflow-hidden whitespace-nowrap border-y border-black/5 py-6">
              <motion.div
                animate={{ x: [0, -1000] }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="inline-block text-xs font-bold uppercase tracking-[0.6em] text-black/20"
              >
                Digital design meets real-world production. &nbsp;&nbsp;&nbsp;&nbsp;
                Digital design meets real-world production. &nbsp;&nbsp;&nbsp;&nbsp;
                Digital design meets real-world production. &nbsp;&nbsp;&nbsp;&nbsp;
                Digital design meets real-world production. &nbsp;&nbsp;&nbsp;&nbsp;
                Digital design meets real-world production. &nbsp;&nbsp;&nbsp;&nbsp;
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Floating Elements */}
        <motion.div 
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-10 hidden lg:block"
        >
          <div className="p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-black/5 shadow-xl rotate-[-6deg]">
            <Palette className="w-8 h-8 text-[#EFBB76]" />
          </div>
        </motion.div>
        <motion.div 
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 right-10 hidden lg:block"
        >
          <div className="p-4 bg-white/80 backdrop-blur-md rounded-2xl border border-black/5 shadow-xl rotate-[12deg]">
            <Sparkles className="w-8 h-8 text-[#EFBB76]" />
          </div>
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-6 border-b border-black/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">How Custom Rugs Work</h2>
            <p className="text-black/60 text-lg font-medium italic max-w-2xl mx-auto">
              From idea to finished rug — here’s how we bring your design to life.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {[
              {
                step: "01",
                title: "Share Your Idea",
                desc: "Describe your rug — style, colors, pattern, or inspiration."
              },
              {
                step: "02",
                title: "Refine the Design",
                desc: "Adjust materials, textures, size, and proportions."
              },
              {
                step: "03",
                title: "Produce Your Rug",
                desc: "We translate your design into production-ready specifications and begin manufacturing."
              }
            ].map((item, i) => (
              <div key={i} className="relative group">
                <span className="text-5xl font-serif font-black text-[#EFBB76]/20 mb-6 block group-hover:text-[#EFBB76]/40 transition-colors">
                  {item.step}
                </span>
                <h3 className="text-2xl font-bold mb-4 tracking-tight">{item.title}</h3>
                <div className="w-12 h-0.5 bg-[#EFBB76] mb-6" />
                <p className="text-black/50 leading-relaxed font-medium">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 bg-black/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-serif font-bold mb-4">Why Choose Our Platform?</h2>
            <p className="text-black/40 max-w-xl mx-auto">We combine traditional craftsmanship with cutting-edge technology to deliver unparalleled quality.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Zap, title: "AI Generation", desc: "Instantly visualize complex patterns and color palettes with our proprietary AI." },
              { icon: ShieldCheck, title: "Artisan Quality", desc: "Every rug is hand-crafted by master weavers in Nepal and India using premium materials." },
              { icon: Globe, title: "Ethical Sourcing", desc: "We ensure fair wages and sustainable practices throughout our entire supply chain." },
              { icon: Ruler, title: "Custom Sizing", desc: "From small accents to massive wall-to-wall installations, we fit any space." }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -10 }}
                className="p-8 bg-white rounded-[32px] border border-black/5 shadow-sm"
              >
                <div className="w-12 h-12 bg-[#EFBB76]/10 rounded-2xl flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-[#EFBB76]" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-sm text-black/50 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section className="py-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1">
            <span className="text-[10px] font-bold text-[#EFBB76] uppercase tracking-[0.3em] block mb-4">Visualizer</span>
            <h2 className="text-5xl font-serif font-bold mb-8 leading-tight">See it in your space <br />before it's made.</h2>
            <p className="text-lg text-black/60 mb-10 leading-relaxed">
              Our advanced visualizer allows you to see your design in high-resolution, with realistic textures and lighting. Adjust pile heights, materials, and finishes with a single click.
            </p>
            <div className="space-y-4">
              {['Realistic Material Rendering', 'Multiple Lighting Scenarios', 'AR Integration Ready'].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                  <span className="text-sm font-bold text-black/80">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="aspect-square rounded-[40px] overflow-hidden shadow-2xl border-8 border-white">
              <img 
                src="https://picsum.photos/seed/rug-visual/1000/1000" 
                alt="Visualizer Preview" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -bottom-10 -left-10 p-8 bg-white rounded-3xl shadow-2xl border border-black/5 max-w-[240px]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#EFBB76]" />
                <div>
                  <div className="text-xs font-bold">NZ Wool</div>
                  <div className="text-[10px] text-black/40">Premium Fiber</div>
                </div>
              </div>
              <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                <div className="h-full w-[85%] bg-[#EFBB76]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto bg-black text-white rounded-[48px] p-12 md:p-24 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#EFBB76] via-transparent to-transparent" />
          </div>
          <div className="relative z-10">
            <h2 className="text-4xl md:text-6xl font-serif font-bold mb-8">Start Your Custom Rug</h2>
            <p className="text-white/60 mb-12 max-w-xl mx-auto">Start with an idea — design your rug and bring it into real production with Opul Mkt.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button 
                onClick={() => navigate('/design')}
                className="px-12 py-6 bg-[#EFBB76] text-black font-black text-xl rounded-full hover:bg-[#DBA762] transition-all shadow-[0_0_50px_rgba(239,187,118,0.3)] w-full sm:w-auto"
              >
                Start Designing
              </button>
              <button 
                onClick={() => window.open('mailto:hello@opul.mkt')}
                className="px-12 py-6 bg-white/10 text-white font-black text-xl rounded-full hover:bg-white/20 transition-all border border-white/10 w-full sm:w-auto"
              >
                Work With Our Team
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
