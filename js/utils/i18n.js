/**
 * @file utils/i18n.js
 * @description Internationalization utilities
 * @version 2.0.0
 */

/**
 * Translation strings
 */
const translations = {
  en: {
    'Load More': 'Load More',
    'No More Products': 'No More Products',
    'Failed to load': 'Failed to load',
    'Switched to': 'Switched to',
    'Settings saved': 'Settings saved',
    'Added to cart': 'Added to cart',
    'Removed from cart': 'Removed from cart',
    'Cart updated': 'Cart updated',
    'Loading...': 'Loading...',
    'No items found.': 'No items found.',
    'No products found.': 'No products found.'
  },
  es: {
    'Load More': 'Cargar Más',
    'No More Products': 'No Más Productos',
    'Failed to load': 'Error al cargar',
    'Switched to': 'Cambiar a',
    'Settings saved': 'Configuración guardada',
    'Added to cart': 'Añadido al carrito',
    'Removed from cart': 'Eliminado del carrito',
    'Cart updated': 'Carrito actualizado',
    'Loading...': 'Cargando...',
    'No items found.': 'No se encontraron artículos.',
    'No products found.': 'No se encontraron productos.'
  }
};

/**
 * Get current language from settings
 * @returns {string} Language code (default: 'en')
 */
export function getCurrentLanguage() {
  try {
    const settings = JSON.parse(localStorage.getItem('userSettings') || '{}');
    return settings.lang || 'en';
  } catch {
    return 'en';
  }
}

/**
 * Translate key to current language
 * @param {string} key - Translation key
 * @returns {string} Translated string
 */
export function t(key) {
  const lang = getCurrentLanguage();
  return translations[lang]?.[key] || translations['en'][key] || key;
}

/**
 * Add translation for a language
 * @param {string} lang - Language code
 * @param {Object} strings - Translation strings
 */
export function addTranslations(lang, strings) {
  if (!translations[lang]) {
    translations[lang] = {};
  }
  Object.assign(translations[lang], strings);
}

export default { t, getCurrentLanguage, addTranslations };