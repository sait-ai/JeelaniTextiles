/**
 * @file managers/contact.js
 * @description Contact form management with validation and CSRF protection
 * @version 2.0.0
 */

import { DOMUtils } from '../utils/dom.js';
import { SafeStorage } from '../utils/storage.js';
import { sanitize, isValidEmail, isRequired, Cookie, generateCSRFToken } from '../utils/validation.js';
import { t } from '../utils/i18n.js';

/**
 * Contact Manager - Handle contact form and info
 */
export class ContactManager {
  /**
   * Render contact information
   */
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

      // Lazy load map iframe
      const mapIframe = DOMUtils.$('.map-container iframe');
      if (mapIframe) {
        const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            mapIframe.src = mapIframe.dataset.src;
            observer.unobserve(mapIframe);
          }
        });
        observer.observe(mapIframe);
      }
    } catch (error) {
      console.error('Failed to load contact info:', error);
      container.innerHTML = '<p class="error">Failed to load contact info.</p>';
    }
  }

  /**
   * Submit contact form
   * @param {Object} formData - Form data
   * @param {Object} services - Firebase services
   */
  static async submitForm(formData, services) {
    try {
      const csrfToken = Cookie.get('csrfToken');
      if (!csrfToken || formData.csrfToken !== csrfToken) {
        throw new Error('Invalid CSRF token');
      }

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
        DOMUtils.showToast('Message sent successfully!', 'success');
      }
    } catch (error) {
      console.error('Form submission failed:', error);
      throw error;
    }
  }

  /**
   * Initialize CSRF token
   */
  static async initCSRF() {
    if (!Cookie.get('csrfToken')) {
      const csrfToken = generateCSRFToken();
      Cookie.set('csrfToken', csrfToken, 1);
    }
  }

  /**
   * Show confirmation modal
   */
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

    DOMUtils.$$('[data-close="modal"]', modal).forEach((el) => {
      el.addEventListener('click', () => modal.remove());
    });
  }

  /**
   * Validate field with real-time feedback
   * @param {Element} field - Input field
   * @param {string} helperId - Helper element ID
   * @param {number} minLength - Minimum length
   */
  static validateField(field, helperId, minLength) {
    const helper = DOMUtils.$(helperId);
    if (!field || !helper) return;

    let validationTimeout;
    field.addEventListener('input', () => {
      clearTimeout(validationTimeout);
      validationTimeout = setTimeout(() => {
        this.validateFieldSync(field, helperId, minLength);
      }, 200);
    });

    return this.validateFieldSync(field, helperId, minLength);
  }

  /**
   * Validate field synchronously
   * @param {Element} field - Input field
   * @param {string} helperId - Helper element ID
   * @param {number} minLength - Minimum length
   * @returns {boolean}
   */
  static validateFieldSync(field, helperId, minLength) {
    const helper = DOMUtils.$(helperId);
    if (!field || !helper) return false;

    const value = field.value.trim();

    if (!isRequired(value)) {
      helper.textContent = 'This field is required';
      helper.classList.add('error');
      return false;
    }

    if (value.length < minLength) {
      helper.textContent = `Minimum ${minLength} characters required`;
      helper.classList.add('error');
      return false;
    }

    if (field.type === 'email' && !isValidEmail(value)) {
      helper.textContent = 'Please enter a valid email';
      helper.classList.add('error');
      return false;
    }

    helper.textContent = '';
    helper.classList.remove('error');
    return true;
  }

  /**
   * Setup contact form
   * @param {Object} services - Firebase services
   */
  static setupContactForm(services) {
    const form = DOMUtils.$('#contactForm');
    if (!form) return;

    const fields = ['contactName', 'contactEmail', 'contactMessage'];
    const whatsappBtn = DOMUtils.$('.whatsapp-btn');

    // Load saved drafts and update WhatsApp link
    fields.forEach((id) => {
      const field = DOMUtils.$(`#${id}`);
      if (field) {
        field.value = SafeStorage.get(id, '');
        
        field.addEventListener('input', () => {
          SafeStorage.set(id, field.value);

          // Update WhatsApp link
          const nameField = DOMUtils.$('#contactName');
          const messageField = DOMUtils.$('#contactMessage');
          const name = nameField?.value.trim() || 'a customer';
          const message = messageField?.value.trim() || 'I have a query about your products.';

          if (whatsappBtn) {
            whatsappBtn.href = `https://wa.me/919845677415?text=Hi! I'm ${encodeURIComponent(name)}. ${encodeURIComponent(message)}`;
          }
        });
      }
    });

    // Form submit
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
          csrfToken: Cookie.get('csrfToken')
        };

        try {
          await this.submitForm(data, services);
          this.showConfirmation();
          form.reset();
          fields.forEach((id) => SafeStorage.remove(id));
          
          if (whatsappBtn) {
            whatsappBtn.href = 'https://wa.me/919845677415?text=Hi! I have a query about your products.';
          }
        } catch (error) {
          DOMUtils.showToast('Failed to send message', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Send Message';
          }
        }
      }
    });
  }

  /**
   * Initialize contact manager
   * @param {Object} services - Firebase services
   */
  static async init(services) {
    await this.initCSRF();
    await this.renderContactInfo();
    this.setupContactForm(services);
  }
}

export default ContactManager;