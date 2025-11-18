/**
 * @file store.js
 * @description Zustand state management store
 * @version 2.0.0
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/**
 * Main application store using Zustand
 */
export const useAppState = create(
  devtools(
    persist(
      (set, get) => ({
        // ============================================================================
        // CART STATE
        // ============================================================================
        cart: [],
        cartCount: 0,
        cartTotal: 0,

        addToCart: (product, quantity = 1) => {
          const cart = get().cart;
          const existingIndex = cart.findIndex(item => item.id === product.id);

          let newCart;
          if (existingIndex > -1) {
            newCart = cart.map((item, index) =>
              index === existingIndex
                ? { ...item, quantity: item.quantity + quantity }
                : item
            );
          } else {
            newCart = [...cart, { ...product, quantity }];
          }

          const cartTotal = newCart.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
          );

          set({
            cart: newCart,
            cartCount: newCart.reduce((sum, item) => sum + item.quantity, 0),
            cartTotal
          });
        },

        removeFromCart: (productId) => {
          const cart = get().cart;
          const newCart = cart.filter(item => item.id !== productId);
          const cartTotal = newCart.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
          );

          set({
            cart: newCart,
            cartCount: newCart.reduce((sum, item) => sum + item.quantity, 0),
            cartTotal
          });
        },

        updateCartQuantity: (productId, quantity) => {
          if (quantity <= 0) {
            get().removeFromCart(productId);
            return;
          }

          const cart = get().cart;
          const newCart = cart.map(item =>
            item.id === productId ? { ...item, quantity } : item
          );
          const cartTotal = newCart.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
          );

          set({
            cart: newCart,
            cartCount: newCart.reduce((sum, item) => sum + item.quantity, 0),
            cartTotal
          });
        },

        clearCart: () => {
          set({ cart: [], cartCount: 0, cartTotal: 0 });
        },

        // ============================================================================
        // PRODUCTS STATE
        // ============================================================================
        products: [],
        filteredProducts: [],
        activeCategory: 'all',
        searchQuery: '',
        loading: false,

        setProducts: (products) => {
          set({ products, filteredProducts: products });
        },

        filterByCategory: (category) => {
          const products = get().products;
          const filtered =
            category === 'all'
              ? products
              : products.filter(p => p.category === category);

          set({
            activeCategory: category,
            filteredProducts: filtered
          });
        },

        searchProducts: (query) => {
          const products = get().products;
          const lowerQuery = query.toLowerCase();
          const filtered = products.filter(
            p =>
              p.name.toLowerCase().includes(lowerQuery) ||
              p.description?.toLowerCase().includes(lowerQuery)
          );

          set({
            searchQuery: query,
            filteredProducts: filtered
          });
        },

        setLoading: (loading) => {
          set({ loading });
        },

        // ============================================================================
        // USER STATE
        // ============================================================================
        user: null,
        isAuthenticated: false,

        setUser: (user) => {
          set({
            user,
            isAuthenticated: !!user
          });
        },

        logout: () => {
          set({
            user: null,
            isAuthenticated: false
          });
        },

        // ============================================================================
        // UI STATE
        // ============================================================================
        theme: 'light',
        modalOpen: false,
        mobileMenuOpen: false,
        toastMessage: null,

        setTheme: (theme) => {
          set({ theme });
        },

        toggleModal: (open) => {
          set({ modalOpen: open ?? !get().modalOpen });
        },

        toggleMobileMenu: (open) => {
          set({ mobileMenuOpen: open ?? !get().mobileMenuOpen });
        },

        showToast: (message, type = 'info') => {
          set({ toastMessage: { message, type, timestamp: Date.now() } });
          setTimeout(() => set({ toastMessage: null }), 3000);
        },

        // ============================================================================
        // WISHLIST STATE
        // ============================================================================
        wishlist: [],

        addToWishlist: (product) => {
          const wishlist = get().wishlist;
          if (!wishlist.find(p => p.id === product.id)) {
            set({ wishlist: [...wishlist, product] });
          }
        },

        removeFromWishlist: (productId) => {
          const wishlist = get().wishlist;
          set({ wishlist: wishlist.filter(p => p.id !== productId) });
        },

        isInWishlist: (productId) => {
          return get().wishlist.some(p => p.id === productId);
        }
      }),
      {
        name: 'jeelani-textiles-store',
        partialize: (state) => ({
          cart: state.cart,
          cartCount: state.cartCount,
          cartTotal: state.cartTotal,
          wishlist: state.wishlist,
          theme: state.theme
        })
      }
    ),
    { name: 'JeelaniTextiles' }
  )
);

export default useAppState;