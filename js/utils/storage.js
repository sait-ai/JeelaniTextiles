/**
 * @file utils/storage.js
 * @description Centralized localStorage wrapper with error handling and fallbacks
 * @version 1.0.0
 */

/**
 * Safe localStorage wrapper
 * Handles quota exceeded, browser restrictions, and provides fallbacks
 */
export class SafeStorage {
    static _memoryFallback = new Map();
    static _available = null;
    
    /**
     * Check if localStorage is available
     */
    static isAvailable() {
        if (this._available !== null) return this._available;
        
        try {
            const test = '__ls_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            this._available = true;
            return true;
        } catch {
            this._available = false;
            console.warn('⚠️ localStorage not available - using memory fallback');
            return false;
        }
    }
    
    /**
     * Get item from storage
     */
    static get(key, fallback = null) {
        try {
            if (this.isAvailable()) {
                return localStorage.getItem(key) || fallback;
            } else {
                return this._memoryFallback.get(key) || fallback;
            }
        } catch (error) {
            console.warn(`SafeStorage.get failed for "${key}":`, error.message);
            return fallback;
        }
    }
    
    /**
     * Get JSON from storage
     */
    static getJSON(key, fallback = null) {
        try {
            const item = this.get(key);
            return item ? JSON.parse(item) : fallback;
        } catch (error) {
            console.warn(`SafeStorage.getJSON failed for "${key}":`, error.message);
            return fallback;
        }
    }
    
    /**
     * Set item in storage
     */
    static set(key, value) {
        try {
            if (this.isAvailable()) {
                localStorage.setItem(key, value);
                return true;
            } else {
                this._memoryFallback.set(key, value);
                return true;
            }
        } catch (error) {
            console.warn(`SafeStorage.set failed for "${key}":`, error.message);
            
            if (error.name === 'QuotaExceededError') {
                console.error('❌ Storage quota exceeded - consider clearing old data');
                // Try to auto-clean old cache entries
                this._cleanOldCache();
            }
            
            return false;
        }
    }
    
    /**
     * Set JSON in storage
     */
    static setJSON(key, value) {
        try {
            return this.set(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`SafeStorage.setJSON failed for "${key}":`, error.message);
            return false;
        }
    }
    
    /**
     * Remove item from storage
     */
    static remove(key) {
        try {
            if (this.isAvailable()) {
                localStorage.removeItem(key);
            } else {
                this._memoryFallback.delete(key);
            }
            return true;
        } catch (error) {
            console.warn(`SafeStorage.remove failed for "${key}":`, error.message);
            return false;
        }
    }
    
    /**
     * Clear all storage
     */
    static clear() {
        try {
            if (this.isAvailable()) {
                localStorage.clear();
            } else {
                this._memoryFallback.clear();
            }
            return true;
        } catch (error) {
            console.warn('SafeStorage.clear failed:', error.message);
            return false;
        }
    }
    
    /**
     * Get all keys with optional prefix filter
     */
    static keys(prefix = '') {
        try {
            const keys = [];
            
            if (this.isAvailable()) {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(prefix)) {
                        keys.push(key);
                    }
                }
            } else {
                for (const key of this._memoryFallback.keys()) {
                    if (key.startsWith(prefix)) {
                        keys.push(key);
                    }
                }
            }
            
            return keys;
        } catch (error) {
            console.warn('SafeStorage.keys failed:', error.message);
            return [];
        }
    }
    
    /**
     * Clean old cache entries (products_*, etc.)
     */
    static _cleanOldCache() {
        try {
            const cacheKeys = this.keys('products_')
                .concat(this.keys('cache_'));
            
            // Remove oldest half
            const toRemove = cacheKeys.slice(0, Math.floor(cacheKeys.length / 2));
            toRemove.forEach(key => this.remove(key));
            
            console.log(`🧹 Cleaned ${toRemove.length} old cache entries`);
        } catch (error) {
            console.warn('Cache cleanup failed:', error.message);
        }
    }
}

export default SafeStorage;