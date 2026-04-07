import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Palette, Ruler, Layers, Move, ArrowRight, ChevronLeft, Plus, Minus, Lock, X } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  MATERIAL_TYPES, 
  CONSTRUCTIONS, 
  PILE_TYPES, 
  PILE_HEIGHTS, 
  SURFACE_FINISHES 
} from '../constants';
import { RugConfig } from '../types';

const SIZE_PRESETS = [
  { id: '5x8', name: '5\' x 8\'', w: 5, l: 8 },
  { id: '8x10', name: '8\' x 10\'', w: 8, l: 10 },
  { id: '9x12', name: '9\' x 12\'', w: 9, l: 12 },
  { id: '10x14', name: '10\' x 14\'', w: 10, l: 14 },
];

import { storage } from '../lib/storage';
import { useFirebase } from '../components/FirebaseProvider';

const PRESET_COLORS = [
  '#EFBB76', '#1A1A1A', '#FFFFFF', '#E0E0E0', '#8B4513', 
  '#2F4F4F', '#483D8B', '#B22222', '#556B2F', '#FFD700',
  '#4682B4', '#D2691E', '#9ACD32', '#800000', '#008080'
];

export const DesignPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRegenerateMode = searchParams.get('mode') === 'regenerate';
  const [activeColorIndex, setActiveColorIndex] = useState<number | null>(null);
  const [unit, setUnit] = useState<'ft' | 'm'>('ft');

  const { user, profile } = useFirebase();
  const [config, setConfig] = useState<RugConfig>({
    prompt: '',
    colors: ['#EFBB76'],
    materialTypes: ['nz-wool'],
    preset: 'custom',
    width: 8,
    length: 10,
    construction: 'knotted-40',
    pileType: 'cut',
    pileHeight: 'standard',
    surfaceFinishes: ['tip-shear', 'sculpted'],
    seed: Math.floor(Math.random() * 1000000),
    midjourneyMode: false,
    shape: 'rectangle'
  });

  const hasLoadedInitial = React.useRef(false);

  React.useEffect(() => {
    const loadInitial = async () => {
      if (hasLoadedInitial.current) return;
      hasLoadedInitial.current = true;

      const saved = await storage.getLarge<RugConfig>('rug_current_config');
      const initialPrompt = storage.getSmall('rug_initial_prompt');
      
      // If it's a fresh start from landing page (initialPrompt exists), 
      // OR if there's no saved config at all, force 1 color.
      if (initialPrompt || !saved) {
        setConfig(prev => ({ 
          ...prev, 
          prompt: initialPrompt || prev.prompt,
          colors: ['#EFBB76'],
          materialTypes: ['nz-wool']
        }));
        if (initialPrompt) storage.remove('rug_initial_prompt');
      } else if (saved) {
        // Only load saved config if we're not coming from a fresh prompt
        try {
          setConfig(saved);
        } catch (e) {
          console.error("Failed to parse saved config", e);
        }
      }
    };
    loadInitial();
  }, []);

  const addColor = () => {
    if (config.colors.length >= 20) return;
    setConfig({
      ...config,
      colors: [...config.colors, '#FFFFFF'],
      materialTypes: [...config.materialTypes, MATERIAL_TYPES[0].id],
      preset: 'custom'
    });
  };

  const removeColor = () => {
    if (config.colors.length <= 1) return;
    setConfig({
      ...config,
      colors: config.colors.slice(0, -1),
      materialTypes: config.materialTypes.slice(0, -1),
      preset: 'custom'
    });
  };

  const updateColor = React.useCallback((index: number, color: string) => {
    setConfig(prev => {
      if (prev.colors[index] === color) return prev;
      const newColors = [...prev.colors];
      newColors[index] = color;
      return { ...prev, colors: newColors, preset: 'custom' };
    });
  }, []);

  const updateMaterialType = React.useCallback((index: number, material: string) => {
    setConfig(prev => {
      if (prev.materialTypes[index] === material) return prev;
      const newMaterials = [...prev.materialTypes];
      newMaterials[index] = material;
      return { ...prev, materialTypes: newMaterials };
    });
  }, []);

  const toggleFinish = React.useCallback((id: string) => {
    setConfig(prev => {
      const exists = prev.surfaceFinishes.includes(id);
      return {
        ...prev,
        surfaceFinishes: exists
          ? prev.surfaceFinishes.filter(f => f !== id)
          : [...prev.surfaceFinishes, id]
      };
    });
  }, []);

  const handleVisualize = async () => {
    // Save config to IndexedDB
    await storage.setLarge('rug_current_config', config);
    // Clear old images to trigger fresh generation for the new config
    if (!isRegenerateMode) {
      await storage.remove('rug_generated_images');
      await storage.remove('rug_selected_variation');
      navigate('/visualizer');
    } else {
      // For regeneration, we tell visualizer to generate only 1
      navigate('/visualizer?isRegeneration=true');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-6 py-12"
    >
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-[#EFBB76] text-[#EFBB76] font-bold rounded-full hover:bg-[#EFBB76] hover:text-black transition-all group mb-8"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back
      </button>

      <header className="mb-12 text-center relative">
        <h1 className="text-5xl font-serif font-bold text-[#EFBB76] mb-4 tracking-tight">
          {isRegenerateMode ? 'Refine Your Selection' : 'Customize Your Rug'}
        </h1>
        <p className="text-black/40 text-lg max-w-xl mx-auto">
          {isRegenerateMode 
            ? 'Adjust colors and textures for your selected design. Prompt and size are locked for consistency.' 
            : 'Customize your rug by selecting colors, materials, size, and construction — built for real production through Opul Mkt.'}
        </p>
      </header>

      <div className="space-y-12">
        {/* Color Selection */}
        <section className="bg-black/5 p-8 rounded-3xl border border-black/10 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <label className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#EFBB76]">
              <Palette className="w-4 h-4" /> 1. Choose Color Palette (Up to 20 Colors)
            </label>
            <div className="flex items-center gap-4">
              <button 
                onClick={addColor}
                disabled={config.colors.length >= 20}
                className="px-4 py-2 bg-white border border-black/10 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-[#EFBB76] hover:text-[#EFBB76] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
              >
                <Plus className="w-3 h-3" /> Add more colors
              </button>
              {config.colors.length > 1 && (
                <button 
                  onClick={removeColor}
                  className="p-2 text-black/20 hover:text-red-500 transition-colors border border-black/5 rounded-lg bg-white/50"
                  title="Remove Last Color"
                >
                  <Minus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 relative">
            {config.colors.map((color, index) => (
              <div key={index} className="relative flex flex-col items-center gap-6 p-6 bg-white rounded-[40px] border border-black/5 shadow-sm hover:shadow-md transition-all group/card">
                <div 
                  className="relative w-full aspect-square bg-black/5 p-4 rounded-[32px] border border-black/10 group/color cursor-pointer overflow-hidden shadow-inner"
                  onClick={() => setActiveColorIndex(activeColorIndex === index ? null : index)}
                >
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                    <div 
                      className="w-24 h-24 rounded-full border-4 border-black/5 shadow-2xl flex items-center justify-center transition-transform group-hover/color:scale-110"
                      style={{ backgroundColor: color }}
                    >
                      <Plus className="w-12 h-12 text-white mix-blend-difference" strokeWidth={3} />
                    </div>
                    <span className="text-xs font-black text-black/20 uppercase tracking-[0.3em]">Tap to Pick</span>
                  </div>
                </div>

                {/* Popover Color Picker */}
                <AnimatePresence>
                  {activeColorIndex === index && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.95 }}
                      className="absolute left-[calc(100%+20px)] top-0 z-50 bg-white p-6 rounded-[32px] border border-black/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-[320px] hidden lg:block"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/40">Color Picker</span>
                        <button onClick={() => setActiveColorIndex(null)} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                          <X className="w-4 h-4 text-black/40" />
                        </button>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="h-[200px]">
                          <HexColorPicker 
                            color={color} 
                            onChange={(newColor) => updateColor(index, newColor)} 
                            className="!w-full !h-full"
                          />
                        </div>
                        
                        <div className="space-y-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-black/40 block">Preset Palette</span>
                          <div className="grid grid-cols-5 gap-2">
                            {PRESET_COLORS.map(pc => (
                              <button
                                key={pc}
                                onClick={() => updateColor(index, pc)}
                                className={`w-full aspect-square rounded-lg border-2 transition-transform hover:scale-110 ${color === pc ? 'border-[#EFBB76]' : 'border-transparent'}`}
                                style={{ backgroundColor: pc }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mobile/Small Screen Picker (Inline) */}
                <AnimatePresence>
                  {activeColorIndex === index && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="w-full overflow-hidden lg:hidden"
                    >
                      <div className="p-4 bg-black/5 rounded-2xl space-y-4 mt-2">
                        <HexColorPicker 
                          color={color} 
                          onChange={(newColor) => updateColor(index, newColor)} 
                          className="!w-full !h-[150px]"
                        />
                        <div className="grid grid-cols-5 gap-2">
                          {PRESET_COLORS.map(pc => (
                            <button
                              key={pc}
                              onClick={() => updateColor(index, pc)}
                              className="w-full aspect-square rounded-lg"
                              style={{ backgroundColor: pc }}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="w-full space-y-4">
                  <div className="flex items-center justify-center gap-3 py-2 bg-black/5 rounded-2xl">
                    <div 
                      className="w-5 h-5 rounded-full border-2 border-white shadow-sm" 
                      style={{ backgroundColor: color }} 
                    />
                    <span className="text-xs font-mono font-black text-black/60 uppercase tracking-widest">
                      {color}
                    </span>
                  </div>
                  <div className="relative w-full">
                    <select
                      value={config.materialTypes[index]}
                      onChange={(e) => updateMaterialType(index, e.target.value)}
                      className="w-full bg-black text-white border-none rounded-2xl pl-4 pr-12 py-5 text-[11px] font-black uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-[#EFBB76]/20 transition-all appearance-none cursor-pointer overflow-hidden text-ellipsis"
                    >
                      <optgroup label="Standard" className="bg-white text-black">
                        {MATERIAL_TYPES.filter(m => m.tier === 'Standard').map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Premium (Available for pro users only)" className="bg-white text-black">
                        {MATERIAL_TYPES.filter(m => m.tier === 'Premium').map(m => (
                          <option key={m.id} value={m.id} disabled={profile?.tier !== 'pro'}>
                            {m.name} {profile?.tier !== 'pro' ? '🔒' : ''}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Ultra Premium (Available for pro users only)" className="bg-white text-black">
                        {MATERIAL_TYPES.filter(m => m.tier === 'Ultra Premium').map(m => (
                          <option key={m.id} value={m.id} disabled={profile?.tier !== 'pro'}>
                            {m.name} {profile?.tier !== 'pro' ? '🔒' : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Plus className="w-4 h-4 text-[#EFBB76]" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Size Selection */}
        <section className={`bg-black/5 p-8 rounded-3xl border border-black/10 shadow-sm ${isRegenerateMode ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#EFBB76]">
                <Ruler className="w-4 h-4" /> 2. Select Size {isRegenerateMode && '(Locked)'}
              </label>
              <p className="text-[10px] text-black/40 font-medium">
                Choose a standard size or enter custom dimensions.
              </p>
            </div>
            <div className="flex bg-white rounded-lg p-1 border border-black/5 shadow-sm">
              <button
                onClick={() => setUnit('ft')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${unit === 'ft' ? 'bg-[#EFBB76] text-black' : 'text-black/40 hover:text-black'}`}
              >
                FT
              </button>
              <button
                onClick={() => setUnit('m')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${unit === 'm' ? 'bg-[#EFBB76] text-black' : 'text-black/40 hover:text-black'}`}
              >
                M
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="grid grid-cols-2 gap-3">
              {SIZE_PRESETS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setConfig({ ...config, width: s.w, length: s.l })}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    config.width === s.w && config.length === s.l
                    ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                    : 'bg-white border-black/5 hover:border-black/20'
                  }`}
                >
                  <span className="text-sm font-bold">{unit === 'ft' ? s.name : `${(s.w * 0.3048).toFixed(2)}m x ${(s.l * 0.3048).toFixed(2)}m`}</span>
                </button>
              ))}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-black/20 uppercase">Width ({unit})</span>
                <input
                  type="number"
                  step="0.1"
                  value={unit === 'ft' ? config.width : (config.width * 0.3048).toFixed(2)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setConfig({ ...config, width: unit === 'ft' ? val : val / 0.3048 });
                  }}
                  className="w-full bg-white border border-black/10 rounded-xl pl-20 pr-4 py-4 focus:outline-none focus:border-[#EFBB76]/50 transition-all font-bold text-black"
                />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-black/20 uppercase">Length ({unit})</span>
                <input
                  type="number"
                  step="0.1"
                  value={unit === 'ft' ? config.length : (config.length * 0.3048).toFixed(2)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setConfig({ ...config, length: unit === 'ft' ? val : val / 0.3048 });
                  }}
                  className="w-full bg-white border border-black/10 rounded-xl pl-20 pr-4 py-4 focus:outline-none focus:border-[#EFBB76]/50 transition-all font-bold text-black"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Technical Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Construction */}
          <section className="bg-black/5 p-8 rounded-3xl border border-black/10 shadow-sm">
            <label className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#EFBB76] mb-6">
              <Layers className="w-4 h-4" /> 3. Construction Type
            </label>
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-3">Standard</span>
                <div className="space-y-2">
                  {CONSTRUCTIONS.filter(c => c.tier === 'Standard').map(c => (
                    <button
                      key={c.id}
                      onClick={() => setConfig({ ...config, construction: c.id })}
                      className={`w-full px-4 py-3 text-sm rounded-xl border flex justify-between items-center transition-all ${
                        config.construction === c.id 
                        ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                        : 'bg-white border-black/5 hover:border-black/20'
                      }`}
                    >
                      <span className="font-medium">{c.name.split(' — ')[0]}</span>
                      <ArrowRight className={`w-4 h-4 ${config.construction === c.id ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-3">Fine</span>
                <div className="space-y-2">
                  {CONSTRUCTIONS.filter(c => c.tier === 'Fine').map(c => (
                    <button
                      key={c.id}
                      onClick={() => setConfig({ ...config, construction: c.id })}
                      className={`w-full px-4 py-3 text-sm rounded-xl border flex justify-between items-center transition-all ${
                        config.construction === c.id 
                        ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                        : 'bg-white border-black/5 hover:border-black/20'
                      }`}
                    >
                      <span className="font-medium">{c.name.split(' — ')[0]}</span>
                      <ArrowRight className={`w-4 h-4 ${config.construction === c.id ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-3">Premium</span>
                <div className="space-y-2">
                  {CONSTRUCTIONS.filter(c => c.tier === 'Premium').map(c => (
                    <button
                      key={c.id}
                      disabled={profile?.tier !== 'pro'}
                      onClick={() => setConfig({ ...config, construction: c.id })}
                      className={`w-full px-4 py-3 text-sm rounded-xl border flex justify-between items-center transition-all ${
                        config.construction === c.id 
                        ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                        : 'bg-white border-black/5 hover:border-black/20'
                      } ${profile?.tier !== 'pro' ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                    >
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.name.split(' — ')[0]}</span>
                          {profile?.tier !== 'pro' && <Lock className="w-3 h-3 text-[#EFBB76]" />}
                        </div>
                        {profile?.tier !== 'pro' && <span className="text-[8px] font-black text-[#EFBB76] uppercase tracking-tighter">Available for pro users only</span>}
                      </div>
                      <ArrowRight className={`w-4 h-4 ${config.construction === c.id ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-3">Ultra Premium</span>
                <div className="space-y-2">
                  {CONSTRUCTIONS.filter(c => c.tier === 'Ultra Premium').map(c => (
                    <button
                      key={c.id}
                      disabled={profile?.tier !== 'pro'}
                      onClick={() => setConfig({ ...config, construction: c.id })}
                      className={`w-full px-4 py-3 text-sm rounded-xl border flex justify-between items-center transition-all ${
                        config.construction === c.id 
                        ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                        : 'bg-white border-black/5 hover:border-black/20'
                      } ${profile?.tier !== 'pro' ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                    >
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.name.split(' — ')[0]}</span>
                          {profile?.tier !== 'pro' && <Lock className="w-3 h-3 text-[#EFBB76]" />}
                        </div>
                        {profile?.tier !== 'pro' && <span className="text-[8px] font-black text-[#EFBB76] uppercase tracking-tighter">Available for pro users only</span>}
                      </div>
                      <ArrowRight className={`w-4 h-4 ${config.construction === c.id ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Pile & Finish */}
          <section className="bg-black/5 p-8 rounded-3xl border border-black/10 shadow-sm">
            <label className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#EFBB76] mb-6">
              <Move className="w-4 h-4" /> 4. Texture & Finish
            </label>
            
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-3">Pile Type</span>
                <div className="flex gap-2">
                  {PILE_TYPES.map(p => {
                    const [name, subtextRaw] = p.name.split(' (');
                    const subtext = subtextRaw ? subtextRaw.replace(')', '') : '';
                    return (
                      <button
                        key={p.id}
                        onClick={() => setConfig({ ...config, pileType: p.id })}
                        className={`flex-1 py-3 px-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                          config.pileType === p.id 
                          ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                          : 'bg-white border-black/5 hover:border-black/20'
                        }`}
                      >
                        <span className="text-xs font-bold">{name}</span>
                        {subtext && <span className="text-[8px] font-medium opacity-60 uppercase tracking-widest">{subtext}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-3">Pile Height</span>
                <div className="grid grid-cols-2 gap-2">
                  {PILE_HEIGHTS.map(p => {
                    const [name, subtext] = p.name.split(' — ');
                    return (
                      <button
                        key={p.id}
                        onClick={() => setConfig({ ...config, pileHeight: p.id })}
                        className={`py-3 px-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                          config.pileHeight === p.id 
                          ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                          : 'bg-white border-black/5 hover:border-black/20'
                        }`}
                      >
                        <span className="text-xs font-bold">{name}</span>
                        {subtext && <span className="text-[8px] font-medium opacity-60 uppercase tracking-widest">{subtext}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest block mb-3">Surface Finish</span>
                <div className="grid grid-cols-2 gap-2">
                  {SURFACE_FINISHES.map(f => {
                    const [name, subtext] = f.name.split(' — ');
                    return (
                      <button
                        key={f.id}
                        onClick={() => toggleFinish(f.id)}
                        className={`py-3 px-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                          config.surfaceFinishes.includes(f.id)
                          ? 'bg-[#EFBB76]/10 border-[#EFBB76] text-[#EFBB76]' 
                          : 'bg-white border-black/5 hover:border-black/20'
                        }`}
                      >
                        <span className="text-xs font-bold">{name}</span>
                        {subtext && <span className="text-[8px] font-medium opacity-60 uppercase tracking-widest">{subtext}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Action Button */}
        <div className="pt-8 flex flex-col items-center gap-4">
          <button
            onClick={handleVisualize}
            disabled={!config.prompt}
            className="btn-primary px-12 py-5 text-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(239,187,118,0.3)]"
          >
            {isRegenerateMode ? 'Regenerate Design' : 'Preview Your Rug'} 
            <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
          </button>
          <p className="text-[11px] text-black/40 font-medium italic">
            Your selections will be used to generate a production-ready design.
          </p>
        </div>
      </div>
    </motion.div>
  );
};
