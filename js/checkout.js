(function () {
  'use strict';

  const STORAGE_KEYS = {
    CART: 'crumbAndCo_cart',
    PROMO: 'crumbAndCo_promo',
    SUMMARY: 'crumbAndCo_orderSummary',
    ORDERS: 'crumbAndCo_orders'
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

  const PROMO_RATES = {
    CRUMB10: 0.1,
    SWEET15: 0.15
  };

  const dom = {
    navCartBadge: document.getElementById('cart-badge'),
    menuToggle: document.getElementById('menu-toggle'),
    mobileNav: document.getElementById('mobile-nav'),
    emptyAlert: document.getElementById('emptyCheckoutAlert'),
    checkoutGrid: document.getElementById('checkoutGrid'),
    checkoutForm: document.getElementById('checkoutForm'),
    formAlert: document.getElementById('formAlert'),
    itemsList: document.getElementById('checkoutItemsList'),
    summarySubtotal: document.getElementById('summarySubtotal'),
    summaryDelivery: document.getElementById('summaryDelivery'),
    summaryDiscount: document.getElementById('summaryDiscount'),
    discountCodeLabel: document.getElementById('discountCodeLabel'),
    summaryTotal: document.getElementById('summaryTotal'),
    placeOrderBtn: document.getElementById('placeOrderBtn'),
    paymentRadios: document.querySelectorAll('input[name="paymentMethod"]'),
    paymentOptions: document.querySelectorAll('.cc-payment-option'),
    cardDetailsSection: document.getElementById('cardDetailsSection'),
    fullName: document.getElementById('fullName'),
    phone: document.getElementById('phone'),
    email: document.getElementById('email'),
    city: document.getElementById('city'),
    address: document.getElementById('address'),
    deliveryNotes: document.getElementById('deliveryNotes'),
    cardName: document.getElementById('cardName'),
    cardNumber: document.getElementById('cardNumber'),
    cardExpiry: document.getElementById('cardExpiry'),
    cardCvv: document.getElementById('cardCvv')
  };

  let cart = [];
  let orderSummary = {
    subtotal: 0,
    deliveryFee: 0,
    discount: 0,
    promoCode: null,
    grandTotal: 0
  };

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

  function formatPKR(amount) {
    const rounded = Math.round(Number(amount) || 0);
    return 'PKR ' + rounded.toLocaleString('en-US');
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readStorageJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      const parsed = JSON.parse(raw);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function loadCartItems() {
    const parsed = readStorageJson(STORAGE_KEYS.CART, []);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(function (item) {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const price = Number(item.price);
        const quantity = parseInt(item.quantity, 10);
        if (!item.id || !item.name || !Number.isFinite(price) || price < 0) {
          return null;
        }
        return {
          id: String(item.id),
          name: String(item.name),
          category: item.category ? String(item.category) : 'Bakery Fresh',
          price: price,
          quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
          image: resolveImagePath(item.image)
        };
      })
      .filter(Boolean);
  }

  function computeSummaryFromCart(items) {
    const subtotal = items.reduce(function (sum, item) {
      return sum + item.price * item.quantity;
    }, 0);

    let promoCode = null;
    try {
      const storedPromo = localStorage.getItem(STORAGE_KEYS.PROMO);
      if (storedPromo && PROMO_RATES[storedPromo.toUpperCase()]) {
        promoCode = storedPromo.toUpperCase();
      }
    } catch (error) {
      // Ignore storage errors
    }

    const discount = promoCode && subtotal > 0 ? Math.round(subtotal * PROMO_RATES[promoCode]) : 0;
    const deliveryFee = subtotal > 0 ? (subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE) : 0;
    const grandTotal = Math.max(0, subtotal - discount + deliveryFee);

    return {
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      discount: discount,
      promoCode: promoCode,
      grandTotal: grandTotal
    };
  }

  function loadOrderSummary(items) {
    const stored = readStorageJson(STORAGE_KEYS.SUMMARY, null);
    const computed = computeSummaryFromCart(items);

    if (
      stored &&
      typeof stored === 'object' &&
      Number.isFinite(Number(stored.subtotal)) &&
      Math.round(Number(stored.subtotal)) === Math.round(computed.subtotal)
    ) {
      return {
        subtotal: Math.round(Number(stored.subtotal)),
        deliveryFee: Number.isFinite(Number(stored.deliveryFee)) ? Math.round(Number(stored.deliveryFee)) : computed.deliveryFee,
        discount: Number.isFinite(Number(stored.discount)) ? Math.round(Number(stored.discount)) : computed.discount,
        promoCode: stored.promoCode ? String(stored.promoCode) : null,
        grandTotal: Number.isFinite(Number(stored.grandTotal)) ? Math.round(Number(stored.grandTotal)) : computed.grandTotal
      };
    }

    return computed;
  }

  function renderOrderSummary() {
    const totalCount = cart.reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
    if (dom.navCartBadge) {
      dom.navCartBadge.textContent = String(totalCount);
      dom.navCartBadge.classList.toggle('is-empty', totalCount === 0);
    }

    if (cart.length === 0) {
      dom.emptyAlert.classList.remove('d-none');
      dom.checkoutGrid.classList.add('d-none');
      dom.placeOrderBtn.disabled = true;
      return;
    }

    dom.emptyAlert.classList.add('d-none');
    dom.checkoutGrid.classList.remove('d-none');
    dom.placeOrderBtn.disabled = false;

    dom.itemsList.innerHTML = cart
      .map(function (item) {
        const lineSubtotal = item.price * item.quantity;
        const safeName = escapeHtml(item.name);
        const safeCategory = escapeHtml(item.category);
        const safeImage = escapeHtml(resolveImagePath(item.image));

        return (
          '<div class="cc-checkout-item">' +
            '<div class="d-flex align-items-center gap-2 min-w-0">' +
              '<img src="' + safeImage + '" alt="' + safeName + '" class="cc-checkout-thumb">' +
              '<div class="min-w-0">' +
                '<div class="fw-semibold text-truncate">' + safeName + '</div>' +
                '<div class="small text-muted">' + safeCategory + ' &bull; Qty ' + item.quantity + '</div>' +
              '</div>' +
            '</div>' +
            '<span class="fw-bold tabular-nums text-nowrap">' + formatPKR(lineSubtotal) + '</span>' +
          '</div>'
        );
      })
      .join('');

    dom.summarySubtotal.textContent = formatPKR(orderSummary.subtotal);
    dom.summaryDelivery.textContent =
      orderSummary.deliveryFee === 0 ? 'FREE' : formatPKR(orderSummary.deliveryFee);

    if (orderSummary.discount > 0 && orderSummary.promoCode) {
      dom.summaryDiscount.textContent = '- ' + formatPKR(orderSummary.discount);
      dom.discountCodeLabel.textContent = '(' + orderSummary.promoCode + ')';
    } else {
      dom.summaryDiscount.textContent = formatPKR(0);
      dom.discountCodeLabel.textContent = '';
    }

    dom.summaryTotal.textContent = formatPKR(orderSummary.grandTotal);
  }

  function getSelectedPaymentMethod() {
    const selected = document.querySelector('input[name="paymentMethod"]:checked');
    return selected ? selected.value : 'cod';
  }

  function updatePaymentUI() {
    const method = getSelectedPaymentMethod();
    const isOnline = method === 'online';

    dom.paymentOptions.forEach(function (option) {
      const radio = option.querySelector('input[type="radio"]');
      option.classList.toggle('is-selected', Boolean(radio && radio.checked));
    });

    dom.cardDetailsSection.classList.toggle('d-none', !isOnline);

    [dom.cardName, dom.cardNumber, dom.cardExpiry, dom.cardCvv].forEach(function (field) {
      field.required = isOnline;
      if (!isOnline) {
        field.classList.remove('is-invalid', 'is-valid');
      }
    });
  }

  function setFieldValidity(field, isValid) {
    field.classList.toggle('is-invalid', !isValid);
    field.classList.toggle('is-valid', isValid);
    return isValid;
  }

  function validateExpiry(value) {
    const match = /^(\d{2})\/(\d{2})$/.exec(value.trim());
    if (!match) {
      return false;
    }
    const month = parseInt(match[1], 10);
    const year = 2000 + parseInt(match[2], 10);
    if (month < 1 || month > 12) {
      return false;
    }
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    return year > currentYear || (year === currentYear && month >= currentMonth);
  }

  function validateField(field) {
    const value = field.value.trim();

    switch (field.id) {
      case 'fullName':
        return setFieldValidity(field, value.length >= 2);
      case 'phone': {
        const digits = value.replace(/\D/g, '');
        return setFieldValidity(field, digits.length >= 10 && digits.length <= 15);
      }
      case 'email':
        return setFieldValidity(field, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value));
      case 'city':
        return setFieldValidity(field, value.length >= 2);
      case 'address':
        return setFieldValidity(field, value.length >= 5);
      case 'cardName':
        return getSelectedPaymentMethod() !== 'online' || setFieldValidity(field, value.length >= 2);
      case 'cardNumber': {
        if (getSelectedPaymentMethod() !== 'online') {
          return true;
        }
        const digits = value.replace(/\s+/g, '');
        return setFieldValidity(field, /^\d{16}$/.test(digits));
      }
      case 'cardExpiry':
        return getSelectedPaymentMethod() !== 'online' || setFieldValidity(field, validateExpiry(value));
      case 'cardCvv':
        return getSelectedPaymentMethod() !== 'online' || setFieldValidity(field, /^\d{3,4}$/.test(value));
      default:
        return true;
    }
  }

  function validateCheckoutForm() {
    const requiredFields = [
      dom.fullName,
      dom.phone,
      dom.email,
      dom.city,
      dom.address
    ];

    if (getSelectedPaymentMethod() === 'online') {
      requiredFields.push(dom.cardName, dom.cardNumber, dom.cardExpiry, dom.cardCvv);
    }

    let firstInvalid = null;
    let allValid = true;

    requiredFields.forEach(function (field) {
      const ok = validateField(field);
      if (!ok) {
        allValid = false;
        if (!firstInvalid) {
          firstInvalid = field;
        }
      }
    });

    dom.formAlert.classList.toggle('d-none', allValid);
    if (firstInvalid) {
      firstInvalid.focus();
    }

    return allValid;
  }

  function generateOrderId(existingOrders) {
    const year = new Date().getFullYear();
    const existingIds = new Set(
      existingOrders.map(function (order) {
        return order && order.orderId ? order.orderId : '';
      })
    );

    let candidate = '';
    let attempts = 0;
    do {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      candidate = 'CC-' + year + '-' + randomNum;
      attempts += 1;
    } while (existingIds.has(candidate) && attempts < 25);

    if (existingIds.has(candidate)) {
      candidate = 'CC-' + year + '-' + String(Date.now()).slice(-4);
    }
    return candidate;
  }

  function saveOrderAndClearCart() {
    const existingOrders = readStorageJson(STORAGE_KEYS.ORDERS, []);
    const ordersList = Array.isArray(existingOrders) ? existingOrders : [];
    const orderId = generateOrderId(ordersList);
    const paymentMethod = getSelectedPaymentMethod();
    const rawCardDigits = dom.cardNumber.value.replace(/\D/g, '');

    const newOrder = {
      orderId: orderId,
      createdAt: new Date().toISOString(),
      status: 'Order Confirmed',
      customer: {
        fullName: dom.fullName.value.trim(),
        phone: dom.phone.value.trim(),
        email: dom.email.value.trim(),
        address: dom.address.value.trim(),
        city: dom.city.value.trim(),
        deliveryNotes: dom.deliveryNotes.value.trim()
      },
      payment: {
        method: paymentMethod,
        methodLabel: paymentMethod === 'online' ? 'Online Card / Bank Transfer' : 'Cash on Delivery',
        cardLast4: paymentMethod === 'online' && rawCardDigits.length >= 4 ? rawCardDigits.slice(-4) : null
      },
      items: cart.map(function (item) {
        return Object.assign({}, item);
      }),
      summary: Object.assign({}, orderSummary)
    };

    ordersList.push(newOrder);

    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(ordersList));
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
      localStorage.removeItem(STORAGE_KEYS.PROMO);
      localStorage.removeItem(STORAGE_KEYS.SUMMARY);
    } catch (error) {
      // Ignore storage errors if quota is restricted
    }

    return orderId;
  }

  function formatCardInputs() {
    dom.cardNumber.addEventListener('input', function () {
      const digits = dom.cardNumber.value.replace(/\D/g, '').slice(0, 16);
      dom.cardNumber.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
      if (dom.cardNumber.classList.contains('is-invalid') || dom.cardNumber.classList.contains('is-valid')) {
        validateField(dom.cardNumber);
      }
    });

    dom.cardExpiry.addEventListener('input', function () {
      const digits = dom.cardExpiry.value.replace(/\D/g, '').slice(0, 4);
      dom.cardExpiry.value = digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
      if (dom.cardExpiry.classList.contains('is-invalid') || dom.cardExpiry.classList.contains('is-valid')) {
        validateField(dom.cardExpiry);
      }
    });

    dom.cardCvv.addEventListener('input', function () {
      dom.cardCvv.value = dom.cardCvv.value.replace(/\D/g, '').slice(0, 4);
      if (dom.cardCvv.classList.contains('is-invalid') || dom.cardCvv.classList.contains('is-valid')) {
        validateField(dom.cardCvv);
      }
    });
  }

  function bindEvents() {
    if (dom.menuToggle && dom.mobileNav) {
      dom.menuToggle.addEventListener('click', function () {
        const isOpen = dom.mobileNav.classList.toggle('is-open');
        dom.menuToggle.setAttribute('aria-expanded', String(isOpen));
      });
    }

    dom.paymentRadios.forEach(function (radio) {
      radio.addEventListener('change', updatePaymentUI);
    });

    const validatedFields = [
      dom.fullName,
      dom.phone,
      dom.email,
      dom.city,
      dom.address,
      dom.cardName,
      dom.cardNumber,
      dom.cardExpiry,
      dom.cardCvv
    ];

    validatedFields.forEach(function (field) {
      field.addEventListener('blur', function () {
        if (field.required || field.value.trim() !== '') {
          validateField(field);
        }
      });
      field.addEventListener('input', function () {
        if (field.classList.contains('is-invalid') || field.classList.contains('is-valid')) {
          validateField(field);
        }
      });
    });

    formatCardInputs();

    dom.checkoutForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (cart.length === 0) {
        renderOrderSummary();
        return;
      }

      if (!validateCheckoutForm()) {
        return;
      }

      const orderId = saveOrderAndClearCart();
      window.location.href = 'track-order.html?orderId=' + encodeURIComponent(orderId);
    });
  }

  function init() {
    cart = loadCartItems();
    orderSummary = loadOrderSummary(cart);
    updatePaymentUI();
    renderOrderSummary();
    bindEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
