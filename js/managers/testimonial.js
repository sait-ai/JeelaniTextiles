/**
 * @file managers/testimonial.js
 * @description Testimonial management
 * @version 2.0.0
 */

import { DOMUtils } from '../utils/dom.js';
import { t } from '../utils/i18n.js';

/**
 * Testimonial Manager - Handle testimonial loading and rendering
 */
export class TestimonialManager {
  /**
   * Render testimonials from Firestore
   * @param {Object} services - Firebase services
   */
  static async renderTestimonials(services) {
    const grid = DOMUtils.$('.testimonial-grid');
    if (!grid) return;

    grid.innerHTML = `<p class="state-message">${t('Loading...')}</p>`;

    try {
      if (!services.firestore) {
        throw new Error('Firestore not available');
      }

      // Import Firebase methods
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

      const querySnapshot = await getDocs(collection(services.firestore, 'testimonials'));

      if (querySnapshot.empty) {
        grid.innerHTML = '<p class="state-message">No testimonials available.</p>';
        return;
      }

      grid.innerHTML = querySnapshot.docs
        .map((doc) => {
          const { quote, author } = doc.data();
          return `
            <div class="card p-lg" data-aos="fade-up">
              <blockquote>
                <p>"${quote}"</p>
                <footer class="mt-md">– ${author}</footer>
              </blockquote>
            </div>
          `;
        })
        .join('');
    } catch (error) {
      console.error('Failed to load testimonials:', error);
      grid.innerHTML = '<p class="state-message error">Failed to load testimonials.</p>';
      DOMUtils.showToast(t('Failed to load'), 'error');
    }
  }

  /**
   * Initialize testimonial manager
   * @param {Object} services - Firebase services
   */
  static async init(services) {
    await this.renderTestimonials(services);
  }
}

export default TestimonialManager;