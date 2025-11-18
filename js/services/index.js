/**
 * @file services/index.js
 * @description System services: event management, SEO, settings, routing
 * @version 2.0.0
 */

import { DOMUtils } from '../utils/dom.js';
import { SafeStorage } from '../utils/storage.js';
import { ThemeManager } from '../utils/theme.js';
import { t } from '../utils/i18n.js';

/**
 * Event Manager - Handle global events and scroll
 */
export class EventManager {
  /**
   * Setup back-to-top button
   */
  static setupBackToTop() {
    const backToTop = DOMUtils.$('#backToTop');
    if (!backToTop) return;

    const toggleVisibility = () => {
      backToTop.style.display = window.scrollY > 300 ? 'block' : 'none';
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /**
   * Setup chat bubble (WhatsApp)
   */
  static setupChatBubble() {
    const chatBubble = DOMUtils.$('#chatBubble') || DOMUtils.$('#whatsappBubble a');
    if (!chatBubble) return;

    const messageInput = DOMUtils.$('#contactMessage');
    const phoneNumber = '919845677415';

    const updateChatLink = () => {
      const message = messageInput?.value.trim() || 'Hi! I have a query about your products.';
      chatBubble.href = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    };

    if (messageInput) messageInput.addEventListener('input', updateChatLink);
    chatBubble.setAttribute('target', '_blank');
    chatBubble.setAttribute('rel', 'noopener noreferrer');
  }

  /**
   * Setup scroll handler for navbar
   */
  static setupScrollHandler() {
    const header = DOMUtils.$('header');
    if (!header) return;

    let lastScrollTop = 0;
    window.addEventListener(
      'scroll',
      () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
          header.classList.add('navbar--hidden');
        } else {
          header.classList.remove('navbar--hidden');
        }
        
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        SafeStorage.set('scrollPos', scrollTop.toString());
      },
      { passive: true }
    );
  }

  /**
   * Setup lazy loading for images and iframes
   */
  static setupLazyLoading() {
    const images = DOMUtils.$$('img[data-src], iframe[data-src]');
    
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const element = entry.target;
              if (element.tagName === 'IMG' || element.tagName === 'IFRAME') {
                element.src = element.dataset.src;
                element.classList.add('loaded');
                observer.unobserve(element);
              }
            }
          });
        },
        { rootMargin: '100px' }
      );

      images.forEach((el) => observer.observe(el));
    } else {
      images.forEach((el) => {
        el.src = el.dataset.src;
        el.classList.add('loaded');
      });
    }
  }

  /**
   * Initialize event manager
   */
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

/**
 * SEO Manager - Handle structured data and meta tags
 */
export class SEOManager {
  /**
   * Generate JSON-LD structured data
   */
  static generateJSONLD() {
    const jsonLD = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Jeelani Textiles',
      url: 'https://jeelani-textiles.com',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '350/24, MG Road',
        addressLocality: 'Mysuru',
        addressRegion: 'Karnataka',
        postalCode: '570004',
        addressCountry: 'IN'
      },
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+919845677415',
        contactType: 'customer service'
      }
    };

    const script = DOMUtils.createElement('script', { type: 'application/ld+json' });
    script.textContent = JSON.stringify(jsonLD).replace(/</g, '\\u003c');
    document.head.appendChild(script);
  }

  /**
   * Initialize SEO manager
   */
  static init() {
    this.generateJSONLD();
  }
}

/**
 * Settings Manager - Handle user settings modal
 */
export class SettingsManager {
  /**
   * Show settings modal
   */
  static showSettings() {
    const { settings } = window.useAppState.getState();

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
          <option value="2" ${settings.gridSize === 2 ? 'selected' : ''}>2 Columns</option>
          <option value="3" ${settings.gridSize === 3 ? 'selected' : ''}>3 Columns</option>
          <option value="4" ${settings.gridSize === 4 ? 'selected' : ''}>4 Columns</option>
        </select>
        <label for="theme">Theme:</label>
        <select id="theme">
          ${ThemeManager.themes.map((t) => `<option value="${t}" ${settings.theme === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <label for="language">Language:</label>
        <select id="language">
          <option value="en" ${settings.lang === 'en' ? 'selected' : ''}>English</option>
          <option value="es" ${settings.lang === 'es' ? 'selected' : ''}>Spanish</option>
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
        const state = window.useAppState.getState();
        const gridSizeSelect = DOMUtils.$('#gridSize', modal);
        const themeSelect = DOMUtils.$('#theme', modal);
        const languageSelect = DOMUtils.$('#language', modal);

        state.updateSettings((prev) => ({
          ...prev,
          gridSize: parseInt(gridSizeSelect?.value || '3'),
          theme: themeSelect?.value || 'light',
          lang: languageSelect?.value || 'en'
        }));

        // Re-render products with new grid size
        import('../managers/product.js').then(({ ProductManager }) => {
          ProductManager.renderProducts();
        });

        ThemeManager.init();
        modal.remove();
        DOMUtils.showToast(t('Settings saved'), 'success');
      });
    }

    DOMUtils.$$('[data-close="modal"]', modal).forEach((el) => {
      el.addEventListener('click', () => modal.remove());
    });
  }

  /**
   * Initialize settings manager
   */
  static init() {
    const settingsBtn = DOMUtils.$('#settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.showSettings());
    }
  }
}

/**
 * Router - Client-side routing
 */
export class Router {
  static routes = {};

  /**
   * Register route
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  static register(path, handler) {
    this.routes[path] = handler;
  }

  /**
   * Navigate to path
   * @param {string} path - Route path
   */
  static navigate(path) {
    history.pushState({}, '', path);
    const handler = this.routes[path] || (() => DOMUtils.showToast('Page not found', 'error'));
    handler();
  }

  /**
   * Initialize router
   */
  static init() {
    window.addEventListener('popstate', () => {
      this.navigate(location.pathname);
    });

    DOMUtils.on('click', 'a[data-route]', (e) => {
      e.preventDefault();
      const link = e.delegateTarget;
      const href = link?.getAttribute('href');
      if (href) this.navigate(href);
    });
  }
}

export default {
  EventManager,
  SEOManager,
  SettingsManager,
  Router
};