(function () {
  'use strict';

  const STORAGE_KEYS = {
    CART: 'crumbAndCo_cart',
    PROMO: 'crumbAndCo_promo',
    SUMMARY: 'crumbAndCo_orderSummary'
  };

  const DELIVERY_FEE = 250;
  const FREE_DELIVERY_THRESHOLD = 4000;
  const DEFAULT_ITEM_IMAGE = 'images/croissants.jpg';

  const LEGACY_IMAGE_MAP = {
    '../images/croissant.svg': 'images/croissants.jpg',
    'images/croissant.svg': 'images/croissants.jpg',
    '../images/sourdough.svg': 'images/artisan-bread.jpg',
    'images/sourdough.svg': 'images/artisan-bread.jpg',
    '../images/chocolate-cake.svg': 'images/chocolate-fudge-cake.jpg',
    'images/chocolate-cake.svg': 'images/chocolate-fudge-cake.jpg',
    '../images/cinnamon-roll.svg': 'images/pastry-puff.jpg',
    'images/cinnamon-roll.svg': 'images/pastry-puff.jpg'
  };

  const PROMO_CODES = {
    CRUMB10: {
      code: 'CRUMB10',
      rate: 0.1,
      description: '10% off bakery order'
    },
    SWEET15: {
      code: 'SWEET15',
      rate: 0.15,
      description: '15% off bakery order'
    }
  };

  const SAMPLE_ITEMS = [
    {
      id: 'croissant-classic',
      name: 'Classic Butter Croissant',
      category: 'Viennoiserie',
      price: 420,
      quantity: 2,
      image: 'images/croissants.jpg'
    },
    {
      id: 'sourdough-loaf',
      name: 'Artisan Country Sourdough',
      category: 'Artisan Bread',
      price: 950,
      quantity: 1,
      image: 'images/artisan-bread.jpg'
    },
    {
      id: 'choco-fudge-slice',
      name: 'Dark Chocolate Fudge Cake',
      category: 'Cakes & Pastries',
      price: 680,
      quantity: 2,
      image: 'images/chocolate-fudge-cake.jpg'
    },
    {
      id: 'cinnamon-roll',
      name: 'Cinnamon Brioche Roll',
      category: 'Morning Bakes',
      price: 390,
      quantity: 1,
      image: 'images/pastry-puff.jpg'
    }
  ];

  // Cached DOM references
  const dom = {
    tableWrapper: document.getElementById('cartTableWrapper'),
    tableBody: document.getElementById('cartTableBody'),
    emptyState: document.getElementById('emptyCartState'),
    navBadge: document.getElementById('cart-badge'),
    menuToggle: document.getElementById('menu-toggle'),
    mobileNav: document.getElementById('mobile-nav'),
    itemCountLabel: document.getElementById('cartItemCountLabel'),
    clearCartBtn: document.getElementById('clearCartBtn'),
    restoreSampleBtn: document.getElementById('restoreSampleBtn'),
    promoForm: document.getElementById('promoForm'),
    promoInput: document.getElementById('promoInput'),
    promoFeedback: document.getElementById('promoFeedback'),
    promoFeedbackText: document.getElementById('promoFeedbackText'),
    removePromoBtn: document.getElementById('removePromoBtn'),
    summarySubtotal: document.getElementById('summarySubtotal'),
    summaryDelivery: document.getElementById('summaryDelivery'),
    summaryDiscount: document.getElementById('summaryDiscount'),
    discountCodeLabel: document.getElementById('discountCodeLabel'),
    summaryTotal: document.getElementById('summaryTotal'),
    deliveryNote: document.getElementById('deliveryNote'),
    checkoutBtn: document.getElementById('checkoutBtn')
  };

  let cart = [];
  let activePromoCode = null;

  function resolveImagePath(rawPath) {
    if (!rawPath) {
      return DEFAULT_ITEM_IMAGE;
    }
    const trimmed = String(rawPath).trim();
    if (LEGACY_IMAGE_MAP[trimmed]) {
      return LEGACY_IMAGE_MAP[trimmed];
    }
    if (trimmed.startsWith('../images/')) {
      return trimmed.slice(3);
    }
    return trimmed;
  }

  /**
   * Format a numeric value as Pakistani Rupees (PKR).
   */
  function formatPKR(amount) {
    const rounded = Math.round(Number(amount) || 0);
    return 'PKR ' + rounded.toLocaleString('en-US');
  }

  /**
   * Escape HTML special characters before inserting text into templates.
   */
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cloneSampleItems() {
    return SAMPLE_ITEMS.map(function (item) {
      return Object.assign({}, item);
    });
  }

  /**
   * Normalize a cart item loaded from localStorage so malformed entries never break rendering.
   */
  function normalizeItem(rawItem) {
    if (!rawItem || typeof rawItem !== 'object') {
      return null;
    }
    const price = Number(rawItem.price);
    const quantity = parseInt(rawItem.quantity, 10);
    if (!rawItem.id || !rawItem.name || !Number.isFinite(price) || price < 0) {
      return null;
    }
    return {
      id: String(rawItem.id),
      name: String(rawItem.name),
      category: rawItem.category ? String(rawItem.category) : 'Bakery Fresh',
      price: price,
      quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
      image: resolveImagePath(rawItem.image)
    };
  }

  /**
   * Load cart items from localStorage; pre-populate sample items if empty/uninitialized.
   */
  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CART);
      if (raw === null || raw.trim() === '') {
        const seeded = cloneSampleItems();
        saveCart(seeded);
        return seeded;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        const seeded = cloneSampleItems();
        saveCart(seeded);
        return seeded;
      }

      return parsed.map(normalizeItem).filter(Boolean);
    } catch (error) {
      const seeded = cloneSampleItems();
      saveCart(seeded);
      return seeded;
    }
  }

  function saveCart(items) {
    try {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(items));
    } catch (error) {
      // Ignore storage quota errors in restricted environments
    }
  }

  function loadPromo() {
    try {
      const savedCode = localStorage.getItem(STORAGE_KEYS.PROMO);
      if (savedCode && PROMO_CODES[savedCode.toUpperCase()]) {
        return savedCode.toUpperCase();
      }
    } catch (error) {
      // Ignore storage read errors
    }
    return null;
  }

  function savePromo(code) {
    try {
      if (code) {
        localStorage.setItem(STORAGE_KEYS.PROMO, code);
      } else {
        localStorage.removeItem(STORAGE_KEYS.PROMO);
      }
    } catch (error) {
      // Ignore storage write errors
    }
  }

  /**
   * Calculate order totals in PKR.
   */
  function calculateSummary() {
    const subtotal = cart.reduce(function (sum, item) {
      return sum + item.price * item.quantity;
    }, 0);

    const promo = activePromoCode ? PROMO_CODES[activePromoCode] : null;
    const discount = promo && subtotal > 0 ? Math.round(subtotal * promo.rate) : 0;

    let deliveryFee = 0;
    if (subtotal > 0) {
      deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    }

    const grandTotal = Math.max(0, subtotal - discount + deliveryFee);

    return {
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      discount: discount,
      promoCode: promo ? promo.code : null,
      grandTotal: grandTotal
    };
  }

  function saveSummarySnapshot(summary) {
    try {
      localStorage.setItem(STORAGE_KEYS.SUMMARY, JSON.stringify(summary));
    } catch (error) {
      // Ignore storage write errors
    }
  }

  function showPromoFeedback(message, isSuccess, showRemove) {
    dom.promoFeedback.classList.remove('d-none', 'is-success', 'is-error');
    dom.promoFeedback.classList.add('d-flex', isSuccess ? 'is-success' : 'is-error');
    dom.promoFeedbackText.textContent = message;
    dom.removePromoBtn.classList.toggle('d-none', !showRemove);
  }

  function hidePromoFeedback() {
    dom.promoFeedback.classList.add('d-none');
    dom.promoFeedback.classList.remove('d-flex', 'is-success', 'is-error');
    dom.promoFeedbackText.textContent = '';
    dom.removePromoBtn.classList.add('d-none');
  }

  function renderCartRows() {
    if (cart.length === 0) {
      dom.tableBody.innerHTML = '';
      dom.tableWrapper.classList.add('d-none');
      dom.emptyState.classList.remove('d-none');
      dom.clearCartBtn.classList.add('d-none');
      return;
    }

    dom.tableWrapper.classList.remove('d-none');
    dom.emptyState.classList.add('d-none');
    dom.clearCartBtn.classList.remove('d-none');

    const rowsHtml = cart
      .map(function (item) {
        const lineSubtotal = item.price * item.quantity;
        const safeId = escapeHtml(item.id);
        const safeName = escapeHtml(item.name);
        const safeCategory = escapeHtml(item.category);
        const safeImage = escapeHtml(resolveImagePath(item.image));

        return (
          '<tr data-item-id="' + safeId + '">' +
            '<td>' +
              '<div class="d-flex align-items-center gap-3">' +
                '<img src="' + safeImage + '" alt="' + safeName + '" class="cc-item-thumb">' +
                '<div>' +
                  '<div class="cc-item-name">' + safeName + '</div>' +
                  '<span class="cc-category-tag">' + safeCategory + '</span>' +
                '</div>' +
              '</div>' +
            '</td>' +
            '<td class="text-end fw-medium tabular-nums text-nowrap">' +
              formatPKR(item.price) +
            '</td>' +
            '<td class="text-center">' +
              '<div class="cc-qty-control" role="group" aria-label="Quantity for ' + safeName + '">' +
                '<button type="button" class="cc-qty-btn" data-action="decrease" data-id="' + safeId + '" aria-label="Decrease quantity of ' + safeName + '"' + (item.quantity <= 1 ? ' disabled' : '') + '>' +
                  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/></svg>' +
                '</button>' +
                '<span class="cc-qty-value tabular-nums">' + item.quantity + '</span>' +
                '<button type="button" class="cc-qty-btn" data-action="increase" data-id="' + safeId + '" aria-label="Increase quantity of ' + safeName + '">' +
                  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
                '</button>' +
              '</div>' +
            '</td>' +
            '<td class="text-end fw-bold tabular-nums text-nowrap">' +
              formatPKR(lineSubtotal) +
            '</td>' +
            '<td class="text-center">' +
              '<button type="button" class="cc-remove-btn" data-action="remove" data-id="' + safeId + '" aria-label="Remove ' + safeName + ' from cart" title="Remove item">' +
                '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M3 6h18"/>' +
                  '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
                  '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
                  '<line x1="10" y1="11" x2="10" y2="17"/>' +
                  '<line x1="14" y1="11" x2="14" y2="17"/>' +
                '</svg>' +
              '</button>' +
            '</td>' +
          '</tr>'
        );
      })
      .join('');

    dom.tableBody.innerHTML = rowsHtml;
  }

  function renderSummary() {
    const totalCount = cart.reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);

    if (dom.navBadge) {
      dom.navBadge.textContent = String(totalCount);
      dom.navBadge.classList.toggle('is-empty', totalCount === 0);
    }
    dom.itemCountLabel.textContent = totalCount + (totalCount === 1 ? ' item' : ' items');

    const summary = calculateSummary();
    saveSummarySnapshot(summary);

    dom.summarySubtotal.textContent = formatPKR(summary.subtotal);

    if (summary.subtotal === 0) {
      dom.summaryDelivery.textContent = formatPKR(0);
      dom.deliveryNote.textContent =
        'Add bakery items to your basket. Free delivery on orders of ' + formatPKR(FREE_DELIVERY_THRESHOLD) + ' or more.';
    } else if (summary.deliveryFee === 0) {
      dom.summaryDelivery.textContent = 'FREE';
      dom.deliveryNote.textContent =
        'You unlocked free local bakery delivery (orders ' + formatPKR(FREE_DELIVERY_THRESHOLD) + '+).';
    } else {
      dom.summaryDelivery.textContent = formatPKR(summary.deliveryFee);
      const remaining = FREE_DELIVERY_THRESHOLD - summary.subtotal;
      dom.deliveryNote.textContent =
        'Add ' + formatPKR(remaining) + ' more for free delivery (standard fee ' + formatPKR(DELIVERY_FEE) + ').';
    }

    if (summary.discount > 0 && summary.promoCode) {
      dom.summaryDiscount.textContent = '- ' + formatPKR(summary.discount);
      dom.discountCodeLabel.textContent = '(' + summary.promoCode + ')';
    } else {
      dom.summaryDiscount.textContent = formatPKR(0);
      dom.discountCodeLabel.textContent = '';
    }

    dom.summaryTotal.textContent = formatPKR(summary.grandTotal);
    dom.checkoutBtn.disabled = cart.length === 0;
  }

  function renderAll() {
    renderCartRows();
    renderSummary();
  }

  function updateQuantity(itemId, delta) {
    const target = cart.find(function (item) {
      return item.id === itemId;
    });
    if (!target) {
      return;
    }
    const nextQuantity = target.quantity + delta;
    if (nextQuantity < 1) {
      return;
    }
    target.quantity = nextQuantity;
    saveCart(cart);
    renderAll();
  }

  function removeItem(itemId) {
    cart = cart.filter(function (item) {
      return item.id !== itemId;
    });
    saveCart(cart);
    renderAll();
  }

  function applyPromoCode(rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();

    if (!code) {
      showPromoFeedback('Please enter a promo code.', false, false);
      return;
    }

    const promo = PROMO_CODES[code];
    if (!promo) {
      showPromoFeedback('Code "' + code + '" is invalid. Try CRUMB10.', false, Boolean(activePromoCode));
      return;
    }

    activePromoCode = promo.code;
    savePromo(activePromoCode);
    dom.promoInput.value = activePromoCode;
    showPromoFeedback(promo.code + ' applied: ' + promo.description + '.', true, true);
    renderSummary();
  }

  function clearPromoCode() {
    activePromoCode = null;
    savePromo(null);
    dom.promoInput.value = '';
    hidePromoFeedback();
    renderSummary();
  }

  function bindEvents() {
    if (dom.menuToggle && dom.mobileNav) {
      dom.menuToggle.addEventListener('click', function () {
        const isOpen = dom.mobileNav.classList.toggle('is-open');
        dom.menuToggle.setAttribute('aria-expanded', String(isOpen));
      });
    }

    dom.tableBody.addEventListener('click', function (event) {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }

      const action = button.dataset.action;
      const itemId = button.dataset.id;

      if (action === 'increase') {
        updateQuantity(itemId, 1);
      } else if (action === 'decrease') {
        updateQuantity(itemId, -1);
      } else if (action === 'remove') {
        removeItem(itemId);
      }
    });

    dom.clearCartBtn.addEventListener('click', function () {
      cart = [];
      saveCart(cart);
      renderAll();
    });

    dom.restoreSampleBtn.addEventListener('click', function () {
      cart = cloneSampleItems();
      saveCart(cart);
      renderAll();
    });

    dom.promoForm.addEventListener('submit', function (event) {
      event.preventDefault();
      applyPromoCode(dom.promoInput.value);
    });

    dom.removePromoBtn.addEventListener('click', function () {
      clearPromoCode();
    });

    // Allow clicking suggested promo chips to fill and apply immediately
    document.querySelectorAll('[data-promo-fill]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        const code = chip.getAttribute('data-promo-fill');
        dom.promoInput.value = code;
        applyPromoCode(code);
      });
    });

    dom.checkoutBtn.addEventListener('click', function () {
      if (cart.length === 0) {
        return;
      }
      saveSummarySnapshot(calculateSummary());
      window.location.href = 'checkout.html';
    });
  }

  function init() {
    cart = loadCart();
    activePromoCode = loadPromo();

    if (activePromoCode && PROMO_CODES[activePromoCode]) {
      const promo = PROMO_CODES[activePromoCode];
      dom.promoInput.value = promo.code;
      showPromoFeedback(promo.code + ' applied: ' + promo.description + '.', true, true);
    }

    bindEvents();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
