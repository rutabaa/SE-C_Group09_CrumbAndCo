(function () {
  'use strict';

  const STORAGE_KEYS = {
    CART: 'crumbAndCo_cart',
    ORDERS: 'crumbAndCo_orders'
  };

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

  const ORDER_STEPS = [
    {
      label: 'Order Placed',
      etaText: '35-50 mins remaining',
      etaDetail: 'Your order is confirmed and queued in our bakery kitchen.'
    },
    {
      label: 'Baking in Oven',
      etaText: '25-35 mins remaining',
      etaDetail: 'Our bakers are preparing and warm-packing your items now.'
    },
    {
      label: 'Out for Delivery',
      etaText: '10-15 mins remaining',
      etaDetail: 'Your Crumb & Co rider is on the way to your delivery address.'
    },
    {
      label: 'Delivered',
      etaText: 'Delivered',
      etaDetail: 'Order completed. Enjoy your freshly baked treats!'
    }
  ];

  const dom = {
    navCartBadge: document.getElementById('cart-badge'),
    menuToggle: document.getElementById('menu-toggle'),
    mobileNav: document.getElementById('mobile-nav'),
    trackSearchForm: document.getElementById('trackSearchForm'),
    orderSearchInput: document.getElementById('orderSearchInput'),
    searchFeedback: document.getElementById('searchFeedback'),
    recentOrdersBar: document.getElementById('recentOrdersBar'),
    recentOrdersChips: document.getElementById('recentOrdersChips'),
    emptyTrackState: document.getElementById('emptyTrackState'),
    loadSampleOrderBtn: document.getElementById('loadSampleOrderBtn'),
    orderDetailsContainer: document.getElementById('orderDetailsContainer'),
    displayOrderId: document.getElementById('displayOrderId'),
    displayPlacedAt: document.getElementById('displayPlacedAt'),
    displayStatusBadge: document.getElementById('displayStatusBadge'),
    displayStatusText: document.getElementById('displayStatusText'),
    displayEtaBadge: document.getElementById('displayEtaBadge'),
    stepperFill: document.getElementById('stepperFill'),
    stepNodes: document.querySelectorAll('.cc-step'),
    simulateStatusBtn: document.getElementById('simulateStatusBtn'),
    resetStatusBtn: document.getElementById('resetStatusBtn'),
    orderItemCountBadge: document.getElementById('orderItemCountBadge'),
    orderItemsList: document.getElementById('orderItemsList'),
    summarySubtotal: document.getElementById('summarySubtotal'),
    summaryDelivery: document.getElementById('summaryDelivery'),
    summaryDiscount: document.getElementById('summaryDiscount'),
    discountCodeLabel: document.getElementById('discountCodeLabel'),
    summaryTotal: document.getElementById('summaryTotal'),
    customerName: document.getElementById('customerName'),
    customerPhone: document.getElementById('customerPhone'),
    customerEmail: document.getElementById('customerEmail'),
    customerAddress: document.getElementById('customerAddress'),
    customerCity: document.getElementById('customerCity'),
    customerNotes: document.getElementById('customerNotes'),
    paymentMethod: document.getElementById('paymentMethod'),
    estimatedDeliveryDetail: document.getElementById('estimatedDeliveryDetail')
  };

  let orders = [];
  let activeOrderId = null;

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

  function saveOrders(list) {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(list));
    } catch (error) {
      // Ignore storage write errors in restricted environments
    }
  }

  function updateNavCartBadge() {
    if (!dom.navCartBadge) {
      return;
    }
    const cart = readStorageJson(STORAGE_KEYS.CART, []);
    if (!Array.isArray(cart)) {
      dom.navCartBadge.textContent = '0';
      dom.navCartBadge.classList.add('is-empty');
      return;
    }
    const totalCount = cart.reduce(function (sum, item) {
      const qty = parseInt(item && item.quantity, 10);
      return sum + (Number.isInteger(qty) && qty > 0 ? qty : 0);
    }, 0);
    dom.navCartBadge.textContent = String(totalCount);
    dom.navCartBadge.classList.toggle('is-empty', totalCount === 0);
  }

  function resolveStepIndex(order) {
    if (!order) {
      return 0;
    }
    if (Number.isInteger(order.statusIndex) && order.statusIndex >= 0 && order.statusIndex < ORDER_STEPS.length) {
      return order.statusIndex;
    }

    const rawStatus = String(order.status || '').trim().toLowerCase();
    if (rawStatus === 'baking in oven') {
      return 1;
    }
    if (rawStatus === 'out for delivery') {
      return 2;
    }
    if (rawStatus === 'delivered') {
      return 3;
    }
    // Maps both 'Order Confirmed' (from checkout.js) and 'Order Placed' to step 0
    return 0;
  }

  function formatDateTime(isoString) {
    const date = isoString ? new Date(isoString) : new Date();
    if (Number.isNaN(date.getTime())) {
      return 'Just now';
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function formatEtaWindow(isoString, stepIndex) {
    const step = ORDER_STEPS[stepIndex] || ORDER_STEPS[0];
    if (stepIndex >= ORDER_STEPS.length - 1) {
      return step.etaDetail;
    }

    const created = isoString ? new Date(isoString) : new Date();
    if (Number.isNaN(created.getTime())) {
      return step.etaDetail;
    }

    const minArrival = new Date(created.getTime() + 35 * 60000);
    const maxArrival = new Date(created.getTime() + 50 * 60000);
    const timeOptions = { hour: 'numeric', minute: '2-digit' };
    const windowStr =
      minArrival.toLocaleTimeString('en-US', timeOptions) +
      ' - ' +
      maxArrival.toLocaleTimeString('en-US', timeOptions);

    return 'Est. arrival ' + windowStr + ' (' + step.etaText + '). ' + step.etaDetail;
  }

  function showSearchFeedback(message) {
    dom.searchFeedback.textContent = message;
    dom.searchFeedback.classList.remove('d-none');
  }

  function hideSearchFeedback() {
    dom.searchFeedback.textContent = '';
    dom.searchFeedback.classList.add('d-none');
  }

  function findOrderById(orderId) {
    const target = String(orderId || '').trim().toLowerCase();
    if (!target) {
      return null;
    }
    return (
      orders.find(function (order) {
        return order && String(order.orderId || '').toLowerCase() === target;
      }) || null
    );
  }

  function getLatestOrder() {
    if (orders.length === 0) {
      return null;
    }
    return orders[orders.length - 1];
  }

  function renderRecentOrders() {
    if (orders.length === 0) {
      dom.recentOrdersBar.classList.add('d-none');
      dom.recentOrdersChips.innerHTML = '';
      return;
    }

    const recent = orders.slice(-5).reverse();
    dom.recentOrdersBar.classList.remove('d-none');
    dom.recentOrdersChips.innerHTML = recent
      .map(function (order) {
        const id = String(order.orderId || '');
        const isActive = activeOrderId && id.toLowerCase() === activeOrderId.toLowerCase();
        return (
          '<button type="button" class="cc-recent-chip' + (isActive ? ' is-active' : '') + '" data-order-id="' + escapeHtml(id) + '">' +
            escapeHtml(id) +
          '</button>'
        );
      })
      .join('');
  }

  function renderStepper(stepIndex) {
    const progressPercent = (stepIndex / (ORDER_STEPS.length - 1)) * 100;
    dom.stepperFill.style.setProperty('--cc-step-progress', progressPercent + '%');

    dom.stepNodes.forEach(function (node) {
      const idx = parseInt(node.getAttribute('data-step-index'), 10);
      node.classList.remove('is-completed', 'is-current', 'is-upcoming', 'is-final');

      if (idx < stepIndex) {
        node.classList.add('is-completed');
      } else if (idx === stepIndex) {
        node.classList.add('is-current');
        if (stepIndex === ORDER_STEPS.length - 1) {
          node.classList.add('is-final');
        }
      } else {
        node.classList.add('is-upcoming');
      }
    });
  }

  function renderOrder(order) {
    if (!order) {
      dom.orderDetailsContainer.classList.add('d-none');
      dom.emptyTrackState.classList.toggle('d-none', orders.length > 0);
      renderRecentOrders();
      return;
    }

    activeOrderId = order.orderId;
    dom.emptyTrackState.classList.add('d-none');
    dom.orderDetailsContainer.classList.remove('d-none');
    dom.orderSearchInput.value = order.orderId;

    const stepIndex = resolveStepIndex(order);
    const currentStep = ORDER_STEPS[stepIndex] || ORDER_STEPS[0];
    const isDelivered = stepIndex === ORDER_STEPS.length - 1;

    dom.displayOrderId.textContent = order.orderId;
    dom.displayPlacedAt.textContent = 'Placed on ' + formatDateTime(order.createdAt);
    dom.displayStatusText.textContent = currentStep.label;
    dom.displayStatusBadge.classList.toggle('is-delivered', isDelivered);
    dom.displayEtaBadge.textContent = isDelivered
      ? 'Completed - Delivered'
      : 'Estimated delivery: ' + currentStep.etaText;

    renderStepper(stepIndex);

    dom.simulateStatusBtn.disabled = isDelivered;
    dom.simulateStatusBtn.textContent = isDelivered
      ? 'Order Delivered'
      : 'Simulate Next Status ->';
    dom.resetStatusBtn.disabled = stepIndex === 0;

    // Itemized items
    const items = Array.isArray(order.items) ? order.items : [];
    const totalCount = items.reduce(function (sum, item) {
      return sum + (parseInt(item.quantity, 10) || 1);
    }, 0);
    dom.orderItemCountBadge.textContent = totalCount + (totalCount === 1 ? ' item' : ' items');

    dom.orderItemsList.innerHTML = items
      .map(function (item) {
        const qty = parseInt(item.quantity, 10) || 1;
        const price = Number(item.price) || 0;
        const lineSubtotal = price * qty;
        const safeName = escapeHtml(item.name || 'Bakery Item');
        const safeCategory = escapeHtml(item.category || 'Bakery Fresh');
        const safeImage = escapeHtml(resolveImagePath(item.image));

        return (
          '<div class="cc-checkout-item">' +
            '<div class="d-flex align-items-center gap-2 min-w-0">' +
              '<img src="' + safeImage + '" alt="' + safeName + '" class="cc-checkout-thumb">' +
              '<div class="min-w-0">' +
                '<div class="fw-semibold text-truncate">' + safeName + '</div>' +
                '<div class="small text-muted">' +
                  safeCategory + ' &bull; ' + formatPKR(price) + ' &times; ' + qty +
                '</div>' +
              '</div>' +
            '</div>' +
            '<span class="fw-bold tabular-nums text-nowrap">' + formatPKR(lineSubtotal) + '</span>' +
          '</div>'
        );
      })
      .join('');

    // Totals summary
    const summary = order.summary || {};
    const subtotal = Number(summary.subtotal) || items.reduce(function (sum, item) {
      return sum + (Number(item.price) || 0) * (parseInt(item.quantity, 10) || 1);
    }, 0);
    const deliveryFee = Number.isFinite(Number(summary.deliveryFee)) ? Number(summary.deliveryFee) : 0;
    const discount = Number.isFinite(Number(summary.discount)) ? Number(summary.discount) : 0;
    const promoCode = summary.promoCode ? String(summary.promoCode) : '';
    const grandTotal = Number.isFinite(Number(summary.grandTotal))
      ? Number(summary.grandTotal)
      : Math.max(0, subtotal - discount + deliveryFee);

    dom.summarySubtotal.textContent = formatPKR(subtotal);
    dom.summaryDelivery.textContent = deliveryFee === 0 ? 'FREE' : formatPKR(deliveryFee);

    if (discount > 0 && promoCode) {
      dom.summaryDiscount.textContent = '- ' + formatPKR(discount);
      dom.discountCodeLabel.textContent = '(' + promoCode + ')';
    } else if (discount > 0) {
      dom.summaryDiscount.textContent = '- ' + formatPKR(discount);
      dom.discountCodeLabel.textContent = '';
    } else {
      dom.summaryDiscount.textContent = formatPKR(0);
      dom.discountCodeLabel.textContent = '';
    }

    dom.summaryTotal.textContent = formatPKR(grandTotal);

    // Customer delivery & payment info
    const customer = order.customer || {};
    const payment = order.payment || {};

    dom.customerName.textContent = customer.fullName || '-';
    dom.customerPhone.textContent = customer.phone || '-';
    dom.customerEmail.textContent = customer.email || '-';
    dom.customerAddress.textContent = customer.address || '-';
    dom.customerCity.textContent = customer.city || '-';
    dom.customerNotes.textContent = customer.deliveryNotes ? customer.deliveryNotes : 'None provided';

    let paymentText = payment.methodLabel || 'Cash on Delivery';
    if (payment.method === 'online' && payment.cardLast4) {
      paymentText += ' (•••• ' + payment.cardLast4 + ')';
    }
    dom.paymentMethod.textContent = paymentText;
    dom.estimatedDeliveryDetail.textContent = formatEtaWindow(order.createdAt, stepIndex);

    renderRecentOrders();
  }

  function updateUrlOrderId(orderId) {
    try {
      const url = new URL(window.location.href);
      if (orderId) {
        url.searchParams.set('orderId', orderId);
      } else {
        url.searchParams.delete('orderId');
      }
      window.history.replaceState({}, '', url.toString());
    } catch (error) {
      // Ignore history API restrictions on file:// URLs if any
    }
  }

  function selectOrder(orderId) {
    const found = findOrderById(orderId);
    if (!found) {
      showSearchFeedback('No order found with ID "' + String(orderId).trim() + '". Please check your Order ID and try again.');
      return false;
    }

    hideSearchFeedback();
    updateUrlOrderId(found.orderId);
    renderOrder(found);
    return true;
  }

  function setOrderStep(targetIndex) {
    const order = findOrderById(activeOrderId);
    if (!order) {
      return;
    }
    const clampedIndex = Math.max(0, Math.min(ORDER_STEPS.length - 1, targetIndex));
    order.statusIndex = clampedIndex;
    order.status = ORDER_STEPS[clampedIndex].label;
    order.statusUpdatedAt = new Date().toISOString();
    saveOrders(orders);
    renderOrder(order);
  }

  function createSampleOrder() {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const sampleId = 'CC-' + year + '-' + randomNum;

    return {
      orderId: sampleId,
      createdAt: new Date().toISOString(),
      status: ORDER_STEPS[0].label,
      statusIndex: 0,
      customer: {
        fullName: 'Ayesha Khan',
        phone: '0300-1234567',
        email: 'ayesha@example.com',
        address: 'House 14, Street 6, F-7/2',
        city: 'Islamabad',
        deliveryNotes: 'Call on arrival at the main gate'
      },
      payment: {
        method: 'cod',
        methodLabel: 'Cash on Delivery',
        cardLast4: null
      },
      items: [
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
        }
      ],
      summary: {
        subtotal: 3150,
        deliveryFee: 250,
        discount: 0,
        promoCode: null,
        grandTotal: 3400
      }
    };
  }

  function bindEvents() {
    if (dom.menuToggle && dom.mobileNav) {
      dom.menuToggle.addEventListener('click', function () {
        const isOpen = dom.mobileNav.classList.toggle('is-open');
        dom.menuToggle.setAttribute('aria-expanded', String(isOpen));
      });
    }

    dom.trackSearchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const query = dom.orderSearchInput.value.trim();

      if (!query) {
        showSearchFeedback('Please enter an Order ID (for example, CC-2026-4821).');
        dom.orderSearchInput.focus();
        return;
      }

      selectOrder(query);
    });

    dom.recentOrdersChips.addEventListener('click', function (event) {
      const chip = event.target.closest('button[data-order-id]');
      if (!chip) {
        return;
      }
      selectOrder(chip.getAttribute('data-order-id'));
    });

    dom.simulateStatusBtn.addEventListener('click', function () {
      const order = findOrderById(activeOrderId);
      if (!order) {
        return;
      }
      const current = resolveStepIndex(order);
      if (current < ORDER_STEPS.length - 1) {
        setOrderStep(current + 1);
      }
    });

    dom.resetStatusBtn.addEventListener('click', function () {
      setOrderStep(0);
    });

    dom.loadSampleOrderBtn.addEventListener('click', function () {
      const sample = createSampleOrder();
      orders.push(sample);
      saveOrders(orders);
      hideSearchFeedback();
      updateUrlOrderId(sample.orderId);
      renderOrder(sample);
    });
  }

  function init() {
    updateNavCartBadge();

    const storedOrders = readStorageJson(STORAGE_KEYS.ORDERS, []);
    orders = Array.isArray(storedOrders)
      ? storedOrders.filter(function (order) {
          return order && typeof order === 'object' && order.orderId;
        })
      : [];

    const params = new URLSearchParams(window.location.search);
    const urlOrderId = params.get('orderId');

    if (urlOrderId && urlOrderId.trim() !== '') {
      dom.orderSearchInput.value = urlOrderId.trim();
      const found = findOrderById(urlOrderId);
      if (found) {
        hideSearchFeedback();
        renderOrder(found);
      } else {
        showSearchFeedback('No order found with ID "' + urlOrderId.trim() + '".');
        const latest = getLatestOrder();
        if (latest) {
          renderOrder(latest);
          dom.orderSearchInput.value = urlOrderId.trim();
        } else {
          renderOrder(null);
        }
      }
    } else {
      const latest = getLatestOrder();
      renderOrder(latest);
    }

    bindEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
