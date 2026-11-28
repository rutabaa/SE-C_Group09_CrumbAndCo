/* ==========================================================================
   Crumb & Co. — Special Offers Page Logic
   Vanilla JavaScript: dynamic rendering, filtering, discount preview, localStorage
   ========================================================================== */

(function () {
  "use strict";

  const SAVED_OFFERS_KEY = "crumbAndCoSavedOffers";
  const SELECTED_OFFER_KEY = "crumbAndCoSelectedOffer";

  /**
   * Data source for Special Offers cards (no hardcoded offer cards in HTML).
   * Image and shopUrl paths are relative to pages/offers.html.
   */
  const SPECIAL_OFFERS = [
    {
      id: "offer-20-cakes",
      badge: "20% OFF",
      title: "Celebration Fudge & Berry Cakes",
      category: "Cakes",
      dealType: "percentage",
      discountPercent: 20,
      unitPrice: 4500,
      description:
        "Save 20% on handcrafted layered celebration cakes baked to order with Belgian cocoa and fresh cream.",
      code: "CAKE20",
      image: "../images/chocolate-fudge-cake.jpg",
      imageAlt:
        "Layered chocolate fudge cake coated in glossy ganache for the 20% off celebration cake offer",
      ctaLabel: "Shop Now",
      shopUrl: "../cakes.html",
      hasShopButton: true
    },
    {
      id: "offer-bogo-croissants",
      badge: "Buy 1 Get 1",
      title: "Morning Butter Croissants",
      category: "Pastries",
      dealType: "bogo",
      discountPercent: 0,
      unitPrice: 350,
      description:
        "Enjoy Buy 1 Get 1 Free on warm, flaky golden butter croissants from our 8:00 AM morning batch.",
      code: "BOGOAM",
      image: "../images/croissants.jpg",
      imageAlt:
        "Golden flaky French butter croissants stacked on a tray for the Buy 1 Get 1 morning offer",
      ctaLabel: "Shop Now",
      shopUrl: "../pastries.html",
      hasShopButton: false
    },
    {
      id: "offer-15-breads",
      badge: "15% OFF",
      title: "Artisan Sourdough & Loaf Box",
      category: "Breads",
      dealType: "percentage",
      discountPercent: 15,
      unitPrice: 1400,
      description:
        "Take 15% off our crusty country sourdough and soft sweet-loaf bundles baked fresh every morning.",
      code: "LOAF15",
      image: "../images/artisan-bread.jpg",
      imageAlt:
        "Crusty artisan sourdough loaves dusted with flour for the 15% off bread box offer",
      ctaLabel: "Shop Now",
      shopUrl: "../breads.html",
      hasShopButton: true
    }
  ];

  let activeFilter = "all";
  let searchQuery = "";
  let savedOfferIds = readSavedOfferIds();
  let selectedOfferId = readSelectedOfferId();
  let toastTimer = null;

  /* ------------------------------------------------------------------------
     Storage Helpers
     ------------------------------------------------------------------------ */

  function readSavedOfferIds() {
    try {
      const raw = localStorage.getItem(SAVED_OFFERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      const validIds = new Set(SPECIAL_OFFERS.map((offer) => offer.id));
      return parsed.filter((id) => validIds.has(id));
    } catch {
      return [];
    }
  }

  function writeSavedOfferIds(ids) {
    try {
      localStorage.setItem(SAVED_OFFERS_KEY, JSON.stringify(ids));
    } catch {
      // Ignore storage errors in restricted browser environments
    }
  }

  function readSelectedOfferId() {
    try {
      const saved = localStorage.getItem(SELECTED_OFFER_KEY);
      const exists = SPECIAL_OFFERS.some((offer) => offer.id === saved);
      return exists ? saved : SPECIAL_OFFERS[0].id;
    } catch {
      return SPECIAL_OFFERS[0].id;
    }
  }

  function writeSelectedOfferId(offerId) {
    try {
      localStorage.setItem(SELECTED_OFFER_KEY, offerId);
    } catch {
      // Ignore storage errors in restricted browser environments
    }
  }

  /* ------------------------------------------------------------------------
     Formatting & Calculation Helpers
     ------------------------------------------------------------------------ */

  function formatCurrency(amount) {
    return `Rs. ${Math.round(amount).toLocaleString("en-PK")}`;
  }

  function calculateOfferPreview(offer, quantity) {
    const qty = Math.max(1, Math.min(20, Number(quantity) || 1));

    if (offer.dealType === "bogo") {
      // Every 2nd unit is free; for qty=1, show 1 paid + 1 bonus unit value
      const freeUnits = qty === 1 ? 1 : Math.floor(qty / 2);
      const paidUnits = qty === 1 ? 1 : qty - freeUnits;
      const regularTotal = (paidUnits + freeUnits) * offer.unitPrice;
      const savings = freeUnits * offer.unitPrice;
      const finalTotal = paidUnits * offer.unitPrice;
      return {
        regularTotal,
        savings,
        finalTotal,
        note:
          qty === 1
            ? "1 paid + 1 bonus free item included"
            : `${freeUnits} item(s) free with Buy 1 Get 1`
      };
    }

    const regularTotal = qty * offer.unitPrice;
    const savings = (regularTotal * offer.discountPercent) / 100;
    const finalTotal = regularTotal - savings;
    return {
      regularTotal,
      savings,
      finalTotal,
      note: `${offer.discountPercent}% instant bakery discount`
    };
  }

  function showToast(message) {
    const toast = document.getElementById("status-toast");
    const toastText = document.getElementById("status-toast-text");
    if (!toast || !toastText) return;

    toastText.textContent = message;
    toast.classList.add("is-visible");

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2600);
  }

  /* ------------------------------------------------------------------------
     Filtering & Dynamic Card Rendering
     ------------------------------------------------------------------------ */

  function getFilteredOffers() {
    const query = searchQuery.trim().toLowerCase();

    return SPECIAL_OFFERS.filter((offer) => {
      const matchesType =
        activeFilter === "all" ||
        (activeFilter === "saved" && savedOfferIds.includes(offer.id)) ||
        offer.dealType === activeFilter;

      if (!matchesType) return false;
      if (!query) return true;

      const searchable = [
        offer.badge,
        offer.title,
        offer.category,
        offer.description,
        offer.code
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }

  function createOfferCardElement(offer) {
    const isSaved = savedOfferIds.includes(offer.id);
    const isSelected = offer.id === selectedOfferId;

    const card = document.createElement("article");
    card.className = `offer-card${isSelected ? " is-selected" : ""}`;
    card.dataset.offerId = offer.id;

    // Media wrapper with accessible alt text and offer badge
    const media = document.createElement("div");
    media.className = "offer-media";

    const img = document.createElement("img");
    img.src = offer.image;
    img.alt = offer.imageAlt;
    img.loading = "lazy";

    const badge = document.createElement("span");
    badge.className =
      offer.dealType === "bogo"
        ? "offer-discount-badge offer-discount-badge--bogo"
        : "offer-discount-badge";
    badge.textContent = offer.badge;

    media.append(img, badge);

    // Card content body
    const body = document.createElement("div");
    body.className = "offer-body";

    const catRow = document.createElement("div");
    catRow.className = "offer-category-row";

    const categoryTag = document.createElement("span");
    categoryTag.className = "offer-category-tag";
    categoryTag.textContent = offer.category;

    const codeChip = document.createElement("span");
    codeChip.className = "offer-code-chip";
    codeChip.textContent = `Code: ${offer.code}`;

    catRow.append(categoryTag, codeChip);

    const title = document.createElement("h3");
    title.className = "offer-title";
    title.textContent = offer.title;

    const desc = document.createElement("p");
    desc.className = "offer-desc";
    desc.textContent = offer.description;

    const priceRow = document.createElement("div");
    priceRow.className = "offer-price-row";

    if (offer.dealType === "bogo") {
      const priceNow = document.createElement("span");
      priceNow.className = "offer-price-now";
      priceNow.textContent = `${formatCurrency(offer.unitPrice)} / pair`;

      const priceNote = document.createElement("span");
      priceNote.className = "offer-price-note";
      priceNote.textContent = "2nd item free";

      priceRow.append(priceNow, priceNote);
    } else {
      const discountedUnit =
        offer.unitPrice - (offer.unitPrice * offer.discountPercent) / 100;

      const priceNow = document.createElement("span");
      priceNow.className = "offer-price-now";
      priceNow.textContent = formatCurrency(discountedUnit);

      const priceWas = document.createElement("span");
      priceWas.className = "offer-price-was";
      priceWas.textContent = formatCurrency(offer.unitPrice);

      priceRow.append(priceNow, priceWas);
    }

    // Actions
    const actions = document.createElement("div");
    actions.className = "offer-actions";

    if (offer.hasShopButton) {
      const shopLink = document.createElement("a");
      shopLink.href = offer.shopUrl;
      shopLink.className = "btn btn-primary";
      shopLink.textContent = offer.ctaLabel;
      shopLink.addEventListener("click", () => {
        selectedOfferId = offer.id;
        writeSelectedOfferId(offer.id);
      });
      actions.appendChild(shopLink);
    } else {
      const selectBogoBtn = document.createElement("button");
      selectBogoBtn.type = "button";
      selectBogoBtn.className = "btn btn-primary";
      selectBogoBtn.textContent = isSelected ? "Offer Selected" : "Claim Offer";
      selectBogoBtn.addEventListener("click", () => {
        selectOfferForPreview(offer.id);
        showToast(`${offer.badge} (${offer.title}) selected in Discount Preview.`);
      });
      actions.appendChild(selectBogoBtn);
    }

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = `btn btn-save${isSaved ? " is-saved" : ""}`;
    saveBtn.setAttribute("aria-pressed", String(isSaved));
    saveBtn.textContent = isSaved ? "Saved" : "Save Offer";
    saveBtn.addEventListener("click", () => toggleSavedOffer(offer.id));

    const previewBtn = document.createElement("button");
    previewBtn.type = "button";
    previewBtn.className = "btn btn-secondary btn-preview";
    previewBtn.textContent = isSelected ? "Previewing Discount" : "Preview Discount";
    previewBtn.addEventListener("click", () => {
      selectOfferForPreview(offer.id);
      const previewHeading = document.getElementById("preview-heading");
      if (previewHeading) {
        previewHeading.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    actions.append(saveBtn, previewBtn);
    body.append(catRow, title, desc, priceRow, actions);
    card.append(media, body);

    return card;
  }

  function renderOffers() {
    const grid = document.getElementById("offers-grid");
    const emptyState = document.getElementById("offers-empty-state");
    const emptyMessage = document.getElementById("offers-empty-message");
    const resultsMeta = document.getElementById("offers-results-meta");

    if (!grid) return;

    const filtered = getFilteredOffers();
    grid.innerHTML = "";

    if (filtered.length === 0) {
      if (emptyState) {
        emptyState.hidden = false;
      }
      if (emptyMessage) {
        emptyMessage.textContent =
          activeFilter === "saved" && savedOfferIds.length === 0
            ? "You have not saved any offers yet. Save a deal from All Offers to view it here."
            : "No bakery offers matched your search or filter. Try another keyword or reset filters.";
      }
      if (resultsMeta) {
        resultsMeta.textContent = "Showing 0 of 3 offers";
      }
      return;
    }

    if (emptyState) {
      emptyState.hidden = true;
    }

    if (resultsMeta) {
      resultsMeta.textContent = `Showing ${filtered.length} of ${SPECIAL_OFFERS.length} offers`;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((offer) => {
      fragment.appendChild(createOfferCardElement(offer));
    });
    grid.appendChild(fragment);
  }

  /* ------------------------------------------------------------------------
     Saved Offers & Discount Preview Interactions
     ------------------------------------------------------------------------ */

  function toggleSavedOffer(offerId) {
    const offer = SPECIAL_OFFERS.find((item) => item.id === offerId);
    if (!offer) return;

    const alreadySaved = savedOfferIds.includes(offerId);
    if (alreadySaved) {
      savedOfferIds = savedOfferIds.filter((id) => id !== offerId);
      showToast(`Removed "${offer.title}" from Saved Offers.`);
    } else {
      savedOfferIds = [...savedOfferIds, offerId];
      showToast(`Saved "${offer.badge} — ${offer.title}" to your browser.`);
    }

    writeSavedOfferIds(savedOfferIds);
    renderOffers();
    renderSavedOffersPanel();
  }

  function selectOfferForPreview(offerId) {
    const exists = SPECIAL_OFFERS.some((offer) => offer.id === offerId);
    if (!exists) return;

    selectedOfferId = offerId;
    writeSelectedOfferId(offerId);

    const selectEl = document.getElementById("preview-offer-select");
    if (selectEl) {
      selectEl.value = offerId;
    }

    renderOffers();
    renderDiscountPreview();
  }

  function renderDiscountPreview() {
    const selectEl = document.getElementById("preview-offer-select");
    const qtyInput = document.getElementById("preview-qty-input");
    const selectedLabel = document.getElementById("preview-selected-label");
    const codeEl = document.getElementById("preview-code");
    const regularEl = document.getElementById("preview-regular-total");
    const savingsEl = document.getElementById("preview-savings-amount");
    const finalEl = document.getElementById("preview-final-total");

    const activeOffer =
      SPECIAL_OFFERS.find((offer) => offer.id === selectedOfferId) ||
      SPECIAL_OFFERS[0];

    if (selectEl && selectEl.value !== activeOffer.id) {
      selectEl.value = activeOffer.id;
    }

    const qty = qtyInput ? qtyInput.value : 2;
    const calc = calculateOfferPreview(activeOffer, qty);

    if (selectedLabel) {
      selectedLabel.textContent = `${activeOffer.badge} on ${activeOffer.title} (${calc.note}).`;
    }
    if (codeEl) {
      codeEl.textContent = activeOffer.code;
    }
    if (regularEl) {
      regularEl.textContent = formatCurrency(calc.regularTotal);
    }
    if (savingsEl) {
      savingsEl.textContent = `- ${formatCurrency(calc.savings)}`;
    }
    if (finalEl) {
      finalEl.textContent = formatCurrency(calc.finalTotal);
    }
  }

  function renderSavedOffersPanel() {
    const listEl = document.getElementById("saved-offers-list");
    const emptyEl = document.getElementById("saved-offers-empty");
    const clearBtn = document.getElementById("clear-saved-offers");
    const headerCount = document.getElementById("header-saved-count");

    if (headerCount) {
      headerCount.textContent = String(savedOfferIds.length);
    }

    if (!listEl || !emptyEl || !clearBtn) return;

    listEl.innerHTML = "";
    const savedOffers = SPECIAL_OFFERS.filter((offer) =>
      savedOfferIds.includes(offer.id)
    );

    if (savedOffers.length === 0) {
      emptyEl.hidden = false;
      clearBtn.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    clearBtn.hidden = false;

    savedOffers.forEach((offer) => {
      const li = document.createElement("li");
      li.className = "saved-list-item";

      const info = document.createElement("div");
      const title = document.createElement("p");
      title.className = "saved-item-title";
      title.textContent = `${offer.badge} — ${offer.title}`;

      const meta = document.createElement("p");
      meta.className = "saved-item-meta";
      meta.textContent = `Promo Code: ${offer.code}`;

      info.append(title, meta);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "saved-remove-btn";
      removeBtn.textContent = "Remove";
      removeBtn.setAttribute("aria-label", `Remove ${offer.title} from saved offers`);
      removeBtn.addEventListener("click", () => toggleSavedOffer(offer.id));

      li.append(info, removeBtn);
      listEl.appendChild(li);
    });
  }

  /* ------------------------------------------------------------------------
     Initialization
     ------------------------------------------------------------------------ */

  function initMobileMenu() {
    const toggle = document.getElementById("menu-toggle");
    const mobileNav = document.getElementById("mobile-nav");
    if (!toggle || !mobileNav) return;

    toggle.addEventListener("click", () => {
      const isOpen = mobileNav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileNav.classList.contains("is-open")) {
        mobileNav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  function initControls() {
    const searchInput = document.getElementById("offers-search");
    const filterButtons = document.querySelectorAll("[data-offer-filter]");
    const resetBtn = document.getElementById("reset-offers-filters");
    const offerSelect = document.getElementById("preview-offer-select");
    const qtyInput = document.getElementById("preview-qty-input");
    const clearSavedBtn = document.getElementById("clear-saved-offers");

    if (offerSelect) {
      SPECIAL_OFFERS.forEach((offer) => {
        const option = document.createElement("option");
        option.value = offer.id;
        option.textContent = `${offer.badge} — ${offer.title}`;
        offerSelect.appendChild(option);
      });
      offerSelect.value = selectedOfferId;
      offerSelect.addEventListener("change", (event) => {
        selectOfferForPreview(event.target.value);
      });
    }

    if (qtyInput) {
      qtyInput.addEventListener("input", renderDiscountPreview);
    }

    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        searchQuery = event.target.value;
        renderOffers();
      });
    }

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.getAttribute("data-offer-filter") || "all";
        filterButtons.forEach((btn) => {
          const active = btn === button;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-pressed", String(active));
        });
        renderOffers();
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        activeFilter = "all";
        searchQuery = "";
        if (searchInput) {
          searchInput.value = "";
        }
        filterButtons.forEach((btn) => {
          const isAll = btn.getAttribute("data-offer-filter") === "all";
          btn.classList.toggle("is-active", isAll);
          btn.setAttribute("aria-pressed", String(isAll));
        });
        renderOffers();
        if (searchInput) {
          searchInput.focus();
        }
      });
    }

    if (clearSavedBtn) {
      clearSavedBtn.addEventListener("click", () => {
        savedOfferIds = [];
        writeSavedOfferIds([]);
        renderOffers();
        renderSavedOffersPanel();
        showToast("Cleared all saved offers.");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initMobileMenu();
    initControls();
    renderOffers();
    renderDiscountPreview();
    renderSavedOffersPanel();
  });
})();
