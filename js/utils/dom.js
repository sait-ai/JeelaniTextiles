/**
 * @file utils/dom.js
 * @description DOM manipulation utilities with error boundaries
 * @version 2.0.0
 */

/**
 * DOM Utilities - Safe DOM manipulation with error handling
 */
export class DOMUtils {
  /**
   * Query single element
   * @param {string} selector - CSS selector
   * @param {Document|Element} context - Search context
   * @returns {Element|null}
   */
  static $(selector, context = document) {
    const element = context.querySelector(selector);
    if (!element) {
      console.warn(`Element not found: ${selector}`);
    }
    return element;
  }

  /**
   * Query multiple elements
   * @param {string} selector - CSS selector
   * @param {Document|Element} context - Search context
   * @returns {Element[]}
   */
  static $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
  }

  /**
   * Create element with attributes
   * @param {string} tag - HTML tag name
   * @param {Object} attrs - Element attributes
   * @returns {Element}
   */
  static createElement(tag, attrs = {}) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class') {
        el.className = value;
      } else if (key.startsWith('data-')) {
        el.dataset[key.slice(5)] = value;
      } else {
        el.setAttribute(key, value);
      }
    });
    return el;
  }

  /**
   * Trap focus within modal for accessibility
   * @param {Element} modal - Modal element
   */
  static trapFocus(modal) {
    const focusable = this.$$(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      modal
    );

    if (!focusable.length) {
      modal.setAttribute('tabindex', '-1');
      modal.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    modal.addEventListener('keydown', (e) => {
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

  /**
   * Show toast notification
   * @param {string} message - Message text
   * @param {string} type - Type: success, error, info, warning
   */
  static showToast(message, type = 'success') {
    const toast = this.createElement('div', {
      class: `toast toast--${type}`,
      role: 'alert',
      'aria-live': 'assertive'
    });
    toast.textContent = message;
    document.body.appendChild(toast);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Add class to element
   * @param {Element} element - Target element
   * @param {string} className - Class name
   */
  static addClass(element, className) {
    element?.classList.add(className);
  }

  /**
   * Remove class from element
   * @param {Element} element - Target element
   * @param {string} className - Class name
   */
  static removeClass(element, className) {
    element?.classList.remove(className);
  }

  /**
   * Toggle class on element
   * @param {Element} element - Target element
   * @param {string} className - Class name
   */
  static toggleClass(element, className) {
    element?.classList.toggle(className);
  }

  /**
   * Event delegation with closest() for proper bubbling
   * @param {string} event - Event type
   * @param {string} selector - CSS selector for delegation
   * @param {Function} handler - Event handler
   * @param {Document|Element} context - Context element
   */
  static on(event, selector, handler, context = document) {
    context.addEventListener(event, (e) => {
      const matchedElement = e.target.closest(selector);

      if (matchedElement && context.contains(matchedElement)) {
        e.delegateTarget = matchedElement;
        handler(e);
      }
    });
  }

  /**
   * Render list with template function
   * @param {Element} container - Container element
   * @param {Array} items - Items to render
   * @param {Function} templateFn - Template function
   */
  static renderList(container, items, templateFn) {
    if (!container) {
      console.warn('renderList: container not found');
      return;
    }

    if (!items.length) {
      container.innerHTML = '<p class="state-message">No items found.</p>';
      return;
    }

    container.innerHTML = items.map(templateFn).join('');
  }
}

export default DOMUtils;