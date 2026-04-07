import { RugConfig } from '../types';
import { 
  HAND_TUFTED_PRICING, 
  HAND_KNOTTED_40_PRICING, 
  HAND_KNOTTED_80_PRICING, 
  HAND_KNOTTED_100_PRICING, 
  HAND_KNOTTED_120_PRICING,
  PRICING_FACTORS,
  COMPLEXITY_MULTIPLIERS,
  PILE_HEIGHT_MULTIPLIERS,
  SIZE_MULTIPLIERS,
  SHAPE_MULTIPLIERS,
  SURFACE_FINISH_MULTIPLIERS
} from '../constants';

export const calculateEstimate = (config: RugConfig) => {
  const area = config.width * config.length;
  const materialId = config.materialTypes[0] || 'nz-wool';
  
  let basePricing = HAND_TUFTED_PRICING[materialId] || HAND_TUFTED_PRICING['nz-wool'];
  
  if (config.construction === 'knotted-40') {
    basePricing = HAND_KNOTTED_40_PRICING[materialId] || HAND_KNOTTED_40_PRICING['nz-wool'];
  } else if (config.construction === 'knotted-80') {
    basePricing = HAND_KNOTTED_80_PRICING[materialId] || HAND_KNOTTED_80_PRICING['nz-wool'];
  } else if (config.construction === 'knotted-100') {
    basePricing = HAND_KNOTTED_100_PRICING[materialId] || HAND_KNOTTED_100_PRICING['nz-wool'];
  } else if (config.construction === 'knotted-120') {
    basePricing = HAND_KNOTTED_120_PRICING[materialId] || HAND_KNOTTED_120_PRICING['nz-wool'];
  }

  const baseCost = basePricing.lowestMargin;
  const mov = basePricing.mov;

  // Multipliers
  // Complexity (Colors)
  let complexityMult = COMPLEXITY_MULTIPLIERS.SIMPLE;
  if (config.colors.length > 10) {
    complexityMult = COMPLEXITY_MULTIPLIERS.COMPLEX;
  } else if (config.colors.length > 5) {
    complexityMult = COMPLEXITY_MULTIPLIERS.MEDIUM;
  }

  // Pile Height
  let pileHeightMult = PILE_HEIGHT_MULTIPLIERS.STANDARD;
  if (config.pileType === 'shag') {
    pileHeightMult = PILE_HEIGHT_MULTIPLIERS.SHAG;
  } else if (config.pileHeight === 'high') {
    pileHeightMult = PILE_HEIGHT_MULTIPLIERS.HIGH;
  } else if (config.pileHeight === 'low') {
    pileHeightMult = PILE_HEIGHT_MULTIPLIERS.LOW;
  }

  // Size
  let sizeMult = SIZE_MULTIPLIERS.STANDARD;
  if (area < 30) {
    sizeMult = SIZE_MULTIPLIERS.SMALL;
  } else if (area < 80) {
    sizeMult = SIZE_MULTIPLIERS.MEDIUM;
  } else if (area > 150) {
    sizeMult = SIZE_MULTIPLIERS.LARGE;
  }

  // Shape
  let shapeMult = SHAPE_MULTIPLIERS.RECTANGLE;
  if (config.shape === 'round' || config.shape === 'oval') {
    shapeMult = SHAPE_MULTIPLIERS.ROUND;
  } else if (config.shape === 'organic' || config.shape === 'irregular') {
    shapeMult = SHAPE_MULTIPLIERS.ORGANIC;
  }

  // Surface Detailing
  const finishMult = config.surfaceFinishes.reduce((acc, id) => {
    return acc * (SURFACE_FINISH_MULTIPLIERS[id] || 1.0);
  }, 1.0);

  const totalMultiplier = complexityMult * pileHeightMult * sizeMult * shapeMult * finishMult;

  // Step 1: Calculate Base Rates per Sqft
  const lowRate = baseCost * PRICING_FACTORS.LOW_CONFIDENCE * totalMultiplier;
  const highRate = baseCost * PRICING_FACTORS.HIGH_CONFIDENCE * PRICING_FACTORS.HIGH_BUFFER * totalMultiplier;

  // Step 2: Calculate Total Rug Cost (Raw)
  const calculatedLow = area * lowRate;
  const calculatedHigh = area * highRate;

  // Step 3: Apply MOV & High Floor
  const finalLow = Math.max(mov, calculatedLow);
  const finalHigh = Math.max(calculatedHigh, finalLow * PRICING_FACTORS.HIGH_FLOOR_MULTIPLIER);

  // Step 4: Margin Protection (Floor 0.4)
  const range = finalHigh - finalLow;
  const protectedLow = finalLow + (range * PRICING_FACTORS.MARGIN_PROTECTION_FLOOR);
  const adjustedHigh = finalHigh + ((protectedLow - finalLow) * PRICING_FACTORS.MARGIN_PROTECTION_FLOOR);

  // Rounding to nearest 100
  const roundedLow = Math.round(protectedLow / 100) * 100;
  const roundedHigh = Math.round(adjustedHigh / 100) * 100;

  // Manual Review Triggers
  const manualReview = 
    config.materialTypes.some(m => ['merino-wool', 'alpaca-wool', 'mohair', 'lincoln-wool'].includes(m)) ||
    area > 200 ||
    config.colors.length > 12 ||
    config.shape === 'organic' ||
    config.surfaceFinishes.includes('carved');

  // Lead Time Calculation
  let baseLeadTime = 4; // weeks
  if (config.construction.includes('knotted')) {
    const knots = parseInt(config.construction.split('-')[1]);
    if (knots >= 100) baseLeadTime = 12;
    else if (knots >= 80) baseLeadTime = 10;
    else baseLeadTime = 8;
  }
  
  if (config.colors.length > 8) baseLeadTime += 2;
  if (area > 100) baseLeadTime += 2;

  return {
    area,
    lowestTotal: roundedLow,
    highestTotal: roundedHigh,
    recommendedQuote: Math.round((roundedLow + roundedHigh) / 2 / 100) * 100,
    manualReview,
    leadTime: `${baseLeadTime}-${baseLeadTime + 4} weeks`,
    mov
  };
};
