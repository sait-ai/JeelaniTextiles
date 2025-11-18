/**
 * @file managers/product.js
 * @description Product management with virtual scrolling and search
 * @version 2.0.0
 */

import { DOMUtils } from '../utils/dom.js';
import { SafeStorage } from '../utils/storage.js';
import { t } from '../utils/i18n.js';
import { useAppState } from '../state/store.js';

/**
 * Product Component - Render individual product cards
 */
class ProductComponent {
  static createCard(product, index) {
    const settings = useAppState.getState().settings;
    const aosAttr = window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      ? {} 
      : { 'data-aos': 'fade-up', 'data-aos-delay': index * 50 };

    const card = DOMUtils.createElement('article', {
      class: `product-card card grid-${settings.gridSize}`,
      ...aosAttr,
      'data-id': product.id
    });

    card.innerHTML = `
      <figure class="product-card__media">
        <img src="${product.thumbnail || '/assets/images/placeholder.jpg'}" 
             srcset="${product.imageSmall || product.image} 320w, ${product.imageMedium || product.image} 640w, ${product.image} 1280w" 
             sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw" 
             data-src="${product.image}" 
             alt="${product.name}" 
             loading="lazy">
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

    // Preload image on hover
    card.addEventListener('mouseover', () => {
      if (!product.sold) {
        const link = new Image();
        link.src = product.image;
      }
    }, { once: true });

    return card;
  }
}

/**
 * Virtual Scroll - Optimize rendering of large lists
 */
class VirtualScroll {
  constructor(container, items, renderItem, visibleItems) {
    this.container = container;
    this.items = items;
    this.renderItem = renderItem;
    this.visibleItems = visibleItems;
    this.startIndex = 0;
    this.itemHeight = 0;
    this.visibleImages = [];
  }

  render() {
    if (!this.container) {
      console.warn('VirtualScroll: container not found');
      return;
    }

    this.container.innerHTML = '';

    if (!this.items.length) {
      this.container.innerHTML = `<p class="state-message">${t('No products found.')}</p>`;
      return;
    }

    // Calculate item height
    const firstItem = this.renderItem(this.items[0], 0);
    this.container.appendChild(firstItem);
    this.itemHeight = firstItem.offsetHeight || 200;
    this.container.removeChild(firstItem);

    // Render visible items with buffer
    const buffer = 15;
    const start = Math.max(0, this.startIndex - buffer);
    const end = Math.min(this.items.length, this.startIndex + this.visibleItems + buffer);

    const fragment = document.createDocumentFragment();

    for (let i = start; i < end; i++) {
      const itemEl = this.renderItem(this.items[i], i);
      itemEl.setAttribute('aria-posinset', i + 1);
      itemEl.setAttribute('aria-setsize', this.items.length);
      fragment.appendChild(itemEl);

      // Track images for lazy loading
      const img = itemEl.querySelector('img[data-src]');
      if (img) {
        this.visibleImages.push({
          el: img,
          top: i * this.itemHeight,
          bottom: (i + 1) * this.itemHeight,
          load: () => (img.src = img.dataset.src)
        });
      }
    }

    this.container.appendChild(fragment);
    this.container.style.height = `${this.items.length * this.itemHeight}px`;
    this.setupScroll();
  }

  setupScroll() {
    this.container.addEventListener('scroll', () => {
      const scrollTop = this.container.scrollTop;
      const newStartIndex = Math.floor(scrollTop / this.itemHeight);

      if (newStartIndex !== this.startIndex) {
        this.startIndex = newStartIndex;
        this.render();
      }

      // Lazy load visible images
      const { top, bottom } = this.container.getBoundingClientRect();
      this.visibleImages.forEach((img) => {
        if (img.top > top - 500 && img.bottom < bottom + 500 && !img.el.src.includes(img.el.dataset.src)) {
          img.load();
        }
      });
    }, { passive: true });
  }
}

/**
 * Product Filter - Filter products by category
 */
class ProductFilter {
  static filterByCategory(products, category) {
    if (category === 'all') return products;
    if (category === 'new') return products.filter((p) => p.isNew);
    if (category === 'none') return [];
    return products.filter((p) => p.category === category);
  }
}

/**
 * Product Manager - Main product management class
 */
export class ProductManager {
  static fuse = null;
  static listenersAttached = false;

  /**
   * Load products from Firebase
   * @param {Object} services - Firebase services
   */
  static async loadProducts(services) {
    const state = useAppState.getState();
    
    if (state.isLoading) return;
    state.setLoading(true);

    const grid = DOMUtils.$('#productGrid');
    if (!grid) {
      state.setLoading(false);
      return;
    }

    const loadMoreBtn = DOMUtils.$('#loadMore');

    try {
      const cacheKey = `products_${state.currentPage}`;
      let cached = SafeStorage.getJSON(cacheKey, null);
      let products, lastDoc;

      if (cached) {
        ({ products, lastDoc } = cached);
      } else {
        const result = await services.productService.getProducts({
          pageSize: 12,
          lastDoc: state.lastVisible,
          startAfter: state.lastVisible
        });
        products = result.products;
        lastDoc = result.lastDoc;
        SafeStorage.setJSON(cacheKey, { products, lastDoc });
      }

      state.addProducts(products);
      state.setLastVisible(lastDoc);

      // Initialize Fuse.js for search
      this.initializeSearch();

      if (loadMoreBtn) {
        loadMoreBtn.textContent = t(products.length < 12 ? 'No More Products' : 'Load More');
        loadMoreBtn.style.display = products.length < 12 ? 'none' : 'block';
      }

      this.renderProducts();
    } catch (error) {
      console.error('Failed to load products:', error);
      grid.innerHTML = '<p class="state-message error">Failed to load products.</p>';
      DOMUtils.showToast(t('Failed to load'), 'error');
    } finally {
      state.setLoading(false);
      if (loadMoreBtn) loadMoreBtn.disabled = false;
    }
  }

  /**
   * Initialize Fuse.js search
   */
  static initializeSearch() {
    const state = useAppState.getState();
    
    if (state.products.length > 0 && typeof window.Fuse !== 'undefined') {
      this.fuse = new window.Fuse(state.products, {
        keys: ['name', 'description', 'category'],
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 2
      });
      console.log(`Fuse.js initialized with ${state.products.length} products`);
    }
  }

  /**
   * Render products with optional category filter
   * @param {string} category - Category filter
   */
  static renderProducts(category = 'all') {
    const grid = DOMUtils.$('#productGrid');
    if (!grid) return;

    const state = useAppState.getState();

    if (state.isLoading) {
      grid.innerHTML = `<p class="state-message">${t('Loading...')}</p>`;
      return;
    }

    const filteredProducts = ProductFilter.filterByCategory(state.products, category);
    const virtualScroll = new VirtualScroll(grid, filteredProducts, ProductComponent.createCard, 10);
    virtualScroll.render();

    // Attach listeners once
    if (!this.listenersAttached) {
      this.attachProductListeners(grid);
      this.listenersAttached = true;
    }
  }

  /**
   * Attach event listeners to product grid
   * @param {Element} grid - Product grid element
   */
  static attachProductListeners(grid) {
    // View details button
    DOMUtils.on('click', '.product-card__btn', async (e) => {
      const button = e.delegateTarget;
      const productId = button.dataset.id;
      const state = useAppState.getState();
      const product = state.products.find((p) => p.id === productId);
      
      if (product) {
        const { ModalManager } = await import('../components/modal.js');
        ModalManager.show(product);
      }
    }, grid);

    // Quantity input change
    DOMUtils.on('change', '[data-bind="quantity"]', (e) => {
      const input = e.target;
      const productId = input.closest('.product-card')?.dataset.id;
      if (!productId) return;

      const qtyFeedback = DOMUtils.$(`#qtyFeedback-${productId}`);
      const qty = parseInt(input.value);
      
      if (qty < 1) input.value = 1;
      
      if (qtyFeedback) {
        qtyFeedback.textContent = `Quantity set to ${input.value}`;
      }
    }, grid);
  }

  /**
   * Setup filter buttons
   */
  static setupFilters() {
    DOMUtils.$$('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        DOMUtils.$$('.filter-btn').forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        this.renderProducts(btn.dataset.category);
      });
    });
  }

  /**
   * Setup search functionality
   * @param {Object} services - Firebase services
   */
  static setupSearch(services) {
    const input = DOMUtils.$('#searchInput');
    const clear = DOMUtils.$('#searchClear');
    const voiceBtn = DOMUtils.$('#voiceSearch');
    const status = DOMUtils.$('#voiceStatus');

    if (!input) return;

    // Debounced search input
    let searchTimeout;
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = e.target.value.trim().toLowerCase();

        if (query.length < 2) {
          this.renderProducts('all');
          if (clear) clear.style.display = 'none';
          return;
        }

        if (!this.fuse) {
          console.warn('Search not ready - products still loading');
          return;
        }

        const results = this.fuse.search(query);

        if (results.length > 0) {
          this.renderFilteredProducts(results.map((r) => r.item));
        } else {
          this.renderProducts('none');
        }

        if (clear) clear.style.display = 'block';
      }, 300);
    });

    // Clear button
    if (clear) {
      clear.addEventListener('click', () => {
        input.value = '';
        clear.style.display = 'none';
        this.renderProducts('all');
        input.focus();
      });
    }

    // Voice search (if supported)
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
        const command = e.results[0][0].transcript.toLowerCase();
        
        if (command.includes('search')) {
          const query = command.replace('search', '').trim();
          input.value = query;

          if (this.fuse && query.length >= 2) {
            const results = this.fuse.search(query);
            if (results.length > 0) {
              this.renderFilteredProducts(results.map((r) => r.item));
            } else {
              this.renderProducts('none');
            }
          }
          
          if (clear) clear.style.display = 'block';
        }
      };

      recognition.onerror = () => {
        if (status) status.textContent = 'Voice input failed';
      };

      voiceBtn.addEventListener('click', () => {
        recognition.start();
      });
    } else if (voiceBtn) {
      voiceBtn.style.display = 'none';
    }
  }

  /**
   * Render filtered products
   * @param {Array} products - Filtered products
   */
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

  /**
   * Setup infinite scroll
   * @param {Object} services - Firebase services
   */
  static setupInfiniteScroll(services) {
    const trigger = DOMUtils.$('#loadMoreTrigger');
    if (!trigger) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const state = useAppState.getState();
        if (entries[0].isIntersecting && !state.isLoading) {
          this.loadProducts(services);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(trigger);
  }

  /**
   * Reserve stock (for checkout)
   * @param {Object} services - Firebase services
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to reserve
   * @returns {Promise<boolean>}
   */
  static async reserveStock(services, productId, quantity) {
    if (!services.firestore) {
      console.error('Firestore not available');
      return false;
    }

    try {
      // This would need to be implemented in firebase.js ProductService
      // For now, just a placeholder
      console.log(`Reserving ${quantity} of product ${productId}`);
      return true;
    } catch (error) {
      console.error('Failed to reserve stock:', error);
      DOMUtils.showToast(error.message, 'error');
      return false;
    }
  }

  /**
   * Initialize product manager
   * @param {Object} services - Firebase services
   */
  static async init(services) {
    await this.loadProducts(services);
    this.setupInfiniteScroll(services);
    this.setupFilters();
    this.setupSearch(services);

    const loadMoreBtn = DOMUtils.$('#loadMore');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        this.loadProducts(services);
      });
    }
  }
}

export default ProductManager;
