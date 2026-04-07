import { get, set, del, clear, keys } from 'idb-keyval';

/**
 * A robust storage utility that uses IndexedDB for large data (images, configs)
 * and falls back to localStorage for small, simple values.
 * This prevents 'QuotaExceededError' when storing base64 images.
 */

export const storage = {
  /**
   * Save a value to IndexedDB (for large data)
   */
  async setLarge(key: string, value: any): Promise<void> {
    try {
      await set(key, value);
    } catch (error) {
      console.error(`IndexedDB error saving ${key}:`, error);
      // Fallback to localStorage if IndexedDB fails (unlikely)
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.warn(`LocalStorage also failed for ${key}:`, e);
      }
    }
  },

  /**
   * Get a value from IndexedDB
   */
  async getLarge<T>(key: string): Promise<T | null> {
    try {
      const val = await get(key);
      if (val !== undefined) return val as T;
      
      // Fallback to check localStorage for legacy data
      const legacy = localStorage.getItem(key);
      if (legacy) {
        try {
          return JSON.parse(legacy) as T;
        } catch (e) {
          return legacy as unknown as T;
        }
      }
      return null;
    } catch (error) {
      console.error(`IndexedDB error getting ${key}:`, error);
      return null;
    }
  },

  /**
   * Remove a value from both IndexedDB and localStorage
   */
  async remove(key: string): Promise<void> {
    await del(key);
    localStorage.removeItem(key);
  },

  /**
   * Clear all IndexedDB data
   */
  async clearAll(): Promise<void> {
    await clear();
  },

  /**
   * Standard localStorage for small things (sync)
   */
  setSmall(key: string, value: string): void {
    localStorage.setItem(key, value);
  },

  getSmall(key: string): string | null {
    return localStorage.getItem(key);
  }
};
