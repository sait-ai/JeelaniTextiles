/**
 * @file managers/admin.js
 * @description Admin panel management with role-based access control
 * @version 2.0.0
 */

import { DOMUtils } from '../utils/dom.js';
import { SafeStorage } from '../utils/storage.js';
import { t } from '../utils/i18n.js';
import { useAppState } from '../state/store.js';

/**
 * Admin Manager - Handle admin panel operations with RBAC
 */
export class AdminManager {
  static currentProducts = [];
  static page = 1;
  static limit = 10;
  static lastRequestTime = 0;
  static rateLimit = 1000;

  /**
   * Verify admin role (SECURITY CRITICAL)
   * @param {Object} services - Firebase services
   * @returns {Promise<boolean>}
   */
  static async verifyAdminRole(services) {
    try {
      if (!services.auth || !services.auth.currentUser) {
        console.warn('No authenticated user');
        return false;
      }

      const idTokenResult = await services.auth.currentUser.getIdTokenResult();
      
      if (!idTokenResult.claims.admin) {
        console.warn('User is not an admin');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Admin verification failed:', error);
      return false;
    }
  }

  /**
   * Load products for admin panel
   * @param {Object} services - Firebase services
   */
  static async loadProducts(services) {
    const state = useAppState.getState();
    
    if (state.isLoading || Date.now() - this.lastRequestTime < this.rateLimit) {
      return;
    }

    state.setLoading(true);
    this.lastRequestTime = Date.now();

    const tbody = DOMUtils.$('#adminProductList');
    if (!tbody) {
      state.setLoading(false);
      return;
    }

    // SECURITY: Verify admin role
    const isAdmin = await this.verifyAdminRole(services);
    if (!isAdmin) {
      DOMUtils.showToast('Unauthorized access', 'error');
      window.location.href = '/pages/admin-login.html';
      return;
    }

    try {
      const result = await services.productService.getProducts({
        pageSize: this.limit,
        lastDoc: state.lastVisible
      });

      const products = result.products || [];
      const lastDoc = result.lastDoc;

      this.currentProducts = this.page === 1 ? products : [...this.currentProducts, ...products];
      state.setLastVisible(lastDoc);
      this.renderProducts();

      const loadMoreTrigger = DOMUtils.$('#loadMoreTrigger');
      if (loadMoreTrigger) {
        loadMoreTrigger.style.display = products.length < this.limit ? 'none' : 'block';
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      tbody.innerHTML = '<tr><td colspan="7" class="error">Failed to load products</td></tr>';
      DOMUtils.showToast(t('Failed to load'), 'error');
    } finally {
      state.setLoading(false);
    }
  }

  /**
   * Render products in admin table
   */
  static renderProducts() {
    const tbody = DOMUtils.$('#adminProductList');
    if (!tbody) return;

    if (!this.currentProducts.length) {
      tbody.innerHTML = `
        <tr class="empty-state">
          <td colspan="7">No products found</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';

    this.currentProducts.forEach((product) => {
      const row = DOMUtils.createElement('tr');
      row.innerHTML = `
        <td><input type="checkbox" class="select-product" data-id="${product.id}" aria-label="Select ${product.name}"></td>
        <td><img src="${product.thumbnail || '/assets/images/placeholder.jpg'}" data-src="${product.image}" alt="${product.name}" class="product-thumb" loading="lazy"></td>
        <td>${product.name}</td>
        <td>${product.category}</td>
        <td>₹${product.price.toFixed(2)}</td>
        <td>
          ${product.isNew ? '<span class="badge success">New</span>' : ''}
          ${product.sold ? '<span class="badge danger">Sold Out</span>' : ''}
        </td>
        <td>
          <button class="btn icon-btn edit-btn" data-id="${product.id}" aria-label="Edit ${product.name}">✏️</button>
          <button class="btn icon-btn danger delete-btn" data-id="${product.id}" aria-label="Delete ${product.name}">🗑️</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    this.setupProductInteractions(services);
  }

  /**
   * Setup product interaction listeners
   * @param {Object} services - Firebase services
   */
  static setupProductInteractions(services) {
    // Edit button
    DOMUtils.$$('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.handleEdit(btn.dataset.id);
      });
    });

    // Delete button
    DOMUtils.$$('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.showDeleteModal(btn.dataset.id, services);
      });
    });

    // Select all checkbox
    const selectAll = DOMUtils.$('#selectAll');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        DOMUtils.$$('.select-product').forEach((cb) => (cb.checked = e.target.checked));
      });
    }

    // Bulk delete
    const bulkDelete = DOMUtils.$('#bulkDelete');
    if (bulkDelete) {
      bulkDelete.addEventListener('click', async () => {
        const selected = Array.from(DOMUtils.$$('.select-product:checked')).map((cb) => cb.dataset.id);
        
        if (selected.length && confirm(`Delete ${selected.length} products?`)) {
          try {
            await Promise.all(selected.map((id) => services.productService.deleteDoc(id)));
            this.currentProducts = this.currentProducts.filter((p) => !selected.includes(p.id));
            this.renderProducts();
            DOMUtils.showToast(`${selected.length} products deleted successfully`, 'success');
          } catch (error) {
            console.error('Bulk delete failed:', error);
            DOMUtils.showToast('Failed to delete products', 'error');
          }
        }
      });
    }

    this.setupBulkActions(services);
  }

  /**
   * Setup bulk action buttons
   * @param {Object} services - Firebase services
   */
  static setupBulkActions(services) {
    const bulkEdit = DOMUtils.$('#bulkEdit');
    if (bulkEdit) {
      bulkEdit.addEventListener('click', async () => {
        const selected = Array.from(DOMUtils.$$('.select-product:checked')).map((cb) => cb.dataset.id);
        
        if (selected.length) {
          const updates = { isNew: confirm('Mark as new?') };
          
          try {
            await services.productService.batchUpdateDocs(
              selected.map((id) => ({ docId: id, data: updates }))
            );
            this.loadProducts(services);
            DOMUtils.showToast('Products updated successfully', 'success');
          } catch (error) {
            console.error('Bulk edit failed:', error);
            DOMUtils.showToast('Failed to update products', 'error');
          }
        }
      });
    }
  }

  /**
   * Handle product edit
   * @param {string} id - Product ID
   */
  static async handleEdit(id) {
    const product = this.currentProducts.find((p) => p.id === id);
    if (!product) return;

    const prodId = DOMUtils.$('#prodId');
    const prodName = DOMUtils.$('#prodName');
    const prodPrice = DOMUtils.$('#prodPrice');
    const prodCategory = DOMUtils.$('#prodCategory');
    const prodNew = DOMUtils.$('#prodNew');
    const prodSold = DOMUtils.$('#prodSold');
    const imagePreview = DOMUtils.$('#imagePreview');

    if (prodId) prodId.value = product.id;
    if (prodName) prodName.value = product.name;
    if (prodPrice) prodPrice.value = product.price;
    if (prodCategory) prodCategory.value = product.category;
    if (prodNew) prodNew.checked = product.isNew;
    if (prodSold) prodSold.checked = product.sold;
    
    if (imagePreview) {
      imagePreview.src = product.image;
      imagePreview.style.display = 'block';
    }
  }

  /**
   * Show delete confirmation modal
   * @param {string} id - Product ID
   * @param {Object} services - Firebase services
   */
  static showDeleteModal(id, services) {
    const modal = DOMUtils.createElement('div', {
      class: 'modal',
      'aria-modal': 'true'
    });

    modal.innerHTML = `
      <div class="modal-overlay" data-close="modal"></div>
      <div class="modal-content">
        <h3>Confirm Deletion</h3>
        <p>Are you sure you want to delete this product?</p>
        <button class="btn danger" id="confirmDelete" aria-label="Confirm deletion">Delete</button>
        <button class="btn secondary" data-close="modal" aria-label="Cancel">Cancel</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add('active');
    DOMUtils.trapFocus(modal);

    const confirmDelete = DOMUtils.$('#confirmDelete', modal);
    if (confirmDelete) {
      confirmDelete.addEventListener('click', async () => {
        try {
          await services.productService.deleteDoc(id);
          this.currentProducts = this.currentProducts.filter((p) => p.id !== id);
          this.renderProducts();
          modal.remove();
          DOMUtils.showToast('Product deleted successfully', 'success');
        } catch (error) {
          console.error('Delete failed:', error);
          DOMUtils.showToast('Failed to delete product', 'error');
        }
      });
    }

    DOMUtils.$$('[data-close="modal"]', modal).forEach((el) => {
      el.addEventListener('click', () => modal.remove());
    });
  }

  /**
   * Setup image upload with preview
   * @param {Object} services - Firebase services
   */
  static setupImageUpload(services) {
    const fileInput = DOMUtils.$('#prodImageFile');
    if (!fileInput) return;

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      
      if (file && file.size > 5 * 1024 * 1024) {
        DOMUtils.showToast('Image must be less than 5MB', 'error');
        fileInput.value = '';
        return;
      }

      if (file) {
        const preview = DOMUtils.$('#imagePreview');
        if (preview) {
          const oldSrc = preview.src;
          preview.src = URL.createObjectURL(file);
          if (oldSrc.startsWith('blob:')) URL.revokeObjectURL(oldSrc);
          preview.style.display = 'block';
        }
      }
    });
  }

  /**
   * Setup admin form
   * @param {Object} services - Firebase services
   */
  static setupAdminForm(services) {
    const form = DOMUtils.$('#adminProductForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const prodId = DOMUtils.$('#prodId');
      const prodName = DOMUtils.$('#prodName');
      const prodPrice = DOMUtils.$('#prodPrice');
      const prodCategory = DOMUtils.$('#prodCategory');
      const prodNew = DOMUtils.$('#prodNew');
      const prodSold = DOMUtils.$('#prodSold');
      const prodImageFile = DOMUtils.$('#prodImageFile');

      const id = prodId?.value;
      const name = prodName?.value;
      const price = parseFloat(prodPrice?.value);
      const category = prodCategory?.value;

      // Validation
      if (!name || name.length < 3) {
        DOMUtils.showToast('Product name must be at least 3 characters', 'error');
        return;
      }
      if (!price || price <= 0) {
        DOMUtils.showToast('Price must be a positive number', 'error');
        return;
      }
      if (!category) {
        DOMUtils.showToast('Category is required', 'error');
        return;
      }

      const data = {
        name,
        price,
        category,
        isNew: prodNew?.checked || false,
        sold: prodSold?.checked || false
      };

      const file = prodImageFile?.files[0];
      const submitBtn = DOMUtils.$('.submit-btn', form);

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-loader"></span> Saving...';
      }

      try {
        // Upload image if provided
        if (file) {
          const uploadResult = await services.storageService.uploadImage(
            file,
            `products/${id || Date.now()}/${file.name}`
          );
          data.image = uploadResult.url;
        }

        // Update or create product
        if (id) {
          await services.productService.updateDoc(id, data);
          DOMUtils.showToast('Product updated successfully', 'success');
        } else {
          const result = await services.productService.addDoc(data);
          data.id = result.docId;
          DOMUtils.showToast('Product added successfully', 'success');
        }

        form.reset();
        const imagePreview = DOMUtils.$('#imagePreview');
        if (imagePreview) imagePreview.style.display = 'none';

        this.currentProducts = [];
        this.page = 1;
        await this.loadProducts(services);
      } catch (error) {
        console.error('Form submission failed:', error);
        DOMUtils.showToast('Failed to save product', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Save Product';
        }
      }
    });
  }

  /**
   * Initialize admin manager
   * @param {Object} services - Firebase services
   */
  static async init(services) {
    // SECURITY: Verify admin role before initializing
    const isAdmin = await this.verifyAdminRole(services);
    if (!isAdmin) {
      DOMUtils.showToast('Unauthorized - redirecting...', 'error');
      setTimeout(() => {
        window.location.href = '/pages/admin-login.html';
      }, 2000);
      return;
    }

    this.setupImageUpload(services);
    this.setupAdminForm(services);
    await this.loadProducts(services);

    const loadMoreTrigger = DOMUtils.$('#loadMoreTrigger');
    if (loadMoreTrigger) {
      loadMoreTrigger.addEventListener('click', () => {
        this.loadProducts(services);
      });
    }
  }
}

export default AdminManager;