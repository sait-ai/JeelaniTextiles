/**
 * @file managers/cart.js
 * @description Shopping cart management with persistence
 * @version 2.0.0
 */

import { DOMUtils } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { useAppState } from '../state/store.js';

/**
 * Cart Manager - Handle cart operations
 */
export class CartManager {
  /**
   * Add item to cart (with deduplication)
   * @param {string} productId - Product ID
   * @param {number} qty - Quantity to add
   * @returns {boolean} Success status
   */
  static addToCart(productId, qty = 1) {
    const state = useAppState.getState();
    const product = state.products.find((p) => p.id === productId);

    if (!product) {
      DOMUtils.showToast('Product not found', 'error');
      return false;
    }

    if (product.sold) {
      DOMUtils.showToast('This product is sold out', 'error');
      return false;
    }

    // Check if already in cart (deduplicate)
    const existingIndex = state.cart.findIndex((item) => item.id === productId);

    if (existingIndex !== -1) {
      // Update quantity
      state.updateCart((cart) => {
        const newCart = [...cart];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          qty: newCart[existingIndex].qty + qty
        };
        return newCart;
      });

      DOMUtils.showToast(
        `${t('Cart updated')}: ${product.name} (${state.cart[existingIndex].qty})`,
        'success'
      );
    } else {
      // Add new item
      state.updateCart((cart) => [
        ...cart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.thumbnail || product.image,
          qty: qty
        }
      ]);

      DOMUtils.showToast(`${t('Added to cart')}: ${product.name}`, 'success');
    }

    this.renderCart();
    this.updateCartBadge();

    return true;
  }

  /**
   * Update item quantity
   * @param {string} productId - Product ID
   * @param {number} newQty - New quantity
   */
  static updateQuantity(productId, newQty) {
    if (newQty < 1) {
      this.removeFromCart(productId);
      return;
    }

    const state = useAppState.getState();
    const index = state.cart.findIndex((item) => item.id === productId);
    
    if (index === -1) return;

    state.updateCart((cart) => {
      const newCart = [...cart];
      newCart[index] = {
        ...newCart[index],
        qty: newQty
      };
      return newCart;
    });

    this.renderCart();
    this.updateCartBadge();
  }

  /**
   * Remove item from cart
   * @param {string} productId - Product ID
   */
  static removeFromCart(productId) {
    const state = useAppState.getState();
    const item = state.cart.find((i) => i.id === productId);
    
    if (!item) return;

    state.updateCart((cart) => cart.filter((i) => i.id !== productId));

    DOMUtils.showToast(`${t('Removed from cart')}: ${item.name}`, 'info');
    this.renderCart();
    this.updateCartBadge();
  }

  /**
   * Update cart badge count
   */
  static updateCartBadge() {
    const badge = document.querySelector('.cart-badge');
    if (!badge) return;

    const state = useAppState.getState();
    const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
    
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'inline-block' : 'none';
  }

  /**
   * Get cart total
   * @returns {number} Total price
   */
  static getCartTotal() {
    const state = useAppState.getState();
    return state.cart.reduce((total, item) => total + item.price * item.qty, 0);
  }

  /**
   * Render cart UI
   */
  static renderCart() {
    const cartEl = DOMUtils.$('#cartContainer');
    if (!cartEl) return;

    const state = useAppState.getState();

    if (state.cart.length === 0) {
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
        ${state.cart.map((item) => `
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
    cartEl.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const productId = btn.dataset.id;
        const action = btn.dataset.action;
        const item = state.cart.find((i) => i.id === productId);

        if (!item) return;

        const newQty = action === 'increase' ? item.qty + 1 : item.qty - 1;
        this.updateQuantity(productId, newQty);
      });
    });

    cartEl.querySelectorAll('.qty-input').forEach((input) => {
      input.addEventListener('change', (e) => {
        const productId = e.target.dataset.id;
        const newQty = parseInt(e.target.value) || 1;
        this.updateQuantity(productId, newQty);
      });
    });

    cartEl.querySelectorAll('.remove-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const productId = btn.dataset.id;
        const item = state.cart.find((i) => i.id === productId);

        if (item && confirm(`Remove ${item.name} from cart?`)) {
          this.removeFromCart(productId);
        }
      });
    });
  }

  /**
   * Checkout process
   * @param {Object} services - Firebase services
   */
  static async checkout(services) {
    const state = useAppState.getState();

    try {
      // Validate stock for all items
      for (const item of state.cart) {
        const product = await services.productService.getDoc(item.id);
        if (product.data && product.data.stock < item.qty) {
          DOMUtils.showToast(`${item.name} is out of stock`, 'error');
          return;
        }
      }

      // Reserve stock (would need implementation in firebase.js)
      // For now, just placeholder
      console.log('Reserving stock for checkout...');

      // Create checkout session (Stripe integration)
      if (!services.functions) {
        throw new Error('Firebase Functions not available');
      }

      const session = await services.functions.httpsCallable('createCheckoutSession')({
        items: state.cart
      });

      if (typeof window.Stripe !== 'undefined') {
        const stripe = window.Stripe('pk_test_...'); // Replace with actual key from .env
        await stripe.redirectToCheckout({ sessionId: session.data.id });
      } else {
        throw new Error('Stripe not loaded');
      }

      // Clear cart after successful checkout
      state.setCart([]);
      DOMUtils.showToast('Checkout complete', 'success');
    } catch (error) {
      console.error('Checkout failed:', error);
      DOMUtils.showToast('Checkout failed: ' + error.message, 'error');
    }
  }

  /**
   * Initialize cart manager
   * @param {Object} services - Firebase services
   */
  static init(services) {
    // Add to cart button listeners
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

export default CartManager;