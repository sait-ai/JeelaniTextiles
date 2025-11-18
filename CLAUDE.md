# CLAUDE.md - Jeelani Textiles Codebase Guide

> **Last Updated**: 2025-11-18
> **Version**: 1.0.0
> **Purpose**: Comprehensive guide for AI assistants working with the Jeelani Textiles codebase

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Directory Structure](#directory-structure)
5. [Tech Stack](#tech-stack)
6. [Development Workflows](#development-workflows)
7. [Code Conventions](#code-conventions)
8. [Key Systems](#key-systems)
9. [Common Tasks](#common-tasks)
10. [Important Patterns](#important-patterns)
11. [Things to Avoid](#things-to-avoid)
12. [Debugging](#debugging)
13. [Security Considerations](#security-considerations)

---

## Project Overview

**Jeelani Textiles** is a Progressive Web Application (PWA) for an e-commerce platform specializing in handcrafted ethnic wear.

### Key Features
- 🛒 Product catalog with advanced filtering and search
- 🛍️ Shopping cart with offline sync capability
- 📱 Progressive Web App (installable, offline-first)
- 🔥 Firebase backend (Firestore, Auth, Storage, Analytics)
- 🎨 Multi-theme support (light, dark, sepia, high-contrast)
- ♿ WCAG 2.1 AA accessibility compliant
- 🌍 Internationalization ready (i18n)
- 👨‍💼 Admin panel for content management
- 📊 Google Analytics integration
- ⚡ Performance optimized (virtual scrolling, lazy loading, caching)

### Project Status
- **Stage**: Late Development / Pre-Production
- **Deployment**: Firebase Hosting (`jeelani-textiles.firebaseapp.com`)
- **No Testing Framework**: Tests need to be added
- **Minimal Documentation**: README is placeholder only

---

## Quick Start

### Prerequisites
```bash
# Node.js 18+ required
node --version

# Firebase CLI (for deployment)
npm install -g firebase-tools
```

### Environment Setup

1. **Create `.env` file** in root directory:
```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Optional
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxx
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_WHATSAPP_NUMBER=919845677415
```

2. **Install dependencies**:
```bash
npm install
```

3. **Start development server**:
```bash
npm run dev
# Opens on http://localhost:3000
```

4. **Build for production**:
```bash
npm run build
# Output: dist/
```

### Project Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Build production bundle to `dist/` |
| `npm run preview` | Preview production build locally |

---

## Architecture

### Design Pattern: **Component-Manager Architecture**

```
┌─────────────────────────────────────────────┐
│            index.html (Entry)               │
│         <script src="/js/app.js">           │
└─────────────────┬───────────────────────────┘
                  │
          ┌───────▼────────┐
          │  JeelaniTextilesApp  │
          │   (Orchestrator)     │
          └───────┬────────┘
                  │
        ┌─────────┼─────────────────┐
        │         │                 │
  ┌─────▼─────┐ ┌▼────────┐ ┌─────▼──────┐
  │ Services  │ │ Managers│ │  Utilities │
  │ (Firebase)│ │(Business│ │    (DOM,   │
  │           │ │ Logic)  │ │   Storage) │
  └───────────┘ └─────────┘ └────────────┘
        │            │              │
        └────────────┼──────────────┘
                     │
              ┌──────▼───────┐
              │ State Store  │
              │   (Zustand)  │
              └──────────────┘
```

### Layer Responsibilities

#### 1. **Entry Point** (`app.js`)
- Single source of truth for app initialization
- Orchestrates all managers and services
- Handles global error recovery
- Registers service worker

#### 2. **Services Layer** (`js/services/`, `js/firebase.js`)
- **Firebase Services**: Database operations (CRUD)
- **System Services**: EventManager, SEOManager, SettingsManager, Router
- **Reusable**: Can be used by any manager

#### 3. **Managers Layer** (`js/managers/`)
- Domain-specific business logic
- Each manager handles one feature area:
  - `ProductManager` - Product catalog & filtering
  - `CartManager` - Shopping cart operations
  - `AdminManager` - Admin authentication & CRUD
  - `ContactManager` - Contact form submission
  - `FAQManager` - FAQ display
  - `TestimonialManager` - Testimonials
  - `RecommendationManager` - Product recommendations

#### 4. **Utilities Layer** (`js/utils/`)
- Pure functions, no side effects
- DOM manipulation (`dom.js`)
- Storage wrapper (`storage.js`)
- Theme switching (`theme.js`)
- Internationalization (`i18n.js`)
- Validation (`validation.js`)

#### 5. **State Layer** (`js/state/store.js`)
- Zustand store with persistence
- Zod validation schemas
- Reactive state management
- Stores: cart, products, settings, user

#### 6. **Components Layer** (`js/components/`)
- Reusable UI components
- Currently: `modal.js`
- Self-contained with own styles

---

## Directory Structure

```
JeelaniTextiles/
├── index.html              # Main entry point (homepage)
├── 404.html                # Error page
├── offline.html            # PWA offline fallback
├── package.json            # NPM dependencies
├── vite.config.js          # Vite build configuration
├── manifest.json           # PWA manifest
├── service-worker.js       # Service Worker for offline support
├── storage.rules           # Firebase Storage security rules
├── .gitignore              # Git ignore patterns
├── README.md               # Project documentation (minimal)
│
├── .env                    # ⚠️ Environment variables (CREATE THIS - not in repo)
│
├── pages/                  # Additional HTML pages
│   ├── admin.html          # Admin dashboard
│   ├── admin-login.html    # Admin authentication
│   ├── contact.html        # Contact page
│   ├── faq.html            # FAQ page
│   └── products.html       # Product catalog page
│
├── assets/                 # Static assets (2.6MB)
│   └── images/
│       ├── hero-bg.webp    # Hero background
│       ├── logo.png
│       └── icons/
│
├── media/                  # Video & animations (4.1MB)
│   ├── intro.mp4           # Intro video
│   └── loader.json         # Lottie animation
│
├── css/                    # Stylesheets (28KB)
│   ├── style.css           # Main stylesheet (21KB, 2.7k lines)
│   └── critical.css        # Critical above-fold CSS
│
└── js/                     # JavaScript modules (299KB, ~3k lines)
    ├── app.js              # ⭐ MAIN ENTRY POINT - App orchestrator
    ├── config.js           # Environment configuration loader
    ├── firebase.js         # Firebase SDK initialization (1723 lines)
    ├── init.js             # Legacy initialization
    ├── main.js             # Legacy entry point (deprecated)
    ├── script.js           # Legacy core logic (deprecated)
    │
    ├── components/         # UI Components
    │   └── modal.js        # Modal component
    │
    ├── managers/           # Business Logic (Domain-specific)
    │   ├── admin.js        # Admin panel management
    │   ├── cart.js         # Shopping cart operations
    │   ├── contact.js      # Contact form handling
    │   ├── faq.js          # FAQ management
    │   ├── product.js      # Product catalog (14.9KB) ⭐ COMPLEX
    │   ├── recommendation.js # Product recommendations
    │   └── testimonial.js  # Testimonials display
    │
    ├── services/           # System Services
    │   └── index.js        # EventManager, SEOManager, SettingsManager, Router
    │
    ├── state/              # State Management
    │   └── store.js        # Zustand store with Zod validation
    │
    └── utils/              # Utility Functions
        ├── dom.js          # DOM manipulation helpers
        ├── i18n.js         # Internationalization
        ├── storage.js      # SafeStorage wrapper for localStorage
        ├── theme.js        # Theme management
        └── validation.js   # Form validation utilities
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Vanilla JavaScript** | ES6+ | No framework - component-based architecture |
| **Vite** | 7.2.2 | Build tool & dev server |
| **PostCSS** | Latest | CSS preprocessing |
| **Zustand** | 4.5.2 | Lightweight state management (CDN) |
| **Zod** | 3.22.4 | Runtime type validation |

### Backend (Firebase)
| Service | Purpose |
|---------|---------|
| **Firestore** | NoSQL database for products, users, FAQs, contacts |
| **Authentication** | Admin login only |
| **Storage** | Image hosting with validation rules |
| **Analytics** | User tracking |
| **Hosting** | Deployment platform |

### Third-Party Libraries (CDN)
- **Swiper.js** - Touch slider/carousel
- **AOS** - Animate On Scroll
- **GSAP** - Advanced animations
- **Barba.js** - Page transitions
- **Fuse.js** - Fuzzy search
- **Hammer.js** - Touch gestures
- **Axe-core** 4.8.2 - Accessibility testing (dev only)
- **Web Vitals** 3.5.0 - Performance monitoring

### CSS Architecture
- **Custom Properties** (CSS Variables)
- **Layer-based** (@layer for cascade control)
- **Design Tokens** (colors, spacing, typography)
- **Container Queries** (modern browsers)
- **4 Themes**: light, dark, sepia, high-contrast

---

## Development Workflows

### Adding a New Feature

#### Example: Adding a "Wishlist" Feature

```javascript
// 1. Create manager file: js/managers/wishlist.js
/**
 * @file wishlist.js
 * @description Wishlist management
 * @version 1.0.0
 */

import { SafeStorage } from '../utils/storage.js';
import { DOMUtils } from '../utils/dom.js';
import { useAppState } from '../state/store.js';

export class WishlistManager {
  static services = null;

  static async init(services) {
    this.services = services;
    this.attachEventListeners();
    console.log('✅ WishlistManager initialized');
  }

  static attachEventListeners() {
    DOMUtils.on('click', '[data-wishlist-add]', this.handleAddToWishlist.bind(this));
  }

  static handleAddToWishlist(e) {
    const productId = e.delegateTarget.dataset.productId;
    // Implementation...
  }
}

// 2. Update app.js to initialize manager
// In initPageSpecificManagers():
await WishlistManager.init(this.services);

// 3. Update state store (js/state/store.js)
// Add wishlist to initial state:
wishlist: [],

// 4. Add Firebase service (js/firebase.js)
// Create WishlistService class

// 5. Add UI in relevant HTML files
// Add wishlist buttons to product cards

// 6. Update CSS (css/style.css)
// Add wishlist button styles
```

### Modifying Existing Features

#### Example: Changing Product Filtering Logic

```javascript
// Location: js/managers/product.js

// Find the applyFilters() method (around line 200-300)
static applyFilters(filters) {
  // Modify filtering logic here

  // IMPORTANT: Virtual scrolling is used, so update:
  // 1. this.filteredProducts array
  // 2. Call this.renderVirtualList() to update display
  // 3. Update product count display
}

// After changes, test:
// 1. Open products.html
// 2. Use filter controls
// 3. Verify virtual scrolling still works
// 4. Check performance (should handle 1000+ products)
```

### Adding a New Page

```bash
# 1. Create HTML file
touch pages/new-page.html

# 2. Update vite.config.js - add to input:
export default {
  build: {
    rollupOptions: {
      input: {
        main: '/index.html',
        products: '/pages/products.html',
        newPage: '/pages/new-page.html',  // ADD THIS
        // ... other pages
      }
    }
  }
}

# 3. Create page-specific manager if needed
# js/managers/new-page.js

# 4. Update app.js initPageSpecificManagers()
if (path.includes('new-page.html')) {
  await NewPageManager.init(this.services);
}

# 5. Add navigation link in index.html
```

---

## Code Conventions

### File Naming
- **JavaScript**: camelCase - `productManager.js` → Actually: `product.js`
- **HTML**: kebab-case - `admin-login.html`
- **CSS**: kebab-case - `style.css`

### Class Naming
- **Classes**: PascalCase - `ProductManager`, `DOMUtils`
- **Constants**: UPPER_SNAKE_CASE - `MAX_PRODUCTS`, `CACHE_TTL`
- **Variables**: camelCase - `productList`, `isLoading`

### JSDoc Standards

All functions must have JSDoc:

```javascript
/**
 * Fetches products from Firestore with caching
 * @param {Object} options - Query options
 * @param {string} [options.category] - Filter by category
 * @param {number} [options.limit=50] - Max results
 * @returns {Promise<Product[]>} Array of products
 * @throws {FirebaseError} If Firestore operation fails
 */
static async fetchProducts(options = {}) {
  // Implementation
}
```

### Error Handling Pattern

```javascript
try {
  const result = await someOperation();
  return result;
} catch (error) {
  console.error('Context-specific error message:', error);

  // User-friendly message
  DOMUtils.showToast('Failed to load products. Please try again.', 'error');

  // Rethrow if caller needs to handle
  throw new CustomError('Operation failed', { cause: error });
}
```

### Import Order

```javascript
// 1. Core utilities
import { DOMUtils } from './utils/dom.js';
import { SafeStorage } from './utils/storage.js';

// 2. State management
import { useAppState } from './state/store.js';

// 3. Services
import { ProductService } from './firebase.js';

// 4. Managers (avoid circular imports)
import { CartManager } from './managers/cart.js';

// 5. Components
import { ModalManager } from './components/modal.js';
```

### CSS Layer Order

```css
/* Order matters - earlier layers have lower priority */
@layer base, themes, components, utilities, animations, admin, performance;

/* Add styles to specific layer */
@layer components {
  .product-card {
    /* styles */
  }
}
```

---

## Key Systems

### 1. State Management (Zustand)

**Location**: `js/state/store.js`

```javascript
import { useAppState } from './state/store.js';

// Read state
const cart = useAppState.getState().cart;
const settings = useAppState.getState().settings;

// Update state (reactive - triggers re-renders)
useAppState.getState().addToCart(product);
useAppState.getState().setTheme('dark');

// Subscribe to changes
useAppState.subscribe((state) => {
  console.log('Cart updated:', state.cart);
});
```

**State Structure**:
```javascript
{
  cart: [],           // Shopping cart items
  products: [],       // Cached products
  settings: {
    theme: 'light',
    language: 'en',
    reducedMotion: false
  },
  user: null,         // Admin user (if logged in)
  offline: false      // Connection status
}
```

### 2. Firebase Integration

**Location**: `js/firebase.js` (1723 lines)

**Key Services**:
- `ProductService` - CRUD for products
- `FAQService` - FAQ operations
- `ContactService` - Contact form submissions
- `TestimonialService` - Testimonial management
- `AuthService` - Admin authentication

**Usage Pattern**:
```javascript
// Services are initialized in app.js and passed to managers
static async init(services) {
  this.services = services;

  // Use service
  const products = await this.services.productService.getAll();
}

// All services extend FirebaseService base class
// Base class provides:
// - getAll(options)
// - getById(id)
// - create(data)
// - update(id, data)
// - delete(id)
// - Automatic caching (LRU, 5-min TTL)
// - Offline queue
// - Rate limiting
```

**Offline Support**:
- IndexedDB persistence enabled
- Offline writes queued automatically
- Syncs when connection restored
- Connection monitoring via `navigator.onLine`

### 3. Router System

**Location**: `js/services/index.js` (Router class)

**Current Implementation**: Multi-page application (not SPA)
- Each page is a separate HTML file
- No client-side routing currently used
- Barba.js available for transitions (optional)

**If enabling SPA mode**:
```javascript
Router.init();
Router.navigate('/products'); // Programmatic navigation
```

### 4. Theme System

**Location**: `js/utils/theme.js`

**Themes**:
1. `light` (default)
2. `dark`
3. `sepia`
4. `high-contrast`

**Usage**:
```javascript
import { ThemeManager } from './utils/theme.js';

// Change theme
ThemeManager.setTheme('dark');

// Get current theme
const current = ThemeManager.getTheme(); // 'dark'

// Respects user's OS preference (prefers-color-scheme)
```

### 5. Virtual Scrolling (Performance)

**Location**: `js/managers/product.js`

**Why**: Handles 1000+ products without lag

**How it works**:
```javascript
// Only renders visible items
// Calculates which items are in viewport
// Dynamically adds/removes DOM elements
// Maintains scroll position

// Important when modifying product display:
// 1. Don't bypass renderVirtualList()
// 2. Item height must be consistent (or specified)
// 3. Container must have fixed height
```

### 6. Modal System

**Location**: `js/components/modal.js`

**Usage**:
```javascript
import { ModalManager } from './components/modal.js';

// Show modal with custom content
ModalManager.show({
  title: 'Product Details',
  content: productHTML,
  actions: [
    { text: 'Add to Cart', class: 'btn--primary', handler: () => {} },
    { text: 'Close', class: 'btn--secondary', handler: () => ModalManager.hide() }
  ]
});

// Hide modal
ModalManager.hide();

// Keyboard support built-in:
// - ESC to close
// - Tab focus trap
// - ARIA attributes
```

---

## Common Tasks

### Task 1: Add a New Product (via Admin)

```javascript
// 1. Navigate to /pages/admin-login.html
// 2. Login (Firebase Auth)
// 3. Navigate to /pages/admin.html
// 4. Use "Add Product" form

// Programmatically:
const newProduct = {
  name: 'Silk Saree',
  category: 'sarees',
  price: 5999,
  description: 'Beautiful handwoven silk saree',
  images: ['url1', 'url2'],
  inStock: true,
  featured: false,
  tags: ['silk', 'handwoven']
};

await services.productService.create(newProduct);
// Auto-syncs to Firestore
// Cache invalidated
// UI updates reactively
```

### Task 2: Modify Product Display

```javascript
// Location: js/managers/product.js

// Find renderProduct() method
static renderProduct(product) {
  return `
    <article class="product-card" data-id="${product.id}">
      <img src="${product.images[0]}" alt="${product.name}" loading="lazy">
      <h3>${product.name}</h3>
      <p class="price">₹${product.price}</p>

      <!-- ADD YOUR CUSTOM FIELDS HERE -->
      <span class="badge">${product.badge}</span>

      <button class="btn product-card__btn" data-id="${product.id}">
        View Details
      </button>
    </article>
  `;
}

// Update CSS in css/style.css
@layer components {
  .product-card .badge {
    /* Your styles */
  }
}
```

### Task 3: Add Form Validation

```javascript
// Use validation utilities
import { Validators } from './utils/validation.js';

const formData = {
  email: 'user@example.com',
  phone: '9876543210'
};

// Validate
if (!Validators.isEmail(formData.email)) {
  DOMUtils.showToast('Invalid email address', 'error');
  return;
}

if (!Validators.isPhone(formData.phone)) {
  DOMUtils.showToast('Invalid phone number', 'error');
  return;
}

// Or use Zod for complex validation
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^[0-9]{10}$/)
});

try {
  schema.parse(formData);
} catch (error) {
  console.error('Validation failed:', error.errors);
}
```

### Task 4: Debug Firebase Issues

```javascript
// Development helpers (localhost only)
window.__firebase_debug__ = {
  // Check connection
  isOnline: () => navigator.onLine,

  // View cache
  cache: productService.cache,

  // Clear cache
  clearCache: () => productService.clearCache(),

  // Test Firestore query
  testQuery: async () => {
    const db = getFirestore();
    const snapshot = await getDocs(collection(db, 'products'));
    console.log('Products:', snapshot.size);
  },

  // View offline queue
  getQueue: () => productService.offlineQueue
};
```

### Task 5: Update Environment Variables

```bash
# 1. Edit .env file
VITE_FIREBASE_API_KEY=new_key

# 2. Restart dev server (Vite hot-reload won't pick up .env changes)
npm run dev

# 3. Verify in console
# config.js logs current config in development mode
```

### Task 6: Add a New Theme

```css
/* css/style.css */

@layer themes {
  [data-theme="my-theme"] {
    /* Color tokens */
    --color-primary: #your-color;
    --color-background: #your-bg;
    --color-text: #your-text;
    /* ... all required tokens */
  }
}
```

```javascript
// js/utils/theme.js - Update THEMES array
const THEMES = ['light', 'dark', 'sepia', 'high-contrast', 'my-theme'];
```

---

## Important Patterns

### ✅ Pattern 1: Manager Initialization

**Always follow this pattern** when creating managers:

```javascript
export class YourManager {
  static services = null;
  static initialized = false;

  static async init(services) {
    if (this.initialized) {
      console.warn('YourManager already initialized');
      return;
    }

    this.services = services;

    // Setup
    await this.loadData();
    this.attachEventListeners();

    this.initialized = true;
    console.log('✅ YourManager initialized');
  }

  static attachEventListeners() {
    DOMUtils.on('click', '.your-selector', this.handleClick.bind(this));
  }

  static async loadData() {
    try {
      const data = await this.services.yourService.getAll();
      // Process data
    } catch (error) {
      console.error('Failed to load data:', error);
      throw error;
    }
  }
}
```

### ✅ Pattern 2: Event Delegation

**Use DOMUtils.on() for dynamic content**:

```javascript
// ❌ BAD - Won't work for dynamically added elements
document.querySelectorAll('.product-card').forEach(card => {
  card.addEventListener('click', handler);
});

// ✅ GOOD - Works for current and future elements
DOMUtils.on('click', '.product-card', (e) => {
  const card = e.delegateTarget; // The .product-card element
  const productId = card.dataset.id;
});
```

### ✅ Pattern 3: Safe DOM Manipulation

```javascript
// Always use DOMUtils for safety

// Query elements
const element = DOMUtils.$('#my-id'); // Single element (or null)
const elements = DOMUtils.$$('.my-class'); // NodeList

// Create elements
const div = DOMUtils.createElement('div', {
  class: 'my-class',
  'data-id': '123',
  'aria-label': 'Descriptive label'
});

// Show toast notifications
DOMUtils.showToast('Success message', 'success');
DOMUtils.showToast('Error occurred', 'error');
DOMUtils.showToast('Please wait...', 'info');

// Focus management (accessibility)
DOMUtils.trapFocus(modalElement); // Trap focus within modal
```

### ✅ Pattern 4: Firebase Service Usage

```javascript
// Services are cached and rate-limited automatically

// Fetch data (uses cache if available)
const products = await this.services.productService.getAll({
  category: 'sarees',
  limit: 50
});

// Cache is invalidated on write
await this.services.productService.update(productId, { price: 6999 });
// Next getAll() will fetch fresh data

// Offline writes are queued
if (!navigator.onLine) {
  await this.services.productService.create(newProduct);
  // Queued in IndexedDB
  // Will sync when online
}
```

### ✅ Pattern 5: Accessibility

```javascript
// Always include ARIA attributes

const button = DOMUtils.createElement('button', {
  class: 'btn',
  'aria-label': 'Add Silk Saree to cart', // Descriptive label
  'aria-pressed': 'false', // For toggle buttons
  type: 'button' // Prevent form submission
});

// Loading states
button.setAttribute('aria-busy', 'true');
button.disabled = true;
// ... after operation
button.setAttribute('aria-busy', 'false');
button.disabled = false;

// Live regions for dynamic content
const status = DOMUtils.createElement('div', {
  'aria-live': 'polite',
  'aria-atomic': 'true',
  class: 'sr-only' // Screen reader only
});
status.textContent = 'Product added to cart';
```

---

## Things to Avoid

### ❌ Don't: Bypass the Manager Layer

```javascript
// ❌ BAD - Direct Firebase calls in UI code
const db = getFirestore();
const products = await getDocs(collection(db, 'products'));

// ✅ GOOD - Use managers
const products = await ProductManager.getProducts();
```

### ❌ Don't: Mutate State Directly

```javascript
// ❌ BAD
const state = useAppState.getState();
state.cart.push(item); // Direct mutation

// ✅ GOOD
useAppState.getState().addToCart(item);
```

### ❌ Don't: Use Synchronous localStorage

```javascript
// ❌ BAD - Can throw errors, no safety
localStorage.setItem('key', value);

// ✅ GOOD - Error handling, JSON serialization
SafeStorage.set('key', value);
```

### ❌ Don't: Hardcode Strings

```javascript
// ❌ BAD
alert('Product added to cart');

// ✅ GOOD - Use i18n
DOMUtils.showToast(t('cart.added'), 'success');

// For now, i18n returns English strings
// But infrastructure ready for multiple languages
```

### ❌ Don't: Create Memory Leaks

```javascript
// ❌ BAD - Event listener never removed
window.addEventListener('scroll', heavyFunction);

// ✅ GOOD - Remove when done
const handler = () => heavyFunction();
window.addEventListener('scroll', handler);

// Later, or in cleanup
window.removeEventListener('scroll', handler);

// Or use { once: true }
window.addEventListener('scroll', handler, { once: true });
```

### ❌ Don't: Skip Error Handling

```javascript
// ❌ BAD
const data = await fetchData();

// ✅ GOOD
try {
  const data = await fetchData();
  return data;
} catch (error) {
  console.error('Failed to fetch data:', error);
  DOMUtils.showToast('Failed to load. Please try again.', 'error');
  return []; // Safe fallback
}
```

### ❌ Don't: Use Inline Styles

```javascript
// ❌ BAD
element.style.color = 'red';
element.style.display = 'none';

// ✅ GOOD - Use classes
element.classList.add('error-state');
element.classList.add('hidden');
```

---

## Debugging

### Development Tools

**Access debug utilities** (localhost only):

```javascript
// In browser console
window.JeelaniDebug

// Available methods:
JeelaniDebug.app              // App instance
JeelaniDebug.state            // Zustand store
JeelaniDebug.services()       // Firebase services
JeelaniDebug.clearCache()     // Clear product cache
JeelaniDebug.resetApp()       // Clear all storage & reload
JeelaniDebug.testToast()      // Test toast notifications
JeelaniDebug.getCart()        // View cart contents
JeelaniDebug.addTestProduct() // Add test item to cart
```

### Logging Conventions

```javascript
// Success
console.log('✅ Operation completed');

// Error
console.error('❌ Operation failed:', error);

// Warning
console.warn('⚠️ Deprecation notice');

// Info
console.log('🔧 Configuration loaded');

// Debug (use groups for complex logs)
console.group('Product Filters Applied');
console.log('Category:', filters.category);
console.log('Price range:', filters.priceRange);
console.log('Results:', products.length);
console.groupEnd();
```

### Performance Monitoring

```javascript
// Automatic performance tracking in app.js
// Check console for:
// - "⚡ App initialization took XXms"
// - Web Vitals metrics (LCP, FID, CLS)

// Manual performance marks
performance.mark('operation-start');
// ... your code
performance.mark('operation-end');
performance.measure('operation', 'operation-start', 'operation-end');

const measure = performance.getEntriesByName('operation')[0];
console.log(`Operation took ${measure.duration}ms`);
```

### Accessibility Audit

**Automatic in development**:
- Axe-core runs on page load (localhost only)
- Check console for violations
- Fix reported issues before production

**Manual testing**:
```javascript
// Run audit manually
axe.run(document, (err, results) => {
  console.table(results.violations);
});
```

---

## Security Considerations

### 🔒 Current Security Measures

1. **Firebase Security Rules** (`storage.rules`):
   - Admin-only write access
   - Public read for products
   - File size limits (2-10MB)
   - Content type validation (images only)

2. **Environment Variables**:
   - Configuration via `.env` (not in repo)
   - Validated in `config.js`
   - Throws errors if missing required vars

3. **XSS Prevention**:
   - No `innerHTML` with user input
   - All user content sanitized
   - CSP headers (should be configured in hosting)

4. **Rate Limiting**:
   - Token bucket algorithm in Firebase services
   - Prevents quota exhaustion
   - Max 10 operations/second

### ⚠️ Security Concerns to Address

1. **Exposed Firebase Config**:
   - Firebase config is in client code (normal for web apps)
   - Ensure Firestore security rules are strict
   - Use App Check for additional protection

2. **Admin Authentication**:
   - Only Firebase Auth, no MFA
   - Consider adding 2FA for admin accounts

3. **Content Security Policy**:
   - `unsafe-inline` allowed in CSP
   - Tighten CSP before production

4. **Form Validation**:
   - Client-side validation only
   - Must have server-side validation in Firestore rules

### ✅ Best Practices for AI Assistants

1. **Never log sensitive data**:
   ```javascript
   // ❌ BAD
   console.log('User data:', userData);

   // ✅ GOOD
   console.log('User loaded:', userData.id);
   ```

2. **Validate all inputs**:
   ```javascript
   // Use Zod schemas for validation
   const ProductSchema = z.object({
     name: z.string().min(1).max(100),
     price: z.number().positive(),
     // ...
   });
   ```

3. **Sanitize user content**:
   ```javascript
   // Before displaying user input
   const safe = DOMUtils.escapeHTML(userInput);
   ```

4. **Check permissions**:
   ```javascript
   // Before admin operations
   const user = useAppState.getState().user;
   if (!user || !user.isAdmin) {
     throw new Error('Unauthorized');
   }
   ```

---

## Additional Resources

### Key Files to Review

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `js/app.js` | App orchestrator | 615 | Medium |
| `js/firebase.js` | Firebase integration | 1723 | High |
| `js/managers/product.js` | Product catalog | 450 | High |
| `js/state/store.js` | State management | 200 | Medium |
| `css/style.css` | All styles | 2700 | Medium |

### External Documentation

- **Vite**: https://vitejs.dev/
- **Firebase**: https://firebase.google.com/docs/web/setup
- **Zustand**: https://github.com/pmndrs/zustand
- **Zod**: https://zod.dev/
- **Swiper**: https://swiperjs.com/
- **GSAP**: https://greensock.com/gsap/

### Firebase Collections Structure

```
Firestore Database:
├── products/
│   └── {productId}
│       ├── name: string
│       ├── category: string
│       ├── price: number
│       ├── description: string
│       ├── images: string[]
│       ├── inStock: boolean
│       ├── featured: boolean
│       ├── tags: string[]
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
├── faqs/
│   └── {faqId}
│       ├── question: string
│       ├── answer: string
│       ├── category: string
│       └── order: number
│
├── testimonials/
│   └── {testimonialId}
│       ├── name: string
│       ├── message: string
│       ├── rating: number
│       ├── avatar: string
│       └── createdAt: timestamp
│
└── contacts/
    └── {contactId}
        ├── name: string
        ├── email: string
        ├── phone: string
        ├── message: string
        ├── status: string
        └── createdAt: timestamp
```

---

## Quick Reference: Common File Locations

### Need to change...

| What | Where | File(s) |
|------|-------|---------|
| Homepage content | HTML | `index.html` |
| Product display | JavaScript | `js/managers/product.js` |
| Cart logic | JavaScript | `js/managers/cart.js` |
| Styles | CSS | `css/style.css` |
| Theme colors | CSS | `css/style.css` (search `@layer themes`) |
| Firebase config | Environment | `.env` (create if missing) |
| Build config | JavaScript | `vite.config.js` |
| Admin features | JavaScript | `js/managers/admin.js` |
| Contact form | JavaScript | `js/managers/contact.js` |
| Global utilities | JavaScript | `js/utils/*` |
| State structure | JavaScript | `js/state/store.js` |
| Service Worker | JavaScript | `service-worker.js` |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-18 | Initial CLAUDE.md creation |

---

## Notes for AI Assistants

### When Starting a Task

1. **Read this file first** - Understand patterns and conventions
2. **Check relevant manager** - Most features live in managers
3. **Review state store** - Understand data flow
4. **Test in dev mode** - Use `npm run dev` and debug tools
5. **Check accessibility** - Axe audit should pass

### When Stuck

1. **Check debug tools**: `window.JeelaniDebug`
2. **Review similar code**: Look at other managers for patterns
3. **Check browser console**: Extensive logging available
4. **Verify environment**: Is `.env` configured correctly?

### When Done

1. **Test functionality** - Does it work as expected?
2. **Check console** - Any errors or warnings?
3. **Test accessibility** - Use keyboard navigation
4. **Test offline** - If relevant, test offline functionality
5. **Review performance** - No significant slowdowns?

---

**Remember**: This codebase values **accessibility**, **performance**, and **maintainability**. When in doubt, follow existing patterns and prioritize user experience.

---

*End of CLAUDE.md*
