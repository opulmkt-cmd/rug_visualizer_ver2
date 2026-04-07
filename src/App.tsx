import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { DesignPage } from './pages/DesignPage';
import { RugVisualizerPage } from './pages/RugVisualizerPage';
import { DesignDetailPage } from './pages/DesignDetailPage';
import { SamplePage } from './pages/SamplePage';
import { FeatureTiersPage } from './pages/FeatureTiersPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { DashboardPage } from './pages/DashboardPage';
import { WishlistPage } from './pages/WishlistPage';
import { FirebaseProvider, ErrorBoundary } from './components/FirebaseProvider';

import { storage } from './lib/storage';

export default function App() {
  React.useEffect(() => {
    // Global storage cleanup and migration on startup
    const migrateAndCleanup = async () => {
      try {
        // 1. Migrate large items to IndexedDB if they still exist in localStorage
        const largeKeys = ['rug_current_config', 'rug_generated_images', 'rug_selected_image', 'rug_saved_designs'];
        for (const key of largeKeys) {
          const val = localStorage.getItem(key);
          if (val) {
            try {
              const parsed = JSON.parse(val);
              await storage.setLarge(key, parsed);
              localStorage.removeItem(key);
              console.log(`Migrated ${key} to IndexedDB`);
            } catch (e) {
              // If not JSON, store as is
              await storage.setLarge(key, val);
              localStorage.removeItem(key);
            }
          }
        }

        // 2. Cleanup old generation data
        const lastGenTime = storage.getSmall('rug_last_gen_time');
        if (lastGenTime) {
          const diff = Date.now() - parseInt(lastGenTime);
          if (diff > 3600000) { // 1 hour
            await storage.remove('rug_generated_images');
            await storage.remove('rug_selected_variation');
          }
        }
      } catch (e) {
        console.warn("Storage migration/cleanup failed", e);
      }
    };

    migrateAndCleanup();
  }, []);

  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/design" element={<DesignPage />} />
              <Route path="/visualizer" element={<RugVisualizerPage />} />
              <Route path="/design-detail" element={<DesignDetailPage />} />
              <Route path="/design-detail/:id" element={<DesignDetailPage />} />
              <Route path="/samples" element={<SamplePage />} />
              <Route path="/tiers" element={<FeatureTiersPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
            </Routes>
          </Layout>
        </Router>
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
