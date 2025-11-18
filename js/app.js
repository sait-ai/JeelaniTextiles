/**
 * @file app.js
 * @description Main application orchestrator - entry point for all pages
 * @version 2.0.0
 * 
 * This is the ONLY file you need to import in your HTML:
 * <script type="module" src="/js/app.js"></script>
 */

// ============================================================================
// IMPORTS - All modules
// ============================================================================

// Core utilities
import { DOMUtils } from './utils/dom.js';
import { SafeStorage } from './utils/storage.js';
import { ThemeManager } from './utils/theme.js';
import { t } from './utils/i18n.js';

// State management
import { useAppState } from './state/store.js';

// Firebase services
import { initializeServices } from './firebase.js';

// Managers
import { ProductManager } from './managers/product.js';
import { CartManager } from './managers/cart.js';
import { FAQManager } from './managers/faq.js';
import { ContactManager } from './managers/contact.js';
import { AdminManager } from './managers/admin.js';
import { TestimonialManager } from './managers/testimonial.js';
import { RecommendationManager } from './managers/recommendation.js';

// Components
import { ModalManager } from './components/modal.js';

// Services
import { EventManager, SEOManager, SettingsManager, Router } from './services/index.js';

// ============================================================================
// MAIN APPLICATION CLASS
// ============================================================================

/**
 * Jeelani Textiles Application
 * Main orchestrator for the entire website
 */
export class JeelaniTextilesApp {
  static services = null;
  static initialized = false;

  /**
   * Initialize the application
   * @returns {Promise<void>}
   */
  static async init() {
    if (this.initialized) {
      console.warn('App already initialized');
      return;
    }

    const loader = DOMUtils.$('#loader');
    if (loader) loader.style.opacity = '1';

    try {
      console.log('🚀 Jeelani Textiles - Initializing...');

      // Step 1: Initialize Firebase services
      this.services = await initializeServices();
      console.log('✅ Firebase services ready');

      // Step 2: Initialize all managers in parallel
      const initTasks = [
        ThemeManager.init(),
        EventManager.init(),
        SEOManager.init(),
        SettingsManager.init(),
        this.initPageSpecificManagers(),
        this.registerServiceWorker(),
        this.setupGlobalKeyboardShortcuts(),
        this.setupOfflineSync(),
        this.setupAnalytics()
      ];

      await Promise.allSettled(initTasks);
      console.log('✅ All managers initialized');

      // Step 3: Hide loader
      this.hideLoader(loader);

      // Step 4: Mark as initialized
      this.initialized = true;
      
      console.log('✅ Application ready');

      // Step 5: Run A11Y audit in dev mode
      this.runA11yAudit();

    } catch (error) {
      console.error('❌ App initialization failed:', error);
      this.showErrorUI(loader, error);
    }
  }

  /**
   * Initialize page-specific managers based on current page
   */
  static async initPageSpecificManagers() {
    const path = window.location.pathname;

    try {
      // Home page / Product pages
      if (path === '/' || path === '/index.html' || path.includes('products.html')) {
        await ProductManager.init(this.services);
        await TestimonialManager.init(this.services);
        CartManager.init(this.services);
        RecommendationManager.init();
      }

      // Contact page
      if (path.includes('contact.html')) {
        await ContactManager.init(this.services);
      }

      // FAQ page
      if (path.includes('faq.html')) {
        await FAQManager.init(this.services);
      }

      // Admin pages
      if (path.includes('admin.html')) {
        await AdminManager.init(this.services);
      }

      console.log(`✅ Page-specific managers initialized for: ${path}`);
    } catch (error) {
      console.error('Failed to initialize page managers:', error);
    }
  }

  /**
   * Hide loader with smooth transition
   * @param {Element} loader - Loader element
   */
  static hideLoader(loader) {
    if (!loader) return;

    loader.style.opacity = '0';

    const onTransitionEnd = () => {
      loader.style.display = 'none';
      loader.remove();
    };

    loader.addEventListener('transitionend', onTransitionEnd, { once: true });

    // Fallback if transitionend doesn't fire
    setTimeout(() => {
      if (loader.style.opacity === '0' && loader.style.display !== 'none') {
        onTransitionEnd();
      }
    }, 500);
  }

  /**
   * Show error UI when initialization fails
   * @param {Element} loader - Loader element
   * @param {Error} error - Error object
   */
  static showErrorUI(loader, error) {
    if (!loader) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-recovery';
      errorDiv.setAttribute('role', 'alert');
      document.body.prepend(errorDiv);
      loader = errorDiv;
    }

    loader.innerHTML = `
      <div class="error-recovery__content">
        <svg class="error-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        
        <h2>Unable to Load Application</h2>
        <p class="error-message">${error.message}</p>
        
        <div class="error-actions">
          <button id="retryBtn" class="btn btn--primary" autofocus>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            Try Again
          </button>
          
          <button id="clearCacheBtn" class="btn btn--secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Clear Cache & Retry
          </button>
        </div>
      </div>
    `;

    loader.style.display = 'flex';
    loader.style.opacity = '1';

    // Retry button
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => location.reload());
    }

    // Clear cache button
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => {
        SafeStorage.clear();
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
        location.reload();
      });
    }
  }

  /**
   * Register service worker for offline support
   */
  static async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return;
    }

    // Don't register on admin pages
    if (window.location.pathname.includes('admin')) {
      console.log('Skipping service worker on admin page');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('✅ Service Worker registered:', registration.scope);

      // Push notification subscription
      try {
        await registration.pushManager.subscribe({ userVisibleOnly: true });
      } catch (error) {
        console.warn('Push notifications not available:', error.message);
      }

      // Update detection
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('New content available; please refresh.');
                DOMUtils.showToast('New version available! Please refresh.', 'info');
              } else {
                console.log('Content cached for offline use.');
              }
            }
          };
        }
      });

      // Warm cache
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage('warm-cache');
      }
    } catch (error) {
      console.warn('Service Worker registration failed:', error);
    }
  }

  /**
   * Setup global keyboard shortcuts
   */
  static setupGlobalKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignore if user is typing in an input
      const activeElement = document.activeElement;
      const isTyping =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable);

      if (isTyping) return;

      // Escape - Close modals
      if (e.key === 'Escape') {
        const modal = DOMUtils.$('.modal.active');
        if (modal) {
          ModalManager.hide();
        }
      }

      // ? - Show hotkeys help
      if (e.key === '?') {
        e.preventDefault();
        this.showHotkeysModal();
      }

      // S - Open settings
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        SettingsManager.showSettings();
      }
    });
  }

  /**
   * Show keyboard shortcuts help modal
   */
  static showHotkeysModal() {
    const helpModal = DOMUtils.createElement('div', {
      class: 'modal',
      role: 'dialog',
      'aria-modal': 'true'
    });

    helpModal.innerHTML = `
      <div class="modal-overlay" data-close="modal"></div>
      <div class="modal-content">
        <h2>Keyboard Shortcuts</h2>
        <dl>
          <dt><kbd>Esc</kbd></dt>
          <dd>Close modals</dd>
          <dt><kbd>Tab</kbd></dt>
          <dd>Navigate between elements</dd>
          <dt><kbd>S</kbd></dt>
          <dd>Open Settings</dd>
          <dt><kbd>?</kbd></dt>
          <dd>Show this help</dd>
        </dl>
        <button class="btn" data-close="modal">Close</button>
      </div>
    `;

    document.body.appendChild(helpModal);
    helpModal.classList.add('active');
    DOMUtils.trapFocus(helpModal);

    DOMUtils.$$('[data-close="modal"]', helpModal).forEach((el) => {
      el.addEventListener('click', () => helpModal.remove());
    });
  }

  /**
   * Setup offline cart sync
   */
  static setupOfflineSync() {
    window.addEventListener('online', async () => {
      const state = useAppState.getState();
      
      if (state.cart.length && this.services.cartService) {
        try {
          await this.services.cartService.syncCart(state.cart);
          state.setCart([]);
          DOMUtils.showToast('Offline cart synced successfully', 'success');
        } catch (error) {
          console.error('Cart sync failed:', error);
        }
      }
    });
  }

  /**
   * Setup Google Analytics tracking
   */
  static setupAnalytics() {
    if (typeof window.gtag === 'undefined') {
      console.warn('Google Analytics not loaded');
      return;
    }

    // Initialize GA
    window.gtag('js', new Date());
    window.gtag('config', 'G-K66820G64B'); // Replace with actual GA ID from .env

    // Track product views
    DOMUtils.on('click', '.product-card__btn', (e) => {
      const button = e.delegateTarget;
      const productId = button?.dataset.id;
      if (productId) {
        window.gtag('event', 'view_product', { product_id: productId });
      }
    });

    console.log('✅ Analytics tracking enabled');
  }

  /**
   * Run accessibility audit (dev mode only)
   */
  static runA11yAudit() {
    if (window.location.hostname !== 'localhost' || typeof window.axe === 'undefined') {
      return;
    }

    window.axe.run(document, (err, results) => {
      if (err) {
        console.error('A11Y Audit Error:', err);
        return;
      }

      if (results.violations.length) {
        console.group('🔍 Accessibility Issues Found');
        console.table(
          results.violations.map((v) => ({
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.length
          }))
        );
        console.groupEnd();
      } else {
        console.log('✅ No accessibility issues found');
      }
    });
  }
}

// ============================================================================
// AUTO-INITIALIZE ON DOM READY
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => JeelaniTextilesApp.init());
} else {
  JeelaniTextilesApp.init();
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

if (window.performance && window.performance.mark) {
  window.performance.mark('app-init-start');

  window.addEventListener('load', () => {
    window.performance.mark('app-init-end');
    window.performance.measure('app-init', 'app-init-start', 'app-init-end');

    const measure = window.performance.getEntriesByName('app-init')[0];
    if (measure) {
      console.log(`⚡ App initialization took ${measure.duration.toFixed(2)}ms`);

      if (typeof window.gtag !== 'undefined') {
        window.gtag('event', 'timing_complete', {
          name: 'app_init',
          value: Math.round(measure.duration),
          event_category: 'Performance'
        });
      }
    }
  });
}

// ============================================================================
// ERROR RECOVERY
// ============================================================================

let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

window.addEventListener('error', (event) => {
  consecutiveErrors++;

  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    console.error('Too many errors detected. Attempting recovery...');

    // Clear potentially corrupted cache
    SafeStorage.keys('products_').forEach((key) => SafeStorage.remove(key));

    // Show recovery UI
    const recoveryUI = DOMUtils.createElement('div', {
      class: 'error-recovery',
      role: 'alert',
      'aria-live': 'assertive'
    });

    recoveryUI.innerHTML = `
      <div class="error-recovery__content">
        <h3>Something went wrong</h3>
        <p>We're experiencing technical difficulties. Would you like to try recovering?</p>
        <button id="recoverBtn" class="btn btn--primary">Recover</button>
        <button id="reloadBtn" class="btn btn--secondary">Reload Page</button>
      </div>
    `;

    document.body.appendChild(recoveryUI);

    const recoverBtn = DOMUtils.$('#recoverBtn');
    const reloadBtn = DOMUtils.$('#reloadBtn');

    if (recoverBtn) {
      recoverBtn.addEventListener('click', () => {
        SafeStorage.clear();
        consecutiveErrors = 0;
        recoveryUI.remove();
        location.reload();
      });
    }

    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => location.reload());
    }
  }
});

// Reset error counter on successful navigation
window.addEventListener('load', () => {
  consecutiveErrors = 0;
});

// ============================================================================
// CLEANUP ON PAGE UNLOAD
// ============================================================================

window.addEventListener('beforeunload', () => {
  // Save current scroll position
  SafeStorage.set('scrollPos', window.scrollY.toString());

  // Cart state is automatically saved by Zustand store
  // Settings are automatically saved by Zustand store
});

// ============================================================================
// DEVELOPMENT HELPERS (localhost only)
// ============================================================================

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.JeelaniDebug = {
    app: JeelaniTextilesApp,
    state: useAppState,
    services: () => JeelaniTextilesApp.services,
    DOMUtils,
    SafeStorage,
    ProductManager,
    CartManager,
    clearCache: () => {
      SafeStorage.keys('products_').forEach((key) => SafeStorage.remove(key));
      console.log('✅ Cache cleared');
    },
    resetApp: () => {
      SafeStorage.clear();
      location.reload();
    },
    testToast: (message = 'Test toast', type = 'success') => {
      DOMUtils.showToast(message, type);
    },
    getCart: () => useAppState.getState().cart,
    addTestProduct: () => {
      CartManager.addToCart('test-' + Date.now(), 1);
    }
  };

  console.log('%c🎨 Jeelani Textiles - Debug Mode', 'color: #4CAF50; font-size: 16px; font-weight: bold;');
  console.log('%cAccess debug utilities via window.JeelaniDebug', 'color: #2196F3;');
  console.log('Available methods:', Object.keys(window.JeelaniDebug));
}

// ============================================================================
// ANALYTICS HELPER
// ============================================================================

window.trackEvent = function (eventName, eventParams = {}) {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', eventName, eventParams);
    console.log('📊 Event tracked:', eventName, eventParams);
  } else {
    console.warn('⚠️ Analytics not available');
  }
};

// ============================================================================
// FINAL CONSOLE MESSAGE
// ============================================================================

console.log('%c✨ Jeelani Textiles', 'color: #2196F3; font-size: 24px; font-weight: bold;');
console.log('%cWebsite initialized successfully', 'color: #4CAF50; font-size: 14px;');
console.log(`%cVersion: 2.0.0 | Build: ${new Date().toISOString()}`, 'color: #999; font-size: 12px;');

// ============================================================================
// EXPORTS (for testing or external use)
// ============================================================================

// Note: JeelaniTextilesApp is already exported as a class at line 48
// No need to export it again here - that was causing the duplicate export error
export {
  ProductManager,
  CartManager,
  FAQManager,
  ContactManager,
  AdminManager,
  DOMUtils,
  SafeStorage,
  ThemeManager,
  useAppState
};

export default JeelaniTextilesApp;