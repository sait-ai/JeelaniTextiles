/**
 * @file config.js
 * @description Environment configuration loader with validation
 * @author Jeelani Textiles Dev Team
 */

/**
 * Validates required environment variables
 * @param {string} key - Environment variable name
 * @returns {string} Value
 * @throws {Error} If key is missing
 */
function getRequiredEnv(key) {
  const value = import.meta.env[key];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${key}`);
    throw new Error(`Configuration error: ${key} not found`);
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
 */
export const config = {
  firebase: {
    apiKey: getRequiredEnv('VITE_FIREBASE_API_KEY'),
    authDomain: getRequiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getRequiredEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getRequiredEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getRequiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getRequiredEnv('VITE_FIREBASE_APP_ID'),
    measurementId: getOptionalEnv('VITE_FIREBASE_MEASUREMENT_ID')
  },
  
  stripe: {
    publicKey: getOptionalEnv('VITE_STRIPE_PUBLIC_KEY')
  },
  
  analytics: {
    gaId: getOptionalEnv('VITE_GA_MEASUREMENT_ID')
  },
  
  whatsapp: {
    phoneNumber: getOptionalEnv('VITE_WHATSAPP_NUMBER', '919845677415')
  },
  
  // Environment flags
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE
};

// Validate configuration on load
if (config.isDevelopment) {
  console.log('🔧 Configuration loaded:', {
    firebase: { projectId: config.firebase.projectId },
    mode: config.mode,
    whatsapp: config.whatsapp.phoneNumber
  });
}

export default config;