export interface MaterialType {
  id: string;
  name: string;
  tier?: 'Standard' | 'Premium' | 'Ultra Premium';
}

export interface DetailedPricing {
  lowestMargin: number;
  highestMargin: number;
  mov: number;
}

export interface RugConfig {
  prompt: string;
  colors: string[];
  materialTypes: string[];
  preset: string;
  width: number;
  length: number;
  shape: string;
  construction: string;
  pileType: string;
  pileHeight: string;
  surfaceFinishes: string[];
  seed: number;
  midjourneyMode: boolean;
}

export type AppView = 'landing' | 'visualizer' | 'pricing' | 'samples' | 'tiers' | 'checkout' | 'dashboard' | 'wishlist';

export interface SavedDesign {
  id: string;
  name: string;
  imageUrl: string;
  config: RugConfig;
  folderId: string;
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Preset {
  id: string;
  name: string;
  colors: string[];
}
// ... rest of the types

export interface ConstructionType {
  id: string;
  name: string;
  multiplier: number;
  tier: 'Standard' | 'Fine' | 'Premium' | 'Ultra Premium';
}

export interface PileType {
  id: string;
  name: string;
}

export interface PileHeight {
  id: string;
  name: string;
}

export interface SurfaceFinish {
  id: string;
  name: string;
  pricePerSqFt: number;
}

export interface Order {
  id?: string;
  userId: string;
  type: 'Rug Order' | 'Plan Upgrade' | 'Deposit';
  status: 'Pending' | 'Paid' | 'Processing' | 'Cancelled';
  amount: number;
  currency: string;
  paymentMethod: string;
  config?: RugConfig;
  imageUrl?: string;
  createdAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  credits: number;
  tier: string;
  role: 'user' | 'admin';
  pendingUpgradeId?: string | null;
  pendingTierId?: string | null;
  createdAt: any;
  updatedAt?: any;
}
