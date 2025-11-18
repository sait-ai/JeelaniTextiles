/**
 * @file init.js
 * @description Application bootstrap with retry logic, theme preloading, and error recovery
 * @version 2.0.0
 * 
 * CHANGES FROM v1:
 * - Removed SafeStorage duplicate (now imported from utils)
 * - Fixed script.js import to use proper ES6 exports
 * - Removed unnecessary 500ms debounce
 * - Made geolocation API opt-in with privacy notice
 * - Improved error recovery UI
 * - Added graceful degradation for missing services
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { initializeServices } from './firebase.js';
import { SafeStorage } from './utils/storage.js';

// Dynamic import for app (allows lazy loading)
let JeelaniTextilesApp;
let DOMUtils;

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

const ENV = {
    isDevelopment: 
        (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'development') ||
        (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1',
    
    isProduction: 
        (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'production') ||
        (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')
};

// ============================================================================
// ERROR HANDLER
// ============================================================================

class AppErrorHandler {
    static log(error, context = '') {
        const errorData = {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        console.error('❌ App Error:', errorData);
        
        // In production, send to error tracking service
        if (ENV.isProduction && window.Sentry) {
            window.Sentry.captureException(error, { extra: errorData });
        }
        
        return errorData;
    }
}

// ============================================================================
// INITIALIZATION WITH RETRY
// ============================================================================

async function initializeApp(maxAttempts = 3) {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        attempts++;
        
        try {
            console.log(`🚀 Initialization attempt ${attempts}/${maxAttempts}...`);
            
            // Step 1: Initialize Firebase services
            const services = await initializeServices();
            console.log('✅ Firebase services initialized');
            
            // Step 2: Lazy load script.js
            if (!JeelaniTextilesApp || !DOMUtils) {
                const scriptModule = await import('./script.js');
                JeelaniTextilesApp = scriptModule.JeelaniTextilesApp;
                DOMUtils = scriptModule.DOMUtils;
                console.log('✅ App modules loaded');
            }
            
            // Step 3: Initialize app with services
            await JeelaniTextilesApp.init(services);
            console.log('✅ App initialized successfully');
            
            return { success: true, services };
            
        } catch (error) {
            AppErrorHandler.log(error, `Initialization attempt ${attempts}`);
            
            if (attempts >= maxAttempts) {
                return { 
                    success: false, 
                    error,
                    attempts 
                };
            }
            
            // Exponential backoff: 1s, 2s, 4s
            const backoff = 1000 * Math.pow(2, attempts - 1);
            console.warn(`⏳ Retrying in ${backoff}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoff));
        }
    }
}

// ============================================================================
// UI MANAGEMENT
// ============================================================================

function hideLoader(loader) {
    if (!loader) return;
    
    loader.style.opacity = '0';
    
    // Use transitionend with fallback
    const onTransitionEnd = () => {
        loader.style.display = 'none';
        loader.remove(); // Clean up DOM
    };
    
    loader.addEventListener('transitionend', onTransitionEnd, { once: true });
    
    // Fallback if transitionend doesn't fire
    setTimeout(() => {
        if (loader.style.opacity === '0' && loader.style.display !== 'none') {
            onTransitionEnd();
        }
    }, 500);
}

function showErrorUI(loader, error, attempts) {
    if (!loader) {
        // Fallback: create error UI if loader doesn't exist
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-recovery';
        errorDiv.setAttribute('role', 'alert');
        errorDiv.setAttribute('aria-live', 'assertive');
        document.body.prepend(errorDiv);
        loader = errorDiv;
    }
    
    loader.innerHTML = `
        <div class="error-recovery__content">
            <svg class="error-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            
            <h2>Unable to Load Application</h2>
            
            <p class="error-message">
                We encountered a problem after ${attempts} attempts.
                ${ENV.isDevelopment ? `<br><small style="color: #666;">Error: ${error.message}</small>` : ''}
            </p>
            
            <div class="error-actions">
                <button id="retryBtn" class="btn btn--primary" autofocus>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                    Try Again
                </button>
                
                <button id="clearCacheBtn" class="btn btn--secondary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Clear Cache & Retry
                </button>
            </div>
            
            <details class="error-details">
                <summary>Technical Details</summary>
                <pre>${error.stack || error.message}</pre>
            </details>
        </div>
    `;
    
    loader.style.display = 'flex';
    loader.style.opacity = '1';
    
    // Attach event listeners
    const retryBtn = document.getElementById('retryBtn');
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            location.reload();
        });
    }
    
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => {
            // Clear all caches
            SafeStorage.clear();
            
            // Clear service worker caches
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                });
            }
            
            location.reload();
        });
    }
}

// ============================================================================
// FIRST VISIT DETECTION
// ============================================================================

async function handleFirstVisit() {
    const visited = SafeStorage.get('visited');
    
    if (!visited) {
        SafeStorage.set('visited', 'true');
        SafeStorage.set('firstVisit', new Date().toISOString());
        
        // Get user language (privacy-respecting)
        const lang = await getUserLanguage();
        
        // Show welcome message
        if (DOMUtils && typeof DOMUtils.showToast === 'function') {
            DOMUtils.showToast(getWelcomeMessage(lang), 'success');
        }
    }
}

/**
 * Get user language with privacy-first approach
 * 1. Check localStorage cache
 * 2. Use navigator.language
 * 3. Only use geolocation if user explicitly consents
 */
async function getUserLanguage() {
    // Check cache
    const cached = SafeStorage.get('userLanguage');
    if (cached) return cached;
    
    // Use browser language (privacy-friendly)
    const navLang = navigator.language || navigator.userLanguage;
    if (navLang) {
        SafeStorage.set('userLanguage', navLang);
        return navLang;
    }
    
    // Fallback to English
    const defaultLang = 'en';
    SafeStorage.set('userLanguage', defaultLang);
    return defaultLang;
}

/**
 * Opt-in geolocation detection (call this only with user consent)
 */
async function detectLanguageByLocation() {
    try {
        const response = await fetch('https://ipapi.co/json/', {
            signal: AbortSignal.timeout(5000) // 5s timeout
        });
        
        if (!response.ok) throw new Error('Geolocation API failed');
        
        const data = await response.json();
        
        if (data && typeof data.languages === 'string') {
            const lang = data.languages.split(',')[0] || 'en';
            SafeStorage.set('userLanguage', lang);
            return lang;
        }
    } catch (error) {
        console.warn('Geolocation detection failed:', error.message);
    }
    
    return 'en';
}

function getWelcomeMessage(lang) {
    const messages = {
        'en': 'Welcome to Jeelani Textiles!',
        'en-US': 'Welcome to Jeelani Textiles!',
        'en-GB': 'Welcome to Jeelani Textiles!',
        'hi': 'जीलानी टेक्सटाइल्स में आपका स्वागत है!',
        'hi-IN': 'जीलानी टेक्सटाइल्स में आपका स्वागत है!',
        'es': '¡Bienvenido a Jeelani Textiles!',
        'fr': 'Bienvenue chez Jeelani Textiles!',
        'de': 'Willkommen bei Jeelani Textiles!',
        'it': 'Benvenuti a Jeelani Textiles!',
        'pt': 'Bem-vindo à Jeelani Textiles!',
        'ja': 'ジーラニテキスタイルへようこそ!',
        'zh': '欢迎来到Jeelani Textiles!',
        'ar': 'مرحبا بكم في جيلاني للمنسوجات!'
    };
    
    // Try full locale (e.g., 'en-US'), then base language (e.g., 'en')
    return messages[lang] || 
           messages[lang.split('-')[0]] || 
           messages['en'];
}

// ============================================================================
// THEME PRELOADING
// ============================================================================

function preloadTheme() {
    const html = document.documentElement;
    
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Get saved theme or use system preference
    const savedTheme = SafeStorage.get('theme');
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    // Apply theme immediately (before styles load)
    html.setAttribute('data-theme', theme);
    
    console.log(`🎨 Theme preloaded: ${theme}`);
}

// ============================================================================
// PROGRESSIVE ENHANCEMENT
// ============================================================================

function setupProgressiveEnhancements() {
    // Check for IntersectionObserver support
    if (!('IntersectionObserver' in window)) {
        console.warn('⚠️ IntersectionObserver not supported - loading all images immediately');
        
        document.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.dataset.src;
            img.classList.add('loaded');
        });
    }
    
    // Check for service worker support
    if (!('serviceWorker' in navigator)) {
        console.warn('⚠️ Service Worker not supported - offline mode unavailable');
    }
    
    // Check for localStorage support
    if (!SafeStorage.isAvailable()) {
        console.warn('⚠️ localStorage not available - some features may not persist');
    }
}

// ============================================================================
// MAIN BOOTSTRAP
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    
    try {
        console.log('📱 Jeelani Textiles - Initializing...');
        
        // Step 1: Preload theme (instant, no flash)
        preloadTheme();
        
        // Step 2: Setup progressive enhancements
        setupProgressiveEnhancements();
        
        // Step 3: Initialize app with retry logic
        const result = await initializeApp(3);
        
        if (result.success) {
            // Hide loader
            hideLoader(loader);
            
            // Handle first visit
            await handleFirstVisit();
            
            console.log('✅ Application ready');
            
        } else {
            // Show error UI
            showErrorUI(loader, result.error, result.attempts);
        }
        
    } catch (error) {
        // Catastrophic failure
        AppErrorHandler.log(error, 'DOMContentLoaded');
        showErrorUI(loader, error, 0);
    }
});

// ============================================================================
// EXPOSE FOR DEBUGGING (Development only)
// ============================================================================

if (ENV.isDevelopment) {
    window.__init_debug__ = {
        reinitialize: () => initializeApp(1),
        clearStorage: () => SafeStorage.clear(),
        testErrorUI: () => {
            const loader = document.getElementById('loader') || document.body;
            showErrorUI(loader, new Error('Test error'), 3);
        },
        detectLanguage: detectLanguageByLocation
    };
    
    console.log('🔧 Init debug utilities: window.__init_debug__');
}