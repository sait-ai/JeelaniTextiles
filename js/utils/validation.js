/**
 * @file utils/validation.js
 * @description Form validation and input sanitization utilities
 * @version 2.0.0
 */

/**
 * Input sanitization - Remove potentially dangerous characters
 * @param {string} str - Input string
 * @returns {string} Sanitized string
 */
export function sanitize(str) {
  return String(str).replace(/[<>&"']/g, '');
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean}
 */
export function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

/**
 * Validate phone number (flexible format)
 * @param {string} phone - Phone number
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  return /^[0-9+\-\s()]{8,20}$/.test(phone);
}

/**
 * Validate required field
 * @param {string} value - Field value
 * @param {number} minLength - Minimum length
 * @returns {boolean}
 */
export function isRequired(value, minLength = 1) {
  return value && value.trim().length >= minLength;
}

/**
 * Cookie utilities for CSRF protection
 */
export const Cookie = {
  /**
   * Set cookie with expiration
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {number} days - Expiration in days
   */
  set(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
  },

  /**
   * Get cookie value
   * @param {string} name - Cookie name
   * @returns {string}
   */
  get(name) {
    return document.cookie.split('; ').reduce((r, v) => {
      const parts = v.split('=');
      return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
  },

  /**
   * Delete cookie
   * @param {string} name - Cookie name
   */
  delete(name) {
    this.set(name, '', -1);
  }
};

/**
 * Generate CSRF token
 * @returns {string}
 */
export function generateCSRFToken() {
  return crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
}

export default {
  sanitize,
  isValidEmail,
  isValidPhone,
  isRequired,
  Cookie,
  generateCSRFToken
};