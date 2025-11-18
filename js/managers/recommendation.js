/**
 * @file managers/recommendation.js
 * @description Product recommendation system based on viewing history
 * @version 2.0.0
 */

import { DOMUtils } from '../utils/dom.js';
import { SafeStorage } from '../utils/storage.js';
import { useAppState } from '../state/store.js';

/**
 * Recommendation Manager - Personalized product recommendations
 */
export class RecommendationManager {
  /**
   * Get recommended products (excluding viewed)
   * @returns {Array} Recommended products
   */
  static getRecommendations() {
    const state = useAppState.getState();
    const viewed = SafeStorage.getJSON('viewedProducts', []);
    
    return state.products.filter((p) => !viewed.includes(p.id)).slice(0, 3);
  }

  /**
   * Render recommendations
   */
  static renderRecommendations() {
    const recEl = DOMUtils.$('#recommendations');
    if (!recEl) return;

    const recommendations = this.getRecommendations();

    recEl.innerHTML = '';

    if (!recommendations.length) {
      recEl.innerHTML = '<p class="state-message">No recommendations available.</p>';
      return;
    }

    // Import ProductComponent dynamically
    import('./product.js').then(({ ProductManager }) => {
      const fragment = document.createDocumentFragment();
      
      recommendations.forEach((product, index) => {
        // We need to access ProductComponent from ProductManager
        // For now, create a simple card
        const card = DOMUtils.createElement('article', {
          class: 'product-card card',
          'data-id': product.id
        });

        card.innerHTML = `
          <figure class="product-card__media">
            <img src="${product.thumbnail || product.image}" alt="${product.name}" loading="lazy">
          </figure>
          <div class="product-card__content">
            <h3 class="product-card__title">${product.name}</h3>
            <p class="product-card__price">₹${product.price.toFixed(2)}</p>
            <button class="btn product-card__btn" data-id="${product.id}">View Details</button>
          </div>
        `;

        fragment.appendChild(card);
      });

      recEl.appendChild(fragment);
    });
  }

  /**
   * Track product view
   * @param {string} productId - Product ID
   */
  static trackView(productId) {
    const viewed = SafeStorage.getJSON('viewedProducts', []);
    
    if (!viewed.includes(productId)) {
      viewed.push(productId);
      SafeStorage.setJSON('viewedProducts', viewed);
    }
  }

  /**
   * Initialize recommendation manager
   */
  static init() {
    DOMUtils.on('click', '.product-card__btn', (e) => {
      const button = e.delegateTarget;
      const productId = button?.dataset.id;
      if (productId) this.trackView(productId);
    });

    this.renderRecommendations();
  }
}

export default RecommendationManager;