// script.js - Jeelani Textiles
// Main app logic with modular managers, virtual scrolling, and premium features.
// [CHANGE LOG]:
// - ✅ FIXED: Zod validation schema separated for cart/settings
// - ✅ FIXED: DOMUtils.on() now uses closest() for proper event delegation
// - ✅ FIXED: Fuse.js reinitializes after products load
// - ✅ FIXED: ProductManager listeners only attach once (no duplicates)
// - ✅ FIXED: RecommendationManager uses DOM-based rendering
// - ✅ FIXED: CartManager deduplicates items properly
// - ✅ FIXED: Keyboard shortcuts check for input focus
// - ✅ ADDED: SafeStorage wrappers for all localStorage calls
// - ✅ ADDED: Null checks throughout
// - ✅ OPTIMIZED: Event listeners consolidated
// - ✅ ENHANCED: Error handling with exponential backoff

// Global variable to hold Firebase services
let services;

// --- Safe Storage Utilities (NEW) ---
class SafeStorage {
  static get(key, fallback = null) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (error) {
      console.warn(`SafeStorage.get failed for key "${key}":`, error);
      return fallback;
    }
  }

  static getJSON(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (error) {
      console.warn(`SafeStorage.getJSON failed for key "${key}":`, error);
      return fallback;
    }
  }

  static set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`SafeStorage.set failed for key "${key}":`, error);
      if (error.name === 'QuotaExceededError') {
        console.error('LocalStorage quota exceeded. Consider clearing old data.');
      }
      return false;
    }
  }

  static setJSON(key, value) {
    try {
      const jsonString = JSON.stringify(value);
      localStorage.setItem(key, jsonString);
      return true;
    } catch (error) {
      console.warn(`SafeStorage.setJSON failed for key "${key}":`, error);
      return false;
    }
  }

  static remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`SafeStorage.remove failed for key "${key}":`, error);
      return false;
    }
  }

  static clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn('SafeStorage.clear failed:', error);
      return false;
    }
  }

  static isAvailable() {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  static keys(prefix = '') {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key);
        }
      }
      return keys;
    } catch (error) {
      console.warn('SafeStorage.keys failed:', error);
      return [];
    }
  }
}

// --- Improvement #1: State Management with Zustand and Validation (FIXED) ---

// ✅ FIXED: Separate schemas for cart and settings
const cartItemSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  price: zod.number(),
  qty: zod.number().positive(),
  image: zod.string().optional(),
  thumbnail: zod.string().optional()
});

const cartSchema = zod.array(cartItemSchema);

const settingsSchema = zod.object({
  theme: zod.enum(['light', 'dark', 'sepia', 'high-contrast']),
  gridSize: zod.number().int().min(2).max(4),
  lang: zod.string().min(2).max(5)
});

// Full state schema (kept for reference, but not used for localStorage validation)
const stateSchema = zod.object({
  products: zod.array(zod.any()),
  cart: zod.array(zod.any()),
  currentPage: zod.number(),
  lastVisible: zod.any().nullable(),
  isLoading: zod.boolean(),
  settings: settingsSchema
});

// ✅ FIXED: Separate validation functions
const validateCart = (stored) => {
  try {
    const result = cartSchema.safeParse(stored);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
};

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

// ✅ FIXED: Use SafeStorage and separate validation
const useAppState = zustand.create((set) => ({
  products: [],
  cart: validateCart(SafeStorage.getJSON('offlineCart', [])),
  currentPage: 1,
  lastVisible: null,
  isLoading: false,
  settings: validateSettings(SafeStorage.getJSON('userSettings', null))
}));

// Proxy compatibility for original code (kept as fallback, but Zustand is primary)
const appState = new Proxy({
  products: [],
  cart: SafeStorage.getJSON('offlineCart', []),
  currentPage: 1,
  lastVisible: null,
  isLoading: false,
  settings: SafeStorage.getJSON('userSettings', { theme: 'light', gridSize: 3, lang: 'en' })
}, {
  get(target, prop) {
    return useAppState.getState()[prop];
  },
  set(target, prop, value) {
    useAppState.setState((state) => {
      const newState = { ...state, [prop]: value };
      if (prop === 'products') ProductManager.renderProducts();
      if (prop === 'cart') {
        SafeStorage.setJSON('offlineCart', value);
      }
      if (prop === 'settings') {
        SafeStorage.setJSON('userSettings', value);
        ThemeManager.init();
      }
      return newState;
    });
    return true;
  }
});

// --- Improvement #3: Error Handling with Codes and Retry ---
const errorMessages = {
  1001: 'Failed to load',
  1002: 'Theme toggle failed',
  1003: 'Virtual scroll failed',
  1004: 'Operation failed'
};

// Centralized Error Logging Utility with exponential backoff retry mechanism
const logError = (messageOrCode, error, retryCallback = null, attempt = 1) => {
  const code = typeof messageOrCode === 'number' ? messageOrCode : 1004;
  const message = typeof messageOrCode === 'string' ? messageOrCode : errorMessages[code] || 'Unknown error';
  console.error(`${message}:`, error);
  DOMUtils.showToast(`${message}: ${error.message}`, 'error');
  if (retryCallback && attempt <= 3) {
    const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
    DOMUtils.showToast(`Retrying in ${delay / 1000}s...`, 'info');
    setTimeout(() => retryCallback(attempt + 1), delay);
  }
};

// --- Improvement #5: Code Quality - Config for Strings ---
const config = {
  strings: {
    loading: 'Loading...',
    noItems: 'No items found.',
    noProducts: 'No products found.',
    failedLoad: 'Failed to load'
  }
};

// Security: Input Sanitization (Improvement #6)
const sanitize = (str) => str.replace(/[<>&"']/g, '');

// Internationalization (i18n)
const translations = {
  en: { 
    'Load More': 'Load More', 
    'No More Products': 'No More Products', 
    'Failed to load': 'Failed to load', 
    'Switched to': 'Switched to', 
    'Settings saved': 'Settings saved',
    'Added to cart': 'Added to cart',
    'Removed from cart': 'Removed from cart',
    'Cart updated': 'Cart updated'
  },
  es: { 
    'Load More': 'Cargar Más', 
    'No More Products': 'No Más Productos', 
    'Failed to load': 'Error al cargar', 
    'Switched to': 'Cambiar a', 
    'Settings saved': 'Configuración guardada',
    'Added to cart': 'Añadido al carrito',
    'Removed from cart': 'Eliminado del carrito',
    'Cart updated': 'Carrito actualizado'
  }
};
const t = (key) => translations[appState.settings.lang || 'en'][key] || key;

// Cookie Utilities for CSRF (Fix #4)
function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}

function getCookie(name) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
}

// DOM Utilities with Error Boundaries (Improvement #3) - ✅ FIXED
class DOMUtils {
  static $(selector, context = document) {
    const element = context.querySelector(selector);
    if (!element) console.warn(`Element ${selector} not found`);
    return element;
  }

  static $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
  }

  static createElement(tag, attrs = {}) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class') el.className = value;
      else if (key.startsWith('data-')) el.dataset[key.slice(5)] = value;
      else el.setAttribute(key, value);
    });
    return el;
  }

  static trapFocus(modal) {
    const focusable = DOMUtils.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal);
    if (!focusable.length) {
      modal.setAttribute('tabindex', '-1');
      modal.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    modal.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    first.focus();
  }

  static showToast(message, type = 'success') {
    const toast = DOMUtils.createElement('div', {
      class: `toast toast--${type}`,
      role: 'alert',
      'aria-live': 'assertive'
    });
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  static addClass(element, className) {
    element?.classList.add(className);
  }

  static removeClass(element, className) {
    element?.classList.remove(className);
  }

  static toggleClass(element, className) {
    element?.classList.toggle(className);
  }

  // ✅ FIXED: Use closest() instead of matches() for proper event delegation
  static on(event, selector, handler, context = document) {
    context.addEventListener(event, (e) => {
      // ✅ Check if target or any ancestor matches
      const matchedElement = e.target.closest(selector);
      
      // Ensure matched element is within context
      if (matchedElement && context.contains(matchedElement)) {
        // Provide delegated target for handler
        e.delegateTarget = matchedElement;
        handler(e);
      }
    });
  }

  static renderList(container, items, templateFn) {
    if (!container) {
      console.warn('renderList: container not found');
      return;
    }
    container.innerHTML = items.length ? items.map(templateFn).join('') : `<p class="state-message">${config.strings.noItems}</p>`;
  }
}

// Theme Manager with CSS Variables (Improvement #9)
class ThemeManager {
  static themes = ['light', 'dark', 'sepia', 'high-contrast'];

  static init() {
    const themeToggle = DOMUtils.$('#themeToggle');
    if (!themeToggle) return;

    const html = document.documentElement;
    let currentTheme = appState.settings.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    appState.settings.theme = currentTheme;
    html.setAttribute('data-theme', currentTheme);
    html.style.setProperty('--theme', currentTheme);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/css/themes/${currentTheme}.css`;
    link.onload = () => {
      document.body.classList.add(`${currentTheme}-theme`);
      html.style.transition = 'background-color 0.5s ease, color 0.5s ease';
    };
    link.onerror = () => {
      console.warn(`Theme ${currentTheme} not found, falling back to style.css`);
      link.href = '/css/style.css';
    };
    document.head.appendChild(link);

    themeToggle.addEventListener('click', () => {
      try {
        const idx = this.themes.indexOf(currentTheme);
        currentTheme = this.themes[(idx + 1) % this.themes.length];
        html.classList.add('theme-transition');
        html.setAttribute('data-theme', currentTheme);
        html.style.setProperty('--theme', currentTheme);
        link.href = `/css/themes/${currentTheme}.css`;
        appState.settings.theme = currentTheme;
        DOMUtils.showToast(`${t('Switched to')} ${currentTheme} theme`);
        setTimeout(() => html.classList.remove('theme-transition'), 500);
      } catch (error) {
        logError(1002, error);
      }
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      const newTheme = e.matches ? 'dark' : 'light';
      if (!appState.settings.theme || appState.settings.theme === 'system') {
        appState.settings.theme = newTheme;
        html.setAttribute('data-theme', newTheme);
        html.style.setProperty('--theme', newTheme);
        link.href = `/css/themes/${newTheme}.css`;
      }
    });
  }
}

// Debounce Utility
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Delay Utility
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Improvement #2: Virtual Scroll with Enhancements ---
class VirtualScroll {
  constructor(container, items, renderItem, visibleItems) {
    this.container = container;
    this.items = items;
    this.renderItem = renderItem;
    this.visibleItems = visibleItems;
    this.startIndex = 0;
    this.itemHeight = 0;
    this.visibleImages = [];
    this.observer = new IntersectionObserver(this.updateGrid.bind(this), { rootMargin: '200% 0px' });
  }

  updateGrid(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const scrollTop = this.container.scrollTop;
        const newStartIndex = Math.floor(scrollTop / this.itemHeight);
        if (newStartIndex !== this.startIndex) {
          this.startIndex = newStartIndex;
          this.render();
        }
      }
    });
  }

  render() {
    if (!this.container) {
      console.warn('VirtualScroll: container not found');
      return;
    }

    this.container.innerHTML = '';
    if (!this.items.length) {
      this.container.innerHTML = `<p class="state-message">${config.strings.noProducts}</p>`;
      return;
    }
    const firstItem = this.renderItem(this.items[0], 0);
    this.container.appendChild(firstItem);
    this.itemHeight = firstItem.offsetHeight || 200;
    this.container.removeChild(firstItem);
    const buffer = 15;
    const start = Math.max(0, this.startIndex - buffer);
    const end = Math.min(this.items.length, this.startIndex + this.visibleItems + buffer);
    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const itemData = this.items[i];
      const itemEl = this.renderItem(itemData, i);
      itemEl.setAttribute('aria-posinset', i + 1);
      itemEl.setAttribute('aria-setsize', this.items.length);
      fragment.appendChild(itemEl);
      const img = itemEl.querySelector('img[data-src]');
      if (img) this.visibleImages.push({ el: img, top: i * this.itemHeight, bottom: (i + 1) * this.itemHeight, load: () => img.src = img.dataset.src });
    }
    this.container.appendChild(fragment);
    this.container.style.height = `${this.items.length * this.itemHeight}px`;
    this.setupScroll();
  }

  setupScroll() {
    this.container.addEventListener('scroll', () => {
      try {
        const scrollTop = this.container.scrollTop;
        const newStartIndex = Math.floor(scrollTop / this.itemHeight);
        if (newStartIndex !== this.startIndex) {
          this.startIndex = newStartIndex;
          this.render();
        }
        const { top, bottom } = this.container.getBoundingClientRect();
        this.visibleImages.forEach(img => {
          if (img.top > top - 500 && img.bottom < bottom + 500 && !img.el.src.includes(img.el.dataset.src)) img.load();
        });
      } catch (error) {
        logError(1003, error);
      }
    }, { passive: true });
  }
}

// --- Presentation Layer (Fix #1) ---
class ProductComponent {
  static createCard(product, index) {
    const aosAttr = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? {} : { 'data-aos': 'fade-up', 'data-aos-delay': index * 50 };
    const card = DOMUtils.createElement('article', {
      class: `product-card card grid-${appState.settings.gridSize}`,
      ...aosAttr,
      'data-id': product.id
    });
    card.innerHTML = `
      <figure class="product-card__media">
        <img src="${product.thumbnail || '/assets/images/placeholder.jpg'}" 
             srcset="${product.imageSmall || product.image} 320w, ${product.imageMedium || product.image} 640w, ${product.image} 1280w" 
             sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw" 
             data-src="${product.image}" alt="${product.name}" loading="lazy">
        ${product.isNew ? '<span class="badge badge--new">New</span>' : ''}
        ${product.sold ? '<span class="badge badge--sold">Sold Out</span>' : ''}
      </figure>
      <div class="product-card__content">
        <h3 class="product-card__title">${product.name}</h3>
        <p class="product-card__price">₹${product.price.toFixed(2)}</p>
        <input type="number" min="1" aria-label="Quantity" data-bind="quantity" value="1">
        <div aria-live="polite" class="sr-only" id="qtyFeedback-${product.id}"></div>
        <button class="btn product-card__btn" data-id="${product.id}" ${product.sold ? 'disabled' : ''} aria-label="View details of ${product.name}">
          ${product.sold ? 'Sold Out' : 'View Details'}
        </button>
      </div>
    `;
    card.addEventListener('mouseover', () => {
      try {
        if (!product.sold) {
          const link = new Image();
          link.src = product.image;
        }
      } catch (error) {
        logError(1004, error);
      }
    });
    return card;
  }
}

// Product Manager with SWR Caching (Improvement #4) - ✅ FIXED
class ProductManager {
  static fuse = null; // ✅ Store Fuse instance
  static listenersAttached = false; // ✅ Prevent duplicate listeners

  static async loadProducts(services) {
    if (appState.isLoading) return;
    appState.isLoading = true;

    const grid = DOMUtils.$('#productGrid');
    if (!grid) {
      appState.isLoading = false;
      return;
    }

    const loadMoreBtn = DOMUtils.$('#loadMore');

    try {
      const cacheKey = `products_${appState.currentPage}`;
      let cached = SafeStorage.getJSON(cacheKey, null);
      let products, lastDoc;
      if (cached) {
        ({ products, lastDoc } = cached);
      } else {
        ({ products, lastDoc } = await services.productService.getProducts({
          pageSize: 12,
          lastDoc: appState.lastVisible,
          startAfter: appState.lastVisible
        }));
        SafeStorage.setJSON(cacheKey, { products, lastDoc });
      }
      appState.products = [...appState.products, ...products];
      appState.lastVisible = lastDoc;

      // ✅ FIXED: Reinitialize Fuse after products load
      this.initializeSearch();

      if (loadMoreBtn) {
        loadMoreBtn.textContent = t(products.length < 12 ? 'No More Products' : 'Load More');
        loadMoreBtn.style.display = products.length < 12 ? 'none' : 'block';
      }
      this.renderProducts();
    } catch (error) {
      grid.innerHTML = '<p class="state-message error">Failed to load products.</p>';
      logError(1001, error, () => this.loadProducts(services));
    } finally {
      appState.isLoading = false;
      if (loadMoreBtn) loadMoreBtn.disabled = false;
    }
  }

  // ✅ NEW: Initialize Fuse.js with loaded products
  static initializeSearch() {
    if (appState.products.length > 0 && typeof Fuse !== 'undefined') {
      this.fuse = new Fuse(appState.products, {
        keys: ['name', 'description', 'category'],
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 2
      });
      console.log(`Fuse.js initialized with ${appState.products.length} products`);
    }
  }

  static renderProducts = debounce((category = 'all') => {
    const grid = DOMUtils.$('#productGrid');
    if (!grid) return;

    if (appState.isLoading) {
      grid.innerHTML = `<p class="state-message">${config.strings.loading}</p>`;
      return;
    }

    class ProductFilter {
      static filterByCategory(products, category) {
        return category === 'all' ? products :
          category === 'new' ? products.filter(p => p.isNew) :
          category === 'none' ? [] :
          products.filter(p => p.category === category);
      }
    }

    let filteredProducts = ProductFilter.filterByCategory(appState.products, category);
    const virtualScroll = new VirtualScroll(grid, filteredProducts, ProductComponent.createCard, 10);
    virtualScroll.render();

    // ✅ FIXED: Only attach listeners once
    if (!this.listenersAttached) {
      this.attachProductListeners(grid);
      this.listenersAttached = true;
    }
  }, 150);

  // ✅ NEW: Separate method for attaching listeners (called once)
  static attachProductListeners(grid) {
    DOMUtils.on('click', '.product-card__btn', (e) => {
      try {
        const button = e.delegateTarget; // Use delegateTarget from fixed DOMUtils.on
        const productId = button.dataset.id;
        const product = appState.products.find(p => p.id === productId);
        if (product) ModalManager.show(product);
      } catch (error) {
        logError(1004, error);
      }
    }, grid);

    DOMUtils.on('change', '[data-bind="quantity"]', (e) => {
      try {
        const input = e.target;
        const productId = input.closest('.product-card')?.dataset.id;
        if (!productId) return;
        
        const qtyFeedback = DOMUtils.$('#qtyFeedback-' + productId);
        const qty = parseInt(input.value);
        if (qty < 1) input.value = 1;
        if (qtyFeedback) {
          qtyFeedback.textContent = `Quantity set to ${input.value}`;
        }
      } catch (error) {
        logError(1004, error);
      }
    }, grid);
  }

  static setupFilters() {
    DOMUtils.$$('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          DOMUtils.$$('.filter-btn').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');
          this.renderProducts(btn.dataset.category);
        } catch (error) {
          logError(1004, error);
        }
      });
    });
  }

  static setupSearch(services) {
    const input = DOMUtils.$('#searchInput');
    const clear = DOMUtils.$('#searchClear');
    const voiceBtn = DOMUtils.$('#voiceSearch');
    const status = DOMUtils.$('#voiceStatus');

    if (!input) return;

    input.addEventListener('input', debounce((e) => {
      try {
        const query = e.target.value.trim().toLowerCase();
        
        if (query.length < 2) {
          this.renderProducts('all');
          if (clear) clear.style.display = 'none';
          return;
        }

        // ✅ FIXED: Check if Fuse is initialized
        if (!this.fuse) {
          console.warn('Search not ready - products still loading');
          return;
        }

        const results = this.fuse.search(query);
        
        if (results.length > 0) {
          const filtered = results.map(result => result.item);
          this.renderFilteredProducts(filtered);
        } else {
          this.renderProducts('none');
        }
        
        if (clear) clear.style.display = query ? 'block' : 'none';
      } catch (error) {
        logError(1004, error);
      }
    }, 300));

    if (clear) {
      clear.addEventListener('click', () => {
        try {
          input.value = '';
          clear.style.display = 'none';
          this.renderProducts('all');
          input.focus();
        } catch (error) {
          logError(1004, error);
        }
      });
    }

    // Voice Search
    if (voiceBtn && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => {
        if (status) status.textContent = 'Listening...';
        voiceBtn.classList.add('recording');
      };
      recognition.onend = () => {
        if (status) status.textContent = '';
        voiceBtn.classList.remove('recording');
      };
      recognition.onresult = (e) => {
        try {
          const command = e.results[0][0].transcript.toLowerCase();
          if (command.includes('search')) {
            const query = command.replace('search', '').trim();
            input.value = query;
            
            if (this.fuse && query.length >= 2) {
              const results = this.fuse.search(query);
              if (results.length > 0) {
                const filtered = results.map(result => result.item);
                this.renderFilteredProducts(filtered);
              } else {
                this.renderProducts('none');
              }
            }
            if (clear) clear.style.display = 'block';
          } else if (command === 'go to products') {
            Router.navigate('/products');
          } else if (command === 'open settings') {
            SettingsManager.showSettings();
          }
        } catch (error) {
          logError(1004, error);
        }
      };
      recognition.onerror = () => {
        if (status) status.textContent = 'Voice input failed';
      };
      voiceBtn.addEventListener('click', () => {
        try {
          recognition.start();
        } catch (error) {
          logError(1004, error);
        }
      });
    } else if (voiceBtn) {
      DOMUtils.showToast('Voice search not supported', 'error');
      voiceBtn.style.display = 'none';
    }
  }

  // ✅ NEW: Helper method for rendering filtered products
  static renderFilteredProducts(products) {
const grid = DOMUtils.$('#productGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    products.forEach((product, index) => {
      fragment.appendChild(ProductComponent.createCard(product, index));
    });
    grid.appendChild(fragment);
  }

  static setupInfiniteScroll(services) {
    const trigger = DOMUtils.$('#loadMoreTrigger');
    if (!trigger) return;
    IntersectionObserverManager.observe(trigger, (entry) => {
      if (entry.isIntersecting && !appState.isLoading) this.loadProducts(services);
    }, { threshold: 0.5 });
  }

  static async reserveStock(services, productId, quantity) {
    if (!services.firestore) {
      console.error('Firestore not available');
      return false;
    }

    const stockRef = firebase.firestore.doc(services.firestore, 'products', productId);
    try {
      await firebase.firestore.runTransaction(services.firestore, async (transaction) => {
        const docSnap = await transaction.get(stockRef);
        if (!docSnap.exists()) throw new Error('Product not found');
        const stock = docSnap.data().stock || 0;
        if (stock < quantity) throw new Error('Out of stock');
        transaction.update(stockRef, { stock: stock - quantity });
      });
      return true;
    } catch (error) {
      logError(1004, error);
      DOMUtils.showToast(error.message);
      return false;
    }
  }

  static async init(services) {
    await this.loadProducts(services);
    this.setupInfiniteScroll(services);
    this.setupFilters();
    this.setupSearch(services);
    
    const loadMoreBtn = DOMUtils.$('#loadMore');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        try {
          this.loadProducts(services);
        } catch (error) {
          logError(1004, error);
        }
      });
    }
  }
}

// Modal Manager
class ModalManager {
  static modal = null;

  static show(product) {
    if (!this.modal) {
      this.modal = this.createModal();
      document.body.appendChild(this.modal);
    }
    this.modal.innerHTML = this.createModalContent(product);
    this.modal.classList.add('active');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    DOMUtils.trapFocus(this.modal);

    DOMUtils.$$('[data-close="modal"]', this.modal).forEach(el => {
      el.addEventListener('click', () => {
        try {
          this.hide();
        } catch (error) {
          logError(1004, error);
        }
      });
    });

    DOMUtils.$$('.thumbnail', this.modal).forEach(thumb => {
      thumb.addEventListener('click', () => {
        try {
          const modalImg = DOMUtils.$('#modalImg', this.modal);
          if (modalImg) modalImg.src = thumb.src;
        } catch (error) {
          logError(1004, error);
        }
      });
    });

    this.modal.addEventListener('keydown', (e) => {
      try {
        if (e.key === 'Escape') this.hide();
      } catch (error) {
        logError(1004, error);
      }
    });

    // A11Y audit in dev mode
    if (window.location.hostname === 'localhost' && typeof axe !== 'undefined') {
      axe.run(this.modal, (err, results) => {
        if (err) console.error('A11Y Audit Error:', err);
        if (results.violations.length) console.log('Modal A11Y Issues:', results.violations);
      });
    }
  }

  static createModal() {
    const modal = DOMUtils.createElement('div', {
      id: 'productModal',
      class: 'modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-hidden': 'true'
    });
    document.body.appendChild(modal);
    return modal;
  }

  static createModalContent(product) {
    const thumbnails = product.images?.length > 1 ?
      product.images.map((img, i) => `
        <img src="${img}" alt="${product.name} view ${i + 1}" class="thumbnail" data-index="${i}" role="button" aria-label="View image ${i + 1}">
      `).join('') : '';
    const arButton = 'AR' in window ? '<button id="arPreview" class="btn">View in AR</button>' : '';
    return `
      <div class="modal-overlay" data-close="modal"></div>
      <div class="modal-content">
        <button class="modal-close" data-close="modal" aria-label="Close modal">✕</button>
        <div class="modal-gallery">
          <img id="modalImg" src="${product.image}" alt="${product.name}">
          ${thumbnails ? `<div class="thumbnail-track">${thumbnails}</div>` : ''}
        </div>
        <h2>${product.name}</h2>
        <p class="modal-price">₹${product.price.toFixed(2)}</p>
        <p class="modal-description">${product.description || 'No description available'}</p>
        <a href="https://wa.me/919845677415?text=I'm interested in ${encodeURIComponent(product.name)} (SKU: ${product.id})" 
           target="_blank" class="btn" id="modalWhatsApp" aria-label="Order ${product.name} on WhatsApp">Order on WhatsApp</a>
        <button class="btn secondary" data-close="modal">Close</button>
        ${arButton}
      </div>
    `;
  }

  static hide() {
    const modal = DOMUtils.$('#productModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    
    // Restore focus
    const lastTrigger = document.activeElement?.closest('.product-card__btn');
    const productGrid = DOMUtils.$('#productGrid');
    if (lastTrigger) {
      lastTrigger.focus();
    } else if (productGrid) {
      productGrid.focus();
    }
  }
}

// FAQ Manager
class FAQManager {
  static async loadFAQs(services) {
    const list = DOMUtils.$('.faq-list') || DOMUtils.$('#faqContainer');
    if (!list) return;

    list.innerHTML = `<p class="state-message">${config.strings.loading}</p>`;
    try {
      const { data: faqs } = await services.faqService.getFAQs();
      list.innerHTML = faqs.map(faq => `
        <div class="faq-item card" data-category="${faq.category}" data-aos="fade-up">
          <button class="faq-question" aria-expanded="false" aria-controls="faq-${faq.id}">
            <span class="faq-category-icon"><i class="fas fa-${faq.icon || 'question'}"></i></span>
            <span>${faq.question}</span>
            <svg class="faq-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
            </svg>
          </button>
          <div id="faq-${faq.id}" class="faq-answer" aria-hidden="true">
            <p>${faq.answer.replace('+91 98456 77415', '<a href="https://wa.me/919845677415" target="_blank" aria-label="Contact via WhatsApp">+91 98456 77415</a>')}</p>
            <div class="faq-feedback">
              <span>Was this helpful?</span>
              <button class="icon-btn" data-feedback="yes" data-id="${faq.id}" aria-label="Mark FAQ ${faq.question} as helpful">👍</button>
              <button class="icon-btn" data-feedback="no" data-id="${faq.id}" aria-label="Mark FAQ ${faq.question} as not helpful">👎</button>
            </div>
          </div>
        </div>
      `).join('');

      this.setupFAQInteractions(services);
    } catch (error) {
      list.innerHTML = '<p class="state-message error">Failed to load FAQs.</p>';
      logError(1001, error);
    }
  }

  static setupFAQInteractions(services) {
    DOMUtils.$$('.faq-question').forEach(q => {
      q.addEventListener('click', () => {
        try {
          const id = q.getAttribute('aria-controls');
          const a = DOMUtils.$(`#${id}`);
          if (!a) return;
          
          const expanded = q.getAttribute('aria-expanded') === 'true';
          q.setAttribute('aria-expanded', !expanded);
          a.setAttribute('aria-hidden', expanded);
          SafeStorage.set(id, expanded ? 'closed' : 'open');
          
          const svg = q.querySelector('svg');
          if (svg) {
            svg.style.transform = expanded ? 'rotate(0deg)' : 'rotate(45deg)';
          }
        } catch (error) {
          logError(1004, error);
        }
      });
    });

    DOMUtils.$$('.faq-feedback button').forEach(btn => {
      btn.addEventListener('click', debounce(async () => {
        const faqId = btn.dataset.id;
        const feedback = btn.dataset.feedback;
        const votedKey = `faq_${faqId}_voted`;
        
        // ✅ Use SafeStorage
        const voted = SafeStorage.getJSON(votedKey, false);
        
        if (voted) {
          DOMUtils.showToast('You have already voted on this FAQ');
          return;
        }
        
        if (!services.firestore) {
          console.error('Firestore not available');
          return;
        }

        const batch = firebase.firestore.writeBatch(services.firestore);
        batch.update(firebase.firestore.doc(services.firestore, 'faqs', faqId), {
          [feedback === 'yes' ? 'helpful' : 'unhelpful']: firebase.firestore.increment(1)
        });
        
        try {
          await batch.commit();
          SafeStorage.setJSON(votedKey, true);
          btn.disabled = true;
          const points = feedback === 'yes' ? 10 : 5;
          DOMUtils.showToast(`+${points} points! Thank you for your feedback!`, 'success');
          
          const totalPoints = parseInt(SafeStorage.get('userPoints', '0')) + points;
          SafeStorage.set('userPoints', totalPoints.toString());
          
          const pointsEl = DOMUtils.$('#points');
          if (pointsEl) {
            const pointsDisplay = pointsEl.querySelector('[data-points]');
            if (pointsDisplay) pointsDisplay.textContent = totalPoints;
          }
        } catch (error) {
          logError(1004, error);
        }
      }, 1000));
    });
  }

  static setupFAQSearch() {
    const input = DOMUtils.$('#faqSearch');
    const clear = DOMUtils.$('#faqClear');
    
    if (!input) return;

    input.addEventListener('input', debounce((e) => {
      try {
        const query = e.target.value.trim().toLowerCase();
        DOMUtils.$$('.faq-item').forEach(item => {
          item.style.display = item.textContent.toLowerCase().includes(query) ? 'block' : 'none';
        });
        if (clear) clear.style.display = query ? 'block' : 'none';
      } catch (error) {
        logError(1004, error);
      }
    }, 300));
    
    if (clear) {
      clear.addEventListener('click', () => {
        try {
          input.value = '';
          clear.style.display = 'none';
          DOMUtils.$$('.faq-item').forEach(item => item.style.display = 'block');
          input.focus();
        } catch (error) {
          logError(1004, error);
        }
      });
    }
  }

  static async init(services) {
    await this.loadFAQs(services);
    this.setupFAQSearch();
  }
}

// Contact Manager with CSRF Protection (Improvement #6 & Fix #4)
class ContactManager {
  static async renderContactInfo() {
    const container = DOMUtils.$('#contactInfo');
    if (!container) return;

    try {
      const info = { 
        address: '350/24, MG Road, Mysuru – 570004, Karnataka, India', 
        phone: '+91 98456 77415', 
        email: 'info@jeelani-textiles.com' 
      };
      container.innerHTML = `
        <p><strong>Address:</strong> ${info.address}</p>
        <p><strong>Phone:</strong> <a href="tel:${info.phone}" aria-label="Call ${info.phone}">${info.phone}</a></p>
        <p><strong>Email:</strong> <a href="mailto:${info.email}" aria-label="Email ${info.email}">${info.email}</a></p>
      `;

      const mapIframe = DOMUtils.$('.map-container iframe');
      if (mapIframe) {
        IntersectionObserverManager.observe(mapIframe, (entry) => {
          if (entry.isIntersecting) {
            mapIframe.src = mapIframe.dataset.src;
            IntersectionObserverManager.unobserve(mapIframe);
          }
        });
      }
    } catch (error) {
      container.innerHTML = '<p class="error">Failed to load contact info.</p>';
      logError(1004, error);
    }
  }

  static async submitForm(formData, services) {
    try {
      const csrfToken = getCookie('csrfToken');
      if (!csrfToken || formData.csrfToken !== csrfToken) throw new Error('Invalid CSRF token');

      const sanitizedData = {
        name: sanitize(formData.name.trim()),
        email: sanitize(formData.email.trim()),
        message: sanitize(formData.message.trim())
      };
      
      if (!services.functions) {
        throw new Error('Firebase Functions not available');
      }

      const result = await services.functions.httpsCallable('submitContact')(sanitizedData);
      if (result.data.success) {
        DOMUtils.showToast('Message sent successfully!');
      }
    } catch (error) {
      logError(1004, error);
      throw error;
    }
  }

  static async initCSRF() {
    if (!getCookie('csrfToken')) {
      const csrfToken = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
      setCookie('csrfToken', csrfToken, 1);
    }
  }

  static showConfirmation() {
    const modal = DOMUtils.createElement('div', {
      class: 'modal confirmation',
      'aria-modal': 'true',
      'aria-hidden': 'false'
    });
    modal.innerHTML = `
      <div class="modal-overlay" data-close="modal"></div>
      <div class="modal-content">
        <h3>Thank You!</h3>
        <p>Your message has been sent. We'll get back to you within 24 hours.</p>
        <button class="btn btn--primary" data-close="modal" aria-label="Close confirmation">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('active');
    DOMUtils.trapFocus(modal);
    DOMUtils.$$('[data-close="modal"]', modal).forEach(el => {
      el.addEventListener('click', () => {
        try {
          modal.remove();
        } catch (error) {
          logError(1004, error);
        }
      });
    });
  }

  static validateField(field, helperId, minLength) {
    const helper = DOMUtils.$(helperId);
    if (!field || !helper) return;

    field.addEventListener('input', debounce(() => {
      try {
        if (!field.value.trim()) {
          helper.textContent = 'This field is required';
          helper.classList.add('error');
        } else if (field.value.length < minLength) {
          helper.textContent = `Minimum ${minLength} characters`;
          helper.classList.add('error');
        } else if (field.type === 'email' && !/^\S+@\S+\.\S+$/.test(field.value)) {
          helper.textContent = 'Invalid email';
          helper.classList.add('error');
        } else {
          helper.textContent = '';
          helper.classList.remove('error');
        }
      } catch (error) {
        logError(1004, error);
      }
    }, 200));
    
    return this.validateFieldSync(field, helperId, minLength);
  }

  static validateFieldSync(field, helperId, minLength) {
    const helper = DOMUtils.$(helperId);
    if (!field || !helper) return false;

    if (!field.value.trim()) {
      helper.textContent = 'This field is required';
      helper.classList.add('error');
      return false;
    } else if (field.value.length < minLength) {
      helper.textContent = `Minimum ${minLength} characters required`;
      helper.classList.add('error');
      return false;
    } else if (field.type === 'email' && !/^\S+@\S+\.\S+$/.test(field.value)) {
      helper.textContent = 'Please enter a valid email';
      helper.classList.add('error');
      return false;
    } else {
      helper.textContent = '';
      helper.classList.remove('error');
      return true;
    }
  }

  static setupContactForm(services) {
    const form = DOMUtils.$('#contactForm');
    if (!form) return;

    const fields = ['contactName', 'contactEmail', 'contactMessage'];
    const whatsappBtn = DOMUtils.$('.whatsapp-btn');

    fields.forEach(id => {
      const field = DOMUtils.$(`#${id}`);
      if (field) {
        field.value = SafeStorage.get(id, '');
        field.addEventListener('input', () => {
          try {
            SafeStorage.set(id, field.value);
            
            const nameField = DOMUtils.$('#contactName');
            const messageField = DOMUtils.$('#contactMessage');
            const name = nameField?.value.trim() || 'a customer';
            const message = messageField?.value.trim() || 'I have a query about your products.';
            
            if (whatsappBtn) {
              whatsappBtn.href = `https://wa.me/919845677415?text=Hi! I'm ${encodeURIComponent(name)}. ${encodeURIComponent(message)}`;
            }
          } catch (error) {
            logError(1004, error);
          }
        });
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const nameField = DOMUtils.$('#contactName');
      const emailField = DOMUtils.$('#contactEmail');
      const messageField = DOMUtils.$('#contactMessage');
      
      const isValid = [
        this.validateFieldSync(nameField, '#nameHelper', 2),
        this.validateFieldSync(emailField, '#emailHelper', 5),
        this.validateFieldSync(messageField, '#messageHelper', 10)
      ].every(Boolean);

      if (isValid) {
        const submitBtn = DOMUtils.$('.submit-btn', form);
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="btn-loader"></span> Sending...';
        }

        const data = {
          name: nameField.value.trim(),
          email: emailField.value.trim(),
          message: messageField.value.trim(),
          csrfToken: getCookie('csrfToken')
        };

        try {
          await this.submitForm(data, services);
          this.showConfirmation();
          form.reset();
          fields.forEach(id => SafeStorage.remove(id));
          if (whatsappBtn) whatsappBtn.href = 'https://wa.me/919845677415?text=Hi! I have a query about your products.';
        } catch (error) {
          logError(1004, error);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Send Message';
          }
        }
      }
    });
  }

  static async init(services) {
    await this.initCSRF();
    await this.renderContactInfo();
    this.setupContactForm(services);
  }
}

// Testimonial Manager
class TestimonialManager {
  static async renderTestimonials(services) {
    const grid = DOMUtils.$('.testimonial-grid');
    if (!grid) return;

    try {
      if (!services.firestore) {
        throw new Error('Firestore not available');
      }

      const querySnapshot = await firebase.firestore.getDocs(firebase.firestore.collection(services.firestore, 'testimonials'));
      grid.innerHTML = querySnapshot.docs.map(doc => {
        const { quote, author } = doc.data();
        return `
          <div class="card p-lg" data-aos="fade-up">
            <blockquote>
              <p>"${quote}"</p>
              <footer class="mt-md">– ${author}</footer>
            </blockquote>
          </div>
        `;
      }).join('') || '<p>No testimonials available.</p>';
    } catch (error) {
      grid.innerHTML = '<p class="state-message error">Failed to load testimonials.</p>';
      logError(1001, error);
    }
  }

  static async init(services) {
    await this.renderTestimonials(services);
  }
}

// Admin Manager with Rate Limiting (Improvement #6)
class AdminManager {
  static currentProducts = [];
  static page = 1;
  static limit = 10;
  static lastRequestTime = 0;
  static rateLimit = 1000;

  static async loadProducts(services) {
    if (appState.isLoading || (Date.now() - this.lastRequestTime < this.rateLimit)) return;
    appState.isLoading = true;
    this.lastRequestTime = Date.now();

    const tbody = DOMUtils.$('#adminProductList');
    if (!tbody) {
      appState.isLoading = false;
      return;
    }

    if (!services.auth.currentUser) {
      DOMUtils.showToast('Please log in to access admin panel', 'error');
      appState.isLoading = false;
      return;
    }
    
    try {
      const idTokenResult = await services.auth.currentUser.getIdTokenResult();
      if (!idTokenResult.claims.admin) {
        DOMUtils.showToast('Unauthorized access', 'error');
        appState.isLoading = false;
        return;
      }
    } catch (error) {
      logError(1004, error);
      appState.isLoading = false;
      return;
    }

    try {
      const { products, lastDoc } = await services.productService.getProducts({
        pageSize: this.limit,
        lastDoc: appState.lastVisible
      });
      this.currentProducts = this.page === 1 ? products : [...this.currentProducts, ...products];
      appState.lastVisible = lastDoc;
      this.renderProducts();
      
      const loadMoreTrigger = DOMUtils.$('#loadMoreTrigger');
      if (loadMoreTrigger) {
        loadMoreTrigger.style.display = products.length < this.limit ? 'none' : 'block';
      }
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="7" class="error">Failed to load products</td></tr>';
      logError(1001, error);
    } finally {
      appState.isLoading = false;
    }
  }

  static renderProducts() {
    const tbody = DOMUtils.$('#adminProductList');
    if (!tbody) return;

    tbody.innerHTML = this.currentProducts.length ? '' : `
      <tr class="empty-state">
        <td colspan="7">No products found</td>
      </tr>
    `;
    
    this.currentProducts.forEach(product => {
      const row = DOMUtils.createElement('tr');
      row.innerHTML = `
        <td><input type="checkbox" class="select-product" data-id="${product.id}" aria-label="Select ${product.name}"></td>
        <td><img src="${product.thumbnail || '/assets/images/placeholder.jpg'}" data-src="${product.image}" alt="${product.name}" class="product-thumb" loading="lazy"></td>
        <td>${product.name}</td>
        <td>${product.category}</td>
        <td>₹${product.price.toFixed(2)}</td>
        <td>
          ${product.isNew ? '<span class="badge success">New</span>' : ''}
          ${product.sold ? '<span class="badge danger">Sold Out</span>' : ''}
        </td>
        <td>
          <button class="btn icon-btn edit-btn" data-id="${product.id}" aria-label="Edit ${product.name}">✏️</button>
          <button class="btn icon-btn danger delete-btn" data-id="${product.id}" aria-label="Delete ${product.name}">🗑️</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    this.setupProductInteractions(services);
  }

  static setupProductInteractions(services) {
    DOMUtils.$$('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          this.handleEdit(btn.dataset.id);
        } catch (error) {
          logError(1004, error);
        }
      });
    });
    
    DOMUtils.$$('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          this.showDeleteModal(btn.dataset.id, services);
        } catch (error) {
          logError(1004, error);
        }
      });
    });
    
    const selectAll = DOMUtils.$('#selectAll');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        try {
          DOMUtils.$$('.select-product').forEach(cb => cb.checked = e.target.checked);
        } catch (error) {
          logError(1004, error);
        }
      });
    }
    
    const bulkDelete = DOMUtils.$('#bulkDelete');
    if (bulkDelete) {
      bulkDelete.addEventListener('click', async () => {
        try {
          const selected = Array.from(DOMUtils.$$('.select-product:checked')).map(cb => cb.dataset.id);
          if (selected.length && confirm(`Delete ${selected.length} products?`)) {
            await Promise.all(selected.map(id => services.productService.deleteDoc(id)));
            this.currentProducts = this.currentProducts.filter(p => !selected.includes(p.id));
            this.renderProducts();
            DOMUtils.showToast(`${selected.length} products deleted successfully`);
          }
        } catch (error) {
          logError(1004, error);
        }
      });
    }
    
    this.setupBulkActions(services);
  }

  static setupBulkActions(services) {
    const bulkEdit = DOMUtils.$('#bulkEdit');
    if (bulkEdit) {
      bulkEdit.addEventListener('click', async () => {
        try {
          const selected = Array.from(DOMUtils.$$('.select-product:checked')).map(cb => cb.dataset.id);
          if (selected.length) {
            const updates = { isNew: confirm('Mark as new?') };
            await services.productService.batchUpdateDocs(selected.map(id => ({ docId: id, data: updates })));
            this.loadProducts(services);
          }
        } catch (error) {
          logError(1004, error);
        }
      });
    }
  }

  static async handleEdit(id) {
    const product = this.currentProducts.find(p => p.id === id);
    if (!product) return;
    
    const prodId = DOMUtils.$('#prodId');
    const prodName = DOMUtils.$('#prodName');
    const prodPrice = DOMUtils.$('#prodPrice');
    const prodCategory = DOMUtils.$('#prodCategory');
    const prodNew = DOMUtils.$('#prodNew');
    const prodSold = DOMUtils.$('#prodSold');
    const imagePreview = DOMUtils.$('#imagePreview');
    
    if (prodId) prodId.value = product.id;
    if (prodName) prodName.value = product.name;
    if (prodPrice) prodPrice.value = product.price;
    if (prodCategory) prodCategory.value = product.category;
    if (prodNew) prodNew.checked = product.isNew;
    if (prodSold) prodSold.checked = product.sold;
    if (imagePreview) {
      imagePreview.src = product.image;
      imagePreview.style.display = 'block';
    }
  }

  static showDeleteModal(id, services) {
    const modal = DOMUtils.createElement('div', { class: 'modal', 'aria-modal': 'true' });
    modal.innerHTML = `
      <div class="modal-overlay" data-close="modal"></div>
      <div class="modal-content">
        <h3>Confirm Deletion</h3>
        <p>Are you sure you want to delete this product?</p>
        <button class="btn danger" id="confirmDelete" aria-label="Confirm deletion">Delete</button>
        <button class="btn secondary" data-close="modal" aria-label="Cancel">Cancel</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('active');
    DOMUtils.trapFocus(modal);
    
    const confirmDelete = DOMUtils.$('#confirmDelete', modal);
    if (confirmDelete) {
      confirmDelete.addEventListener('click', async () => {
        try {
          await services.productService.deleteDoc(id);
          this.currentProducts = this.currentProducts.filter(p => p.id !== id);
          this.renderProducts();
          modal.remove();
          DOMUtils.showToast('Product deleted successfully');
        } catch (error) {
          logError(1004, error);
        }
      });
    }
    
    DOMUtils.$$('[data-close="modal"]', modal).forEach(el => {
      el.addEventListener('click', () => {
        try {
          modal.remove
} catch (error) {
          logError(1004, error);
        }
      });
    });
  }

  static setupImageUpload(services) {
    const fileInput = DOMUtils.$('#prodImageFile');
    if (!fileInput) return;

    fileInput.addEventListener('change', () => {
      try {
        const file = fileInput.files[0];
        if (file && file.size > 5 * 1024 * 1024) {
          DOMUtils.showToast('Image must be less than 5MB', 'error');
          fileInput.value = '';
          return;
        }
        if (file) {
          const preview = DOMUtils.$('#imagePreview');
          if (preview) {
            const oldSrc = preview.src;
            preview.src = URL.createObjectURL(file);
            if (oldSrc.startsWith('blob:')) URL.revokeObjectURL(oldSrc);
            preview.style.display = 'block';
          }
        }
      } catch (error) {
        logError(1004, error);
      }
    });
  }

  static setupAdminForm(services) {
    const form = DOMUtils.$('#adminProductForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const prodId = DOMUtils.$('#prodId');
      const prodName = DOMUtils.$('#prodName');
      const prodPrice = DOMUtils.$('#prodPrice');
      const prodCategory = DOMUtils.$('#prodCategory');
      const prodNew = DOMUtils.$('#prodNew');
      const prodSold = DOMUtils.$('#prodSold');
      const prodImageFile = DOMUtils.$('#prodImageFile');
      
      const id = prodId?.value;
      const name = prodName?.value;
      const price = parseFloat(prodPrice?.value);
      const category = prodCategory?.value;
      
      const data = {
        name,
        price,
        category,
        isNew: prodNew?.checked || false,
        sold: prodSold?.checked || false
      };
      
      const file = prodImageFile?.files[0];
      const submitBtn = DOMUtils.$('.submit-btn', form);

      if (!name || name.length < 3) {
        DOMUtils.showToast('Product name must be at least 3 characters', 'error');
        return;
      }
      if (!price || price <= 0) {
        DOMUtils.showToast('Price must be a positive number', 'error');
        return;
      }
      if (!category) {
        DOMUtils.showToast('Category is required', 'error');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-loader"></span> Saving...';
      }

      try {
        if (file) {
          const uploadResult = await services.storageService.uploadImage(file, `products/${id || Date.now()}/${file.name}`);
          data.image = uploadResult.url;
        }
        
        if (id) {
          await services.productService.updateDoc(id, data);
          DOMUtils.showToast('Product updated successfully');
        } else {
          const { docId } = await services.productService.addDoc(data);
          data.id = docId;
          DOMUtils.showToast('Product added successfully');
        }
        
        form.reset();
        const imagePreview = DOMUtils.$('#imagePreview');
        if (imagePreview) imagePreview.style.display = 'none';
        
        this.currentProducts = [];
        this.page = 1;
        await this.loadProducts(services);
      } catch (error) {
        logError(1004, error);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Save Product';
        }
      }
    });
  }

  static async init(services) {
    this.setupImageUpload(services);
    this.setupAdminForm(services);
    await this.loadProducts(services);
    
    const loadMoreTrigger = DOMUtils.$('#loadMoreTrigger');
    if (loadMoreTrigger) {
      loadMoreTrigger.addEventListener('click', () => {
        try {
          this.loadProducts(services);
        } catch (error) {
          logError(1004, error);
        }
      });
    }
  }
}

// Event Manager with Scroll Restoration (Improvement #4)
class EventManager {
  static setupBackToTop() {
    const backToTop = DOMUtils.$('#backToTop');
    if (!backToTop) return;

    const toggleVisibility = () => {
      try {
        backToTop.style.display = window.scrollY > 300 ? 'block' : 'none';
      } catch (error) {
        logError(1004, error);
      }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    backToTop.addEventListener('click', () => {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        logError(1004, error);
      }
    });
  }

  static setupChatBubble() {
    const chatBubble = DOMUtils.$('#chatBubble') || DOMUtils.$('#whatsappBubble a');
    if (!chatBubble) return;

    const messageInput = DOMUtils.$('#contactMessage');
    const defaultMessage = encodeURIComponent('Hi! I have a query about your products.');
    const phoneNumber = '919845677415';

    const updateChatLink = () => {
      try {
        const message = messageInput?.value.trim() || 'Hi! I have a query about your products.';
        chatBubble.href = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      } catch (error) {
        logError(1004, error);
      }
    };

    if (messageInput) messageInput.addEventListener('input', updateChatLink);
    chatBubble.setAttribute('target', '_blank');
    chatBubble.setAttribute('rel', 'noopener noreferrer');
  }

  static setupScrollHandler() {
    const header = DOMUtils.$('header');
    if (!header) return;

    let lastScrollTop = 0;
    window.addEventListener('scroll', () => {
      try {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        if (scrollTop > lastScrollTop && scrollTop > 100) {
          header.classList.add('navbar--hidden');
        } else {
          header.classList.remove('navbar--hidden');
        }
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        SafeStorage.set('scrollPos', scrollTop.toString());
      } catch (error) {
        logError(1004, error);
      }
    }, { passive: true });
  }

  static setupLazyLoading() {
    const images = DOMUtils.$$('img[data-src], iframe[data-src]');
    if ('IntersectionObserver' in window) {
      images.forEach(element => {
        IntersectionObserverManager.observe(element, (entry) => {
          if (entry.isIntersecting) {
            if (element.tagName === 'IMG' || element.tagName === 'IFRAME') {
              element.src = element.dataset.src;
              element.classList.add('loaded');
              IntersectionObserverManager.unobserve(element);
            }
          }
        }, { rootMargin: '100px' });
      });
    } else {
      images.forEach(el => {
        el.src = el.dataset.src;
        el.classList.add('loaded');
      });
    }
  }

  static init() {
    this.setupBackToTop();
    this.setupChatBubble();
    this.setupScrollHandler();
    this.setupLazyLoading();
    
    // Restore scroll position
    const scrollPos = SafeStorage.get('scrollPos', '0');
    if (scrollPos) window.scrollTo(0, parseInt(scrollPos));
  }
}

// SEO Manager with XSS Fix (Improvement #6 & Fix #4)
class SEOManager {
  static generateJSONLD() {
    const jsonLD = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Jeelani Textiles",
      "url": "https://jeelani-textiles.com",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "350/24, MG Road",
        "addressLocality": "Mysuru",
        "addressRegion": "Karnataka",
        "postalCode": "570004",
        "addressCountry": "IN"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+919845677415",
        "contactType": "customer service"
      }
    };
    const script = DOMUtils.createElement('script', { type: 'application/ld+json' });
    script.textContent = JSON.stringify(jsonLD).replace(/</g, '\\u003c');
    document.head.appendChild(script);
  }

  static init() {
    this.generateJSONLD();
    
    // CSP is already in HTML, but we can add additional security headers if needed
    const csp = DOMUtils.createElement('meta', {
      'http-equiv': 'Content-Security-Policy',
      content: "default-src 'self'; script-src 'self' https://www.googletagmanager.com https://*.firebase.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' https://fonts.googleapis.com https://unpkg.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.firebase.com wss://*.firebase.com https://www.google-analytics.com https://ipapi.co; img-src 'self' data: https:; frame-src 'self' https://www.google.com https://maps.google.com;"
    });
    document.head.appendChild(csp);
  }
}

// Settings Manager with Hotkey Modal (Improvement #7)
class SettingsManager {
  static showSettings() {
    const modal = DOMUtils.createElement('div', {
      id: 'settingsModal',
      class: 'modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-hidden': 'false'
    });
    modal.innerHTML = `
      <div class="modal-overlay" data-close="modal"></div>
      <div class="modal-content">
        <h2>Settings</h2>
        <label for="gridSize">Grid Size:</label>
        <select id="gridSize">
          <option value="2" ${appState.settings.gridSize === 2 ? 'selected' : ''}>2 Columns</option>
          <option value="3" ${appState.settings.gridSize === 3 ? 'selected' : ''}>3 Columns</option>
          <option value="4" ${appState.settings.gridSize === 4 ? 'selected' : ''}>4 Columns</option>
        </select>
        <label for="theme">Theme:</label>
        <select id="theme">
          ${ThemeManager.themes.map(t => `<option value="${t}" ${appState.settings.theme === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <label for="language">Language:</label>
        <select id="language">
          <option value="en" ${appState.settings.lang === 'en' ? 'selected' : ''}>English</option>
          <option value="es" ${appState.settings.lang === 'es' ? 'selected' : ''}>Spanish</option>
        </select>
        <button class="btn" id="saveSettings">Save</button>
        <button class="btn secondary" data-close="modal">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('active');
    DOMUtils.trapFocus(modal);

    const saveSettings = DOMUtils.$('#saveSettings', modal);
    if (saveSettings) {
      saveSettings.addEventListener('click', () => {
        try {
          const gridSizeSelect = DOMUtils.$('#gridSize', modal);
          const themeSelect = DOMUtils.$('#theme', modal);
          const languageSelect = DOMUtils.$('#language', modal);
          
          appState.settings.gridSize = parseInt(gridSizeSelect?.value || '3');
          appState.settings.theme = themeSelect?.value || 'light';
          appState.settings.lang = languageSelect?.value || 'en';
          
          ProductManager.renderProducts();
          ThemeManager.init();
          modal.remove();
          DOMUtils.showToast(t('Settings saved'));
        } catch (error) {
          logError(1004, error);
        }
      });
    }

    DOMUtils.$$('[data-close="modal"]', modal).forEach(el => {
      el.addEventListener('click', () => {
        try {
          modal.remove();
        } catch (error) {
          logError(1004, error);
        }
      });
    });
  }

  static init() {
    const settingsBtn = DOMUtils.$('#settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        try {
          this.showSettings();
        } catch (error) {
          logError(1004, error);
        }
      });
    }
  }
}

// Cart Manager (Addition: Feature Addition - Cart Functionality) - ✅ FIXED
class CartManager {
  // ✅ FIXED: Deduplicate items instead of always pushing new entries
  static addToCart(productId, qty = 1) {
    const product = appState.products.find(p => p.id === productId);
    
    if (!product) {
      DOMUtils.showToast('Product not found', 'error');
      return false;
    }
    
    if (product.sold) {
      DOMUtils.showToast('This product is sold out', 'error');
      return false;
    }
    
    // ✅ Check if already in cart
    const existingIndex = appState.cart.findIndex(item => item.id === productId);
    
    if (existingIndex !== -1) {
      // Update quantity
      const newCart = [...appState.cart];
      newCart[existingIndex] = {
        ...newCart[existingIndex],
        qty: newCart[existingIndex].qty + qty
      };
      appState.cart = newCart;
      
      DOMUtils.showToast(
        `${t('Cart updated')}: ${product.name} (${newCart[existingIndex].qty})`, 
        'success'
      );
    } else {
      // Add new item
      appState.cart = [
        ...appState.cart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.thumbnail || product.image,
          qty: qty
        }
      ];
      
      DOMUtils.showToast(`${t('Added to cart')}: ${product.name}`, 'success');
    }
    
    this.renderCart();
    this.updateCartBadge();
    
    return true;
  }

  static updateQuantity(productId, newQty) {
    if (newQty < 1) {
      this.removeFromCart(productId);
      return;
    }
    
    const index = appState.cart.findIndex(item => item.id === productId);
    if (index === -1) return;
    
    const newCart = [...appState.cart];
    newCart[index] = {
      ...newCart[index],
      qty: newQty
    };
    appState.cart = newCart;
    
    this.renderCart();
    this.updateCartBadge();
  }

  static removeFromCart(productId) {
    const item = appState.cart.find(i => i.id === productId);
    if (!item) return;
    
    appState.cart = appState.cart.filter(i => i.id !== productId);
    
    DOMUtils.showToast(`${t('Removed from cart')}: ${item.name}`, 'info');
    this.renderCart();
    this.updateCartBadge();
  }

  static updateCartBadge() {
    const badge = document.querySelector('.cart-badge');
    if (!badge) return;
    
    const totalItems = appState.cart.reduce((sum, item) => sum + item.qty, 0);
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'inline-block' : 'none';
  }

  static getCartTotal() {
    return appState.cart.reduce((total, item) => {
      return total + (item.price * item.qty);
    }, 0);
  }

  static renderCart() {
    const cartEl = DOMUtils.$('#cartContainer');
    if (!cartEl) return;

    if (appState.cart.length === 0) {
      cartEl.innerHTML = `
        <div class="empty-cart">
          <p>Your cart is empty</p>
          <a href="/pages/products.html" class="btn btn--primary">Browse Products</a>
        </div>
      `;
      return;
    }

    const cartHTML = `
      <div class="cart-items">
        ${appState.cart.map(item => `
          <div class="cart-item" data-id="${item.id}">
            <img src="${item.image}" alt="${item.name}" class="cart-item__image">
            <div class="cart-item__details">
              <h4>${item.name}</h4>
              <p class="cart-item__price">₹${item.price.toFixed(2)}</p>
            </div>
            <div class="cart-item__quantity">
              <button class="qty-btn" data-action="decrease" data-id="${item.id}" aria-label="Decrease quantity">-</button>
              <input type="number" 
                     value="${item.qty}" 
                     min="1" 
                     class="qty-input" 
                     data-id="${item.id}"
                     aria-label="Quantity">
              <button class="qty-btn" data-action="increase" data-id="${item.id}" aria-label="Increase quantity">+</button>
            </div>
            <div class="cart-item__total">
              ₹${(item.price * item.qty).toFixed(2)}
            </div>
            <button class="remove-btn" data-id="${item.id}" aria-label="Remove ${item.name}">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        `).join('')}
      </div>
      <div class="cart-summary">
        <div class="cart-total">
          <span>Total:</span>
          <span class="cart-total__amount">₹${this.getCartTotal().toFixed(2)}</span>
        </div>
        <button id="checkoutBtn" class="btn btn--primary btn--large">
          Proceed to Checkout
        </button>
      </div>
    `;
    
    cartEl.innerHTML = cartHTML;
    
    // Attach event listeners
    cartEl.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const productId = btn.dataset.id;
        const action = btn.dataset.action;
        const item = appState.cart.find(i => i.id === productId);
        
        if (!item) return;
        
        const newQty = action === 'increase' ? item.qty + 1 : item.qty - 1;
        this.updateQuantity(productId, newQty);
      });
    });
    
    cartEl.querySelectorAll('.qty-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const productId = e.target.dataset.id;
        const newQty = parseInt(e.target.value) || 1;
        this.updateQuantity(productId, newQty);
      });
    });
    
    cartEl.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const productId = btn.dataset.id;
        
        // Confirm removal
        const item = appState.cart.find(i => i.id === productId);
        if (item && confirm(`Remove ${item.name} from cart?`)) {
          this.removeFromCart(productId);
        }
      });
    });
  }

  static async checkout(services) {
    try {
      // Validate stock for all items
      for (const item of appState.cart) {
        const product = await services.productService.getDoc(item.id);
        if (product.stock < item.qty) {
          DOMUtils.showToast(`${item.name} is out of stock`, 'error');
          return;
        }
      }
      
      // Reserve stock
      for (const item of appState.cart) {
        const reserved = await ProductManager.reserveStock(services, item.id, item.qty);
        if (!reserved) return;
      }
      
      // Create checkout session
      if (!services.functions) {
        throw new Error('Firebase Functions not available');
      }

      const session = await services.functions.httpsCallable('createCheckoutSession')({ items: appState.cart });
      
      if (typeof Stripe !== 'undefined') {
        const stripe = Stripe('pk_test_...'); // Replace with your Stripe public key
        await stripe.redirectToCheckout({ sessionId: session.data.id });
      } else {
        throw new Error('Stripe not loaded');
      }
      
      appState.cart = [];
      DOMUtils.showToast('Checkout complete');
    } catch (error) {
      logError(1004, error);
    }
  }

  static init(services) {
    // Add to cart listeners
    DOMUtils.on('click', '.add-to-cart', (e) => {
      const button = e.delegateTarget;
      const productId = button?.dataset.id;
      if (productId) this.addToCart(productId, 1);
    });
    
    // Checkout button
    const checkoutBtn = DOMUtils.$('#checkoutBtn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => this.checkout(services));
    }
    
    this.renderCart();
    this.updateCartBadge();
  }
}

// Recommendation Manager (Magical Touch: Personalization) - ✅ FIXED
class RecommendationManager {
  static getRecommendations() {
    const viewed = SafeStorage.getJSON('viewedProducts', []);
    return appState.products.filter(p => !viewed.includes(p.id)).slice(0, 3);
  }

  // ✅ FIXED: Use DOM-based rendering instead of string templates
  static renderRecommendations() {
    const recEl = DOMUtils.$('#recommendations');
    if (!recEl) return;
    
    const recommendations = this.getRecommendations();
    
    // Clear container
    recEl.innerHTML = '';
    
    if (!recommendations.length) {
      recEl.innerHTML = '<p class="state-message">No recommendations available.</p>';
      return;
    }
    
    // ✅ Create fragment and append DOM elements
    const fragment = document.createDocumentFragment();
    recommendations.forEach((product, index) => {
      const card = ProductComponent.createCard(product, index);
      fragment.appendChild(card);
    });
    
    recEl.appendChild(fragment);
  }

  static trackView(productId) {
    const viewed = SafeStorage.getJSON('viewedProducts', []);
    if (!viewed.includes(productId)) {
      viewed.push(productId);
      SafeStorage.setJSON('viewedProducts', viewed);
    }
  }

  static init() {
    DOMUtils.on('click', '.product-card__btn', (e) => {
      const button = e.delegateTarget;
      const productId = button?.dataset.id;
      if (productId) this.trackView(productId);
    });
    this.renderRecommendations();
  }
}

// Main App
class JeelaniTextilesApp {
  static async init() {
    const loader = DOMUtils.$('#loader');
    if (loader) loader.style.opacity = '1';

    try {
      // Initialize Firebase services
      services = await initializeServices();
      
      const tasks = [
        ThemeManager.init(),
        ProductManager.init(services),
        TestimonialManager.init(services),
        ContactManager.init(services),
        FAQManager.init(services),
        EventManager.init(),
        SEOManager.init(),
        SettingsManager.init(),
        CartManager.init(services),
        RecommendationManager.init(),
        
        // Service Worker registration
        'serviceWorker' in navigator ? navigator.serviceWorker.register('/service-worker.js').then(reg => {
          console.log('Service Worker registered with scope:', reg.scope);
          
          // Push notification subscription
          reg.pushManager.subscribe({ userVisibleOnly: true }).catch(error => logError(1004, error));
          
          // Update detection
          reg.addEventListener('updatefound', () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('New content is available; please refresh.');
                    DOMUtils.showToast('New version available! Please refresh.', 'info');
                  } else {
                    console.log('Content is cached for offline use.');
                  }
                }
              };
            }
          });
          
          // Warm cache
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage('warm-cache');
          }
        }).catch(error => logError(1004, error)) : null
      ].map(task => task?.catch(error => {
        logError(1004, error);
        return null;
      }));

      await Promise.all(tasks);
      
      // Hide loader with transition
      if (loader) {
        loader.style.opacity = '0';
        loader.addEventListener('transitionend', () => {
          loader.style.display = 'none';
        }, { once: true });
        
        // Fallback if transitionend doesn't fire
        setTimeout(() => {
          if (loader.style.opacity === '0') {
            loader.style.display = 'none';
          }
        }, 500);
      }

      // ✅ FIXED: Global keyboard shortcuts with input check
      document.addEventListener('keydown', (e) => {
        try {
          // ✅ Ignore if user is typing in an input
          const activeElement = document.activeElement;
          const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
          );
          
          if (isTyping) return;
          
          // Handle shortcuts
          if (e.key === '?') {
            e.preventDefault();
            this.showHotkeysModal();
          } else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            SettingsManager.showSettings();
          }
        } catch (error) {
          logError(1004, error);
        }
      });

      // A11Y audit in dev mode
      if (window.location.hostname === 'localhost' && typeof axe !== 'undefined') {
        axe.run(document, (err, results) => {
          if (err) console.error('A11Y Audit Error:', err);
          if (results.violations.length) console.log('A11Y Issues:', results.violations);
        });
      }

      // Offline cart sync
      window.addEventListener('online', async () => {
        if (appState.cart.length) {
          try {
            if (services.cartService) {
              await services.cartService.syncCart(appState.cart);
              appState.cart = [];
              DOMUtils.showToast('Offline cart synced successfully');
            }
          } catch (error) {
            logError(1004, error);
          }
        }
      });

      // Analytics tracking
      if (typeof gtag !== 'undefined') {
        gtag('js', new Date());
        gtag('config', 'G-K66820G64B'); // Replace with actual Google Analytics ID
        
        DOMUtils.on('click', '.product-card__btn', (e) => {
          try {
            const button = e.delegateTarget;
            const productId = button?.dataset.id;
            if (productId) {
              gtag('event', 'view_product', { product_id: productId });
            }
          } catch (error) {
            logError(1004, error);
          }
        });
      }

      // Disable service worker for admin pages
      if (location.pathname.startsWith('/admin')) {
        navigator.serviceWorker.getRegistration().then(reg => reg?.unregister());
      }
    } catch (error) {
      console.error('App initialization failed:', error);
      if (loader) {
        loader.innerHTML = '<p class="state-message error">Failed to load content. Please refresh.</p>';
      }
    }
  }

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
    DOMUtils.$$('[data-close="modal"]', helpModal).forEach(el => {
      el.addEventListener('click', () => helpModal.remove());
    });
  }
}

// Client-Side Routing with Architectural Boundary (Improvement #8)
class Router {
  static routes = {
    '/products': () => ProductManager.init(services),
    '/admin': () => AdminManager.init(services)
  };

  static navigate(path) {
    try {
      history.pushState({}, '', path);
      const handler = this.routes[path] || (() => DOMUtils.showToast('Page not found', 'error'));
      handler();
    } catch (error) {
      logError(1004, error);
    }
  }
}

DOMUtils.on('click', 'a[data-route]', (e) => {
  e.preventDefault();
  const link = e.delegateTarget;
  const href = link?.getAttribute('href');
  if (href) Router.navigate(href);
});

window.addEventListener('popstate', () => Router.navigate(location.pathname));

// Initialize router
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Router.navigate(location.pathname));
} else {
  Router.navigate(location.pathname);
}

// --- Improvement #4: Consolidated IntersectionObservers ---
class IntersectionObserverManager {
  static observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.target._callback) {
        entry.target._callback(entry);
      }
    });
  }, { rootMargin: '100px' });

  static observe(element, callback, options = {}) {
    if (!element) {
      console.warn('IntersectionObserverManager.observe: element is null');
      return;
    }
    
    element._callback = callback;
    
    // Create custom observer if options provided
    if (Object.keys(options).length > 0) {
      const customObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.target._callback) {
            entry.target._callback(entry);
          }
        });
      }, options);
      customObserver.observe(element);
      element._customObserver = customObserver;
    } else {
      IntersectionObserverManager.observer.observe(element);
    }
  }

  static unobserve(element) {
    if (!element) return;
    
    if (element._customObserver) {
      element._customObserver.unobserve(element);
      element._customObserver.disconnect();
      delete element._customObserver;
    } else {
      IntersectionObserverManager.observer.unobserve(element);
    }
    
    delete element._callback;
  }
}

// --- Improvement #4 & #10: Font Loading Optimization (Fix #5) ---
if ('fonts' in document) {
  Promise.all([
    document.fonts.load('1em "Poppins"'),
    document.fonts.load('1em "Playfair Display"'),
    document.fonts.load('1em "Inter"')
  ]).catch((error) => logError(1004, error));
}

// Critical CSS for fonts (inline in head, but also here for reference)
const criticalCSS = `
  @font-face {
    font-family: 'Poppins';
    src: url('/assets/fonts/Poppins-Regular.woff2') format('woff2');
    font-display: swap;
    font-weight: 400;
  }
  @font-face {
    font-family: 'Poppins';
    src: url('/assets/fonts/Poppins-Bold.woff2') format('woff2');
    font-display: swap;
    font-weight: 700;
  }
  @font-face {
    font-family: 'Playfair Display';
    src: url('/assets/fonts/PlayfairDisplay-Regular.woff2') format('woff2');
    font-display: swap;
    font-weight: 400;
  }
  @font-face {
    font-family: 'Inter';
    src: url('/assets/fonts/Inter-Regular.woff2') format('woff2');
    font-display: swap;
    font-weight: 400;
  }
`;

// Only add style if not already present
if (!document.querySelector('style[data-critical-fonts]')) {
  const style = DOMUtils.createElement('style');
  style.setAttribute('data-critical-fonts', 'true');
  style.textContent = criticalCSS;
  document.head.appendChild(style);
}

// Preload critical fonts
const fontFiles = [
  '/assets/fonts/Poppins-Regular.woff2',
  '/assets/fonts/Poppins-Bold.woff2',
  '/assets/fonts/PlayfairDisplay-Regular.woff2',
  '/assets/fonts/Inter-Regular.woff2'
];

fontFiles.forEach(fontUrl => {
  const link = DOMUtils.createElement('link', {
    rel: 'preload',
    href: fontUrl,
    as: 'font',
    type: 'font/woff2',
    crossorigin: 'anonymous'
  });
  // Only add if not already present
  if (!document.querySelector(`link[href="${fontUrl}"]`)) {
    document.head.appendChild(link);
  }
});

// --- TypeScript-style JSDoc Interfaces (Fix #6) ---
/**
 * @typedef {Object} Product
 * @property {string} id - Product ID
 * @property {string} name - Product name
 * @property {number} price - Product price
 * @property {string} [category] - Product category
 * @property {boolean} [isNew] - New product flag
 * @property {boolean} [sold] - Sold out flag
 * @property {string} [image] - Product image URL
 * @property {string} [thumbnail] - Product thumbnail URL
 * @property {string} [imageSmall] - Small product image URL
 * @property {string} [imageMedium] - Medium product image URL
 * @property {string} [description] - Product description
 * @property {string[]} [images] - Additional product images
 * @property {number} [stock] - Available stock quantity
 */

/**
 * @typedef {Object} Settings
 * @property {('light'|'dark'|'sepia'|'high-contrast')} theme - Theme name
 * @property {number} gridSize - Grid size (2-4)
 * @property {string} lang - Language code (e.g., 'en', 'es')
 */

/**
 * @typedef {Object} CartItem
 * @property {string} id - Product ID
 * @property {string} name - Product name
 * @property {number} price - Product price
 * @property {number} qty - Quantity in cart
 * @property {string} [image] - Product image URL
 */

/**
 * @typedef {Object} FAQ
 * @property {string} id - FAQ ID
 * @property {string} question - FAQ question
 * @property {string} answer - FAQ answer
 * @property {string} [category] - FAQ category
 * @property {string} [icon] - FontAwesome icon name
 * @property {number} [helpful] - Helpful vote count
 * @property {number} [unhelpful] - Unhelpful vote count
 */

/**
 * @typedef {Object} FirebaseServices
 * @property {Object} auth - Firebase Auth instance
 * @property {Object} firestore - Firestore instance
 * @property {Object} storage - Firebase Storage instance
 * @property {Object} functions - Firebase Functions instance
 * @property {Object} analytics - Firebase Analytics instance
 * @property {Object} productService - Product service wrapper
 * @property {Object} faqService - FAQ service wrapper
 * @property {Object} contactService - Contact service wrapper
 * @property {Object} storageService - Storage service wrapper
 * @property {Object} [cartService] - Cart service wrapper (optional)
 */

// --- Performance Monitoring ---
if (window.performance && window.performance.mark) {
  window.performance.mark('app-init-start');
  
  window.addEventListener('load', () => {
    window.performance.mark('app-init-end');
    window.performance.measure('app-init', 'app-init-start', 'app-init-end');
    
    const measure = window.performance.getEntriesByName('app-init')[0];
    if (measure) {
      console.log(`App initialization took ${measure.duration.toFixed(2)}ms`);
      
      // Log to analytics if available
      if (typeof gtag !== 'undefined') {
        gtag('event', 'timing_complete', {
          name: 'app_init',
          value: Math.round(measure.duration),
          event_category: 'Performance'
        });
      }
    }
  });
}

// --- Error Recovery Mechanism ---
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

window.addEventListener('error', (event) => {
  consecutiveErrors++;
  
  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    console.error('Too many errors detected. Attempting recovery...');
    
    // Clear potentially corrupted cache
    SafeStorage.keys('products_').forEach(key => SafeStorage.remove(key));
    
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
        // Clear all caches and storage
        SafeStorage.clear();
        consecutiveErrors = 0;
        recoveryUI.remove();
        location.reload();
      });
    }
    
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        location.reload();
      });
    }
  }
});

// Reset error counter on successful navigation
window.addEventListener('load', () => {
  consecutiveErrors = 0;
});

// --- Cleanup on Page Unload ---
window.addEventListener('beforeunload', () => {
  // Save current scroll position
  SafeStorage.set('scrollPos', window.scrollY.toString());
  
  // Save cart state
  if (appState.cart.length > 0) {
    SafeStorage.setJSON('offlineCart', appState.cart);
  }
  
  // Save settings
  SafeStorage.setJSON('userSettings', appState.settings);
});

// --- Export for Testing (if needed) ---
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    JeelaniTextilesApp,
    ProductManager,
    FAQManager,
    ContactManager,
    CartManager,
    DOMUtils,
    SafeStorage,
    ThemeManager,
    SettingsManager,
    RecommendationManager
  };
}

// --- Initialize App ---
// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => JeelaniTextilesApp.init());
} else {
  // DOM already loaded
  JeelaniTextilesApp.init();
}

// --- Development Helpers (Only in Dev Mode) ---
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  // Expose utilities to console for debugging
  window.JeelaniDebug = {
    appState,
    useAppState,
    services: () => services,
    DOMUtils,
    SafeStorage,
    ProductManager,
    CartManager,
    clearCache: () => {
      SafeStorage.keys('products_').forEach(key => SafeStorage.remove(key));
      console.log('Cache cleared');
    },
    resetApp: () => {
      SafeStorage.clear();
      location.reload();
    },
    testToast: (message = 'Test toast', type = 'success') => {
      DOMUtils.showToast(message, type);
    },
    getCart: () => appState.cart,
    addTestProduct: () => {
      const testProduct = {
        id: 'test-' + Date.now(),
        name: 'Test Product',
        price: 99.99,
        qty: 1,
        image: '/assets/images/placeholder.jpg'
      };
      CartManager.addToCart(testProduct.id, 1);
    }
  };
  
  console.log('%c🎨 Jeelani Textiles - Debug Mode', 'color: #4CAF50; font-size: 16px; font-weight: bold;');
  console.log('Access debug utilities via window.JeelaniDebug');
  console.log('Available methods:', Object.keys(window.JeelaniDebug));
}

// --- Analytics Helper for Custom Events ---
window.trackEvent = function(eventName, eventParams = {}) {
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, eventParams);
    console.log('Event tracked:', eventName, eventParams);
  } else {
    console.warn('Analytics not available');
  }
};

// --- Final Console Message ---
console.log('%c✨ Jeelani Textiles', 'color: #2196F3; font-size: 24px; font-weight: bold;');
console.log('%cWebsite initialized successfully', 'color: #4CAF50; font-size: 14px;');
console.log(`%cVersion: 2.0.0 | Build: ${new Date().toISOString()}`, 'color: #999; font-size: 12px;');

// End of script.js