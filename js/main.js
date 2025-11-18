/**
 * @file main.js
 * @description Third-party library initialization (AOS, Swiper, Barba.js)
 * @version 2.0.0
 * 
 * NOTE: This file is now OPTIONAL and can be deleted.
 * All functionality has been moved to app.js and its modules.
 * 
 * This file is kept only for:
 * 1. Swiper carousel initialization
 * 2. Barba.js page transitions
 * 
 * Everything else (theme, menu, wishlist, service worker, etc.) 
 * is now handled by app.js
 */

import { DOMUtils } from './utils/dom.js';

// ============================================================================
// SWIPER CAROUSEL
// ============================================================================

/**
 * Initialize Swiper carousel
 */
function initSwiper() {
  if (typeof window.Swiper === 'undefined') {
    console.warn('Swiper library not loaded');
    return;
  }

  const swiperContainer = document.querySelector('.swiper-container');
  if (!swiperContainer) {
    console.warn('Swiper container not found');
    return;
  }

  try {
    const swiper = new window.Swiper('.swiper-container', {
      slidesPerView: 1,
      spaceBetween: 10,
      
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
        bulletActiveClass: 'swiper-pagination-bullet-active'
      },
      
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev'
      },
      
      breakpoints: {
        640: { slidesPerView: 2, spaceBetween: 20 },
        768: { slidesPerView: 3, spaceBetween: 30 },
        1024: { slidesPerView: 4, spaceBetween: 40 }
      },
      
      a11y: {
        enabled: true,
        prevSlideMessage: 'Previous slide',
        nextSlideMessage: 'Next slide',
        firstSlideMessage: 'This is the first slide',
        lastSlideMessage: 'This is the last slide'
      },
      
      keyboard: {
        enabled: true,
        onlyInViewport: true
      },
      
      watchSlidesProgress: true,
      watchSlidesVisibility: true
    });

    console.log('✅ Swiper initialized');
    return swiper;
  } catch (error) {
    console.error('Swiper initialization failed:', error);
  }
}

// ============================================================================
// BARBA.JS PAGE TRANSITIONS
// ============================================================================

/**
 * Initialize Barba.js for smooth page transitions
 */
function initBarba() {
  if (typeof window.barba === 'undefined') {
    console.warn('Barba.js library not loaded');
    return;
  }

  if (typeof window.gsap === 'undefined') {
    console.warn('GSAP library not loaded (required for Barba)');
    return;
  }

  try {
    // Check if wrapper exists or create it
    let wrapper = document.querySelector('[data-barba="wrapper"]');

    if (!wrapper) {
      console.log('Creating Barba wrapper...');

      const main = document.getElementById('main-content') || document.querySelector('main');
      if (!main) {
        console.warn('Cannot initialize Barba: main content not found');
        return;
      }

      // Create wrapper
      wrapper = document.createElement('div');
      wrapper.setAttribute('data-barba', 'wrapper');

      // Create container
      const container = document.createElement('div');
      container.setAttribute('data-barba', 'container');
      container.setAttribute('data-barba-namespace', 'home');

      // Move main into container
      main.parentNode.insertBefore(wrapper, main);
      wrapper.appendChild(container);
      container.appendChild(main);
    }

    // Initialize Barba
    window.barba.init({
      transitions: [
        {
          name: 'opacity-transition',
          leave(data) {
            return window.gsap.to(data.current.container, {
              opacity: 0,
              duration: 0.3
            });
          },
          enter(data) {
            return window.gsap.from(data.next.container, {
              opacity: 0,
              duration: 0.3
            });
          }
        }
      ],
      
      views: [
        {
          namespace: 'home',
          beforeEnter() {
            // Reinitialize AOS on page change
            if (typeof window.AOS !== 'undefined') {
              window.AOS.refresh();
            }
          }
        }
      ],
      
      prevent: ({ el }) => {
        // Don't use Barba for external links or specific elements
        return el.classList.contains('no-barba') || el.host !== window.location.host;
      },
      
      debug: false,
      timeout: 5000
    });

    console.log('✅ Barba.js initialized');
  } catch (error) {
    console.error('Barba.js initialization failed:', error);
  }
}

// ============================================================================
// AUTO-INITIALIZE
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('📚 main.js - Initializing third-party libraries...');
  
  initSwiper();
  initBarba();
  
  console.log('✅ main.js loaded');
});

// ============================================================================
// EXPORTS
// ============================================================================

export { initSwiper, initBarba };
export default { initSwiper, initBarba };