/**
 * @file config.js
 * @description Environment configuration loader with validation
 * @version 2.0.0
 * @author Jeelani Textiles Dev Team
 */

/**
 * Environment detection
 */
const ENV = {
    isDevelopment: import.meta.env?.MODE === 'development' || window.location.hostname === 'localhost',
    isProduction: import.meta.env?.MODE === 'production',
    mode: import.meta.env?.MODE || 'development'
};

/**
 * Gets required environment variable with graceful fallback
 * @param {string} key - Environment variable name
 * @param {string} fallback - Fallback value for development
 * @returns {string} Value
 */
function getRequiredEnv(key, fallback = '') {
    const value = import.meta.env[key];
    
    if (!value) {
        if (ENV.isDevelopment && fallback) {
            console.warn(`⚠️ Using fallback for ${key} (development mode)`);
            return fallback;
        }
        
        console.error(`❌ Missing required environment variable: ${key}`);
        // Don't throw - let firebase.js handle fallback
        return '';
    }
    
    return value;
}

/**
 * Gets optional environment variable with fallback
 * @param {string} key - Environment variable name
 * @param {string} fallback - Default value
 * @returns {string} Value or fallback
 */
function getOptionalEnv(key, fallback = '') {
    return import.meta.env[key] || fallback;
}

/**
 * Application configuration object
 * Loads from .env file via Vite's import.meta.env
 * Falls back gracefully in development mode
 */
export const config = {
    firebase: {
        apiKey: getRequiredEnv('VITE_FIREBASE_API_KEY', 'AIzaSyAKP7iyy9A7A6ivkuA7Fx8fP4IldKcpFqU'),
        authDomain: getRequiredEnv('VITE_FIREBASE_AUTH_DOMAIN', 'jeelani-textiles.firebaseapp.com'),
        projectId: getRequiredEnv('VITE_FIREBASE_PROJECT_ID', 'jeelani-textiles'),
        storageBucket: getRequiredEnv('VITE_FIREBASE_STORAGE_BUCKET', 'jeelani-textiles.firebasestorage.app'),
        messagingSenderId: getRequiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '92286295672'),
        appId: getRequiredEnv('VITE_FIREBASE_APP_ID', '1:92286295672:web:56babe00edd1f6b3d1d78d'),
        measurementId: getOptionalEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-K66820664B')
    },
    
    stripe: {
        publicKey: getOptionalEnv('VITE_STRIPE_PUBLIC_KEY', '')
    },
    
    analytics: {
        gaId: getOptionalEnv('VITE_GA_MEASUREMENT_ID', 'G-K66820664B')
    },
    
    whatsapp: {
        phoneNumber: getOptionalEnv('VITE_WHATSAPP_NUMBER', '919845677415')
    },
    
    // Environment flags
    isDevelopment: ENV.isDevelopment,
    isProduction: ENV.isProduction,
    mode: ENV.mode
};

// Validate configuration on load (non-blocking)
if (config.isDevelopment) {
    console.log('🔧 Configuration loaded:', {
        firebase: { 
            projectId: config.firebase.projectId,
            hasApiKey: !!config.firebase.apiKey 
        },
        mode: config.mode,
        whatsapp: config.whatsapp.phoneNumber
    });
    
    // Warn about missing critical config
    if (!config.firebase.apiKey) {
        console.warn('⚠️ Firebase API key not configured - app may not function correctly');
    }
}

export default config;