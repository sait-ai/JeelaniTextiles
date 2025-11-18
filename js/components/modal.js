/**
 * @file components/modal.js
 * @description Modal component for product details
 * @version 2.0.0
 */

import { DOMUtils } from '../utils/dom.js';

/**
 * Modal Manager - Handle product detail modals
 */
export class ModalManager {
  static modal = null;

  /**
   * Show product detail modal
   * @param {Object} product - Product data
   */
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

    // Close button handlers
    DOMUtils.$$('[data-close="modal"]', this.modal).forEach((el) => {
      el.addEventListener('click', () => this.hide());
    });

    // Thumbnail click handlers
    DOMUtils.$$('.thumbnail', this.modal).forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const modalImg = DOMUtils.$('#modalImg', this.modal);
        if (modalImg) modalImg.src = thumb.src;
      });
    });

    // Keyboard handler
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });

    // A11Y audit in dev mode
    if (window.location.hostname === 'localhost' && typeof window.axe !== 'undefined') {
      window.axe.run(this.modal, (err, results) => {
        if (err) console.error('A11Y Audit Error:', err);
        if (results.violations.length) console.log('Modal A11Y Issues:', results.violations);
      });
    }
  }

  /**
   * Create modal container
   * @returns {Element}
   */
  static createModal() {
    const modal = DOMUtils.createElement('div', {
      id: 'productModal',
      class: 'modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-hidden': 'true'
    });
    return modal;
  }

  /**
   * Create modal content HTML
   * @param {Object} product - Product data
   * @returns {string}
   */
  static createModalContent(product) {
    const thumbnails = product.images?.length > 1
      ? product.images
          .map(
            (img, i) => `
        <img src="${img}" alt="${product.name} view ${i + 1}" class="thumbnail" data-index="${i}" role="button" aria-label="View image ${i + 1}">
      `
          )
          .join('')
      : '';

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
           target="_blank" 
           class="btn" 
           id="modalWhatsApp" 
           aria-label="Order ${product.name} on WhatsApp">Order on WhatsApp</a>
        <button class="btn secondary" data-close="modal">Close</button>
        ${arButton}
      </div>
    `;
  }

  /**
   * Hide modal
   */
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

export default ModalManager;