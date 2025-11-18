/**
 * @file utils/theme.js
 * @description Theme management with CSS variables
 * @version 2.0.0
 */

import { SafeStorage } from './storage.js';
import { DOMUtils } from './dom.js';
import { t } from './i18n.js';

/**
 * Theme Manager - Handle theme switching with CSS variables
 */
export class ThemeManager {
  static themes = ['light', 'dark', 'sepia', 'high-contrast'];

  /**
   * Initialize theme system
   */
  static init() {
    const themeToggle = DOMUtils.$('#themeToggle');
    if (!themeToggle) return;

    const html = document.documentElement;
    
    // Get current theme
    let currentTheme = SafeStorage.get('theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    this.applyTheme(currentTheme);

    // Toggle button handler
    themeToggle.addEventListener('click', () => {
      try {
        const idx = this.themes.indexOf(currentTheme);
        currentTheme = this.themes[(idx + 1) % this.themes.length];
        
        html.classList.add('theme-transition');
        this.applyTheme(currentTheme);
        
        DOMUtils.showToast(`${t('Switched to')} ${currentTheme} theme`);
        
        setTimeout(() => html.classList.remove('theme-transition'), 500);
      } catch (error) {
        console.error('Theme toggle failed:', error);
      }
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const systemTheme = e.matches ? 'dark' : 'light';
      const savedTheme = SafeStorage.get('theme');
      
      if (!savedTheme || savedTheme === 'system') {
        this.applyTheme(systemTheme);
      }
    });
  }

  /**
   * Apply theme to document
   * @param {string} theme - Theme name
   */
  static applyTheme(theme) {
    const html = document.documentElement;
    
    html.setAttribute('data-theme', theme);
    html.style.setProperty('--theme', theme);
    
    SafeStorage.set('theme', theme);

    // Load theme CSS if exists
    const existingLink = DOMUtils.$('link[data-theme-link]');
    if (existingLink) {
      existingLink.href = `/css/themes/${theme}.css`;
    } else {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `/css/themes/${theme}.css`;
      link.setAttribute('data-theme-link', 'true');
      
      link.onload = () => {
        document.body.classList.add(`${theme}-theme`);
        html.style.transition = 'background-color 0.5s ease, color 0.5s ease';
      };
      
      link.onerror = () => {
        console.warn(`Theme ${theme} CSS not found, using default`);
      };
      
      document.head.appendChild(link);
    }
  }

  /**
   * Get current theme
   * @returns {string}
   */
  static getCurrentTheme() {
    return SafeStorage.get('theme') || 'light';
  }
}

export default ThemeManager;