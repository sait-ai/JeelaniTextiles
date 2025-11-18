/**
 * @file state/store.js
 * @description Global state management with Zustand and Zod validation
 * @version 2.0.0
 */

import { SafeStorage } from '../utils/storage.js';

// Note: Zustand and Zod are loaded via CDN in HTML
// Access via window.zustand and window.zod

/**
 * Validation schemas
 */
const cartItemSchema = window.zod.object({
  id: window.zod.string(),
  name: window.zod.string(),
  price: window.zod.number(),
  qty: window.zod.number().positive(),
  image: window.zod.string().optional(),
  thumbnail: window.zod.string().optional()
});

const cartSchema = window.zod.array(cartItemSchema);

const settingsSchema = window.zod.object({
  theme: window.zod.enum(['light', 'dark', 'sepia', 'high-contrast']),
  gridSize: window.zod.number().int().min(2).max(4),
  lang: window.zod.string().min(2).max(5)
});

/**
 * Validate cart data
 * @param {Array} stored - Stored cart data
 * @returns {Array} Validated cart
 */
const validateCart = (stored) => {
  try {
    const result = cartSchema.safeParse(stored);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
};

/**
 * Validate settings data
 * @param {Object} stored - Stored settings
 * @returns {Object} Validated settings
 */
const validateSettings = (stored) => {
  try {
    const result = settingsSchema.safeParse(stored);
    return result.success ? result.data : {
      theme: 'light',
      gridSize: 3,
      lang: 'en'
    };
  } catch {
    return { theme: 'light', gridSize: 3, lang: 'en' };
  }
};

/**
 * Create Zustand store
 */
export const useAppState = window.zustand.create((set, get) => ({
  // State
  products: [],
  cart: validateCart(SafeStorage.getJSON('offlineCart', [])),
  currentPage: 1,
  lastVisible: null,
  isLoading: false,
  settings: validateSettings(SafeStorage.getJSON('userSettings', null)),

  // Actions
  setProducts: (products) => set({ products }),
  addProducts: (newProducts) => set((state) => ({ 
    products: [...state.products, ...newProducts] 
  })),
  
  setCart: (cart) => {
    const validated = validateCart(cart);
    SafeStorage.setJSON('offlineCart', validated);
    set({ cart: validated });
  },
  
  updateCart: (updater) => {
    const newCart = updater(get().cart);
    const validated = validateCart(newCart);
    SafeStorage.setJSON('offlineCart', validated);
    set({ cart: validated });
  },
  
  setSettings: (settings) => {
    const validated = validateSettings(settings);
    SafeStorage.setJSON('userSettings', validated);
    set({ settings: validated });
  },
  
  updateSettings: (updater) => {
    const newSettings = updater(get().settings);
    const validated = validateSettings(newSettings);
    SafeStorage.setJSON('userSettings', validated);
    set({ settings: validated });
  },
  
  setCurrentPage: (page) => set({ currentPage: page }),
  setLastVisible: (lastVisible) => set({ lastVisible }),
  setLoading: (isLoading) => set({ isLoading })
}));

/**
 * Proxy for backward compatibility with old script.js
 * @deprecated Use useAppState directly
 */
export const appState = new Proxy({}, {
  get(target, prop) {
    return useAppState.getState()[prop];
  },
  set(target, prop, value) {
    const state = useAppState.getState();
    
    if (prop === 'cart') {
      state.setCart(value);
    } else if (prop === 'settings') {
      state.setSettings(value);
    } else if (prop === 'products') {
      state.setProducts(value);
    } else if (prop === 'currentPage') {
      state.setCurrentPage(value);
    } else if (prop === 'lastVisible') {
      state.setLastVisible(value);
    } else if (prop === 'isLoading') {
      state.setLoading(value);
    }
    
    return true;
  }
});

export default useAppState;