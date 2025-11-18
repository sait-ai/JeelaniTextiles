/**
 * @file managers/faq.js
 * @description FAQ management with accordion and voting
 * @version 2.0.0
 */

import { DOMUtils } from '../utils/dom.js';
import { SafeStorage } from '../utils/storage.js';
import { t } from '../utils/i18n.js';

/**
 * FAQ Manager - Handle FAQ loading and interactions
 */
export class FAQManager {
  /**
   * Load FAQs from Firestore
   * @param {Object} services - Firebase services
   */
  static async loadFAQs(services) {
    const list = DOMUtils.$('.faq-list') || DOMUtils.$('#faqContainer');
    if (!list) return;

    list.innerHTML = `<p class="state-message">${t('Loading...')}</p>`;

    try {
      const { data: faqs } = await services.faqService.getFAQs();

      list.innerHTML = faqs
        .map(
          (faq) => `
        <div class="faq-item card" data-category="${faq.category}" data-aos="fade-up">
          <button class="faq-question" aria-expanded="false" aria-controls="faq-${faq.id}">
            <span class="faq-category-icon">
              <i class="fas fa-${faq.icon || 'question'}"></i>
            </span>
            <span>${faq.question}</span>
            <svg class="faq-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
            </svg>
          </button>
          <div id="faq-${faq.id}" class="faq-answer" aria-hidden="true">
            <p>${faq.answer.replace(
              '+91 98456 77415',
              '<a href="https://wa.me/919845677415" target="_blank" aria-label="Contact via WhatsApp">+91 98456 77415</a>'
            )}</p>
            <div class="faq-feedback">
              <span>Was this helpful?</span>
              <button class="icon-btn" data-feedback="yes" data-id="${faq.id}" aria-label="Mark FAQ as helpful">👍</button>
              <button class="icon-btn" data-feedback="no" data-id="${faq.id}" aria-label="Mark FAQ as not helpful">👎</button>
            </div>
          </div>
        </div>
      `
        )
        .join('');

      this.setupFAQInteractions(services);
    } catch (error) {
      console.error('Failed to load FAQs:', error);
      list.innerHTML = '<p class="state-message error">Failed to load FAQs.</p>';
      DOMUtils.showToast(t('Failed to load'), 'error');
    }
  }

  /**
   * Setup FAQ accordion interactions
   * @param {Object} services - Firebase services
   */
  static setupFAQInteractions(services) {
    // Accordion toggle
    DOMUtils.$$('.faq-question').forEach((q) => {
      q.addEventListener('click', () => {
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
      });
    });

    // Voting system
    DOMUtils.$$('.faq-feedback button').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const faqId = btn.dataset.id;
        const feedback = btn.dataset.feedback;
        const votedKey = `faq_${faqId}_voted`;

        const voted = SafeStorage.getJSON(votedKey, false);

        if (voted) {
          DOMUtils.showToast('You have already voted on this FAQ', 'info');
          return;
        }

        if (!services.faqService) {
          console.error('FAQ service not available');
          return;
        }

        try {
          await services.faqService.voteHelpful(faqId, feedback === 'yes');
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
          console.error('Failed to vote:', error);
          DOMUtils.showToast('Failed to submit vote', 'error');
        }
      });
    });
  }

  /**
   * Setup FAQ search
   */
  static setupFAQSearch() {
    const input = DOMUtils.$('#faqSearch');
    const clear = DOMUtils.$('#faqClear');

    if (!input) return;

    let searchTimeout;
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = e.target.value.trim().toLowerCase();

        DOMUtils.$$('.faq-item').forEach((item) => {
          const matches = item.textContent.toLowerCase().includes(query);
          item.style.display = matches ? 'block' : 'none';
        });

        if (clear) clear.style.display = query ? 'block' : 'none';
      }, 300);
    });

    if (clear) {
      clear.addEventListener('click', () => {
        input.value = '';
        clear.style.display = 'none';
        DOMUtils.$$('.faq-item').forEach((item) => (item.style.display = 'block'));
        input.focus();
      });
    }
  }

  /**
   * Initialize FAQ manager
   * @param {Object} services - Firebase services
   */
  static async init(services) {
    await this.loadFAQs(services);
    this.setupFAQSearch();
  }
}

export default FAQManager;