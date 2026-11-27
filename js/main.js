/* ==========================================================================
   Crumb & Co. — Vanilla JavaScript for Home, Menu & Cakes
   ========================================================================== */

(function () {
  const CART_STORAGE_KEY = "crumbAndCoCart";

  function readCart() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage errors in restricted browser contexts
    }
  }

  function updateCartBadge() {
    const badge = document.getElementById("cart-badge");
    if (!badge) return;

    const totalQty = readCart().reduce((sum, item) => sum + (item.quantity || 1), 0);
    badge.textContent = String(totalQty);
    badge.classList.toggle("is-empty", totalQty === 0);
  }

  let toastTimer = null;

  function showToast(itemName) {
    const toast = document.getElementById("cart-toast");
    const toastMessage = document.getElementById("toast-message");
    if (!toast || !toastMessage) return;

    toastMessage.textContent = `${itemName} was added to the cart.`;
    toast.classList.add("is-visible");

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3000);
  }

  function addItemToCart(id, name, price) {
    const cart = readCart();
    const existing = cart.find((item) => item.id === id);

    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      cart.push({
        id,
        name,
        price: Number(price),
        quantity: 1
      });
    }

    saveCart(cart);
    updateCartBadge();
    showToast(name);
  }

  function initAddToCartButtons() {
    const buttons = document.querySelectorAll("[data-add-to-cart]");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-id") || "";
        const name = button.getAttribute("data-name") || "Bakery Item";
        const price = button.getAttribute("data-price") || "0";
        addItemToCart(id, name, price);
      });
    });
  }

  function initMobileMenu() {
    const toggle = document.getElementById("menu-toggle");
    const mobileNav = document.getElementById("mobile-nav");
    if (!toggle || !mobileNav) return;

    toggle.addEventListener("click", () => {
      const isOpen = mobileNav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  function initHeaderSearchShortcut() {
    const headerSearchBtn = document.getElementById("header-search-btn");
    const menuSearchInput = document.getElementById("menu-search");
    if (!headerSearchBtn) return;

    headerSearchBtn.addEventListener("click", (event) => {
      if (menuSearchInput) {
        event.preventDefault();
        menuSearchInput.focus();
      }
    });
  }

  function initMenuFiltering() {
    const searchInput = document.getElementById("menu-search");
    const filterTabs = document.querySelectorAll("[data-filter]");
    const menuRows = document.querySelectorAll(".menu-row");
    const emptyState = document.getElementById("menu-empty");

    if (!searchInput || filterTabs.length === 0 || menuRows.length === 0) {
      return;
    }

    let activeCategory = "all";

    const params = new URLSearchParams(window.location.search);
    const initialCategory = (params.get("category") || "").toLowerCase();
    if (["all", "cakes", "pastries", "breads"].includes(initialCategory)) {
      activeCategory = initialCategory;
      filterTabs.forEach((tab) => {
        tab.classList.toggle("is-active", tab.getAttribute("data-filter") === activeCategory);
      });
    }

    function applyFilters() {
      const query = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;

      menuRows.forEach((row) => {
        const rowCategory = (row.getAttribute("data-category") || "").toLowerCase();
        const searchText = (row.getAttribute("data-search") || row.textContent || "").toLowerCase();

        const matchesCategory = activeCategory === "all" || rowCategory === activeCategory;
        const matchesQuery = query === "" || searchText.includes(query);
        const shouldShow = matchesCategory && matchesQuery;

        row.hidden = !shouldShow;
        if (shouldShow) {
          visibleCount += 1;
        }
      });

      if (emptyState) {
        emptyState.hidden = visibleCount > 0;
      }
    }

    filterTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activeCategory = tab.getAttribute("data-filter") || "all";
        filterTabs.forEach((btn) => {
          btn.classList.toggle("is-active", btn === tab);
        });
        applyFilters();
      });
    });

    searchInput.addEventListener("input", applyFilters);
    applyFilters();
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateCartBadge();
    initMobileMenu();
    initHeaderSearchShortcut();
    initAddToCartButtons();
    initMenuFiltering();
  });
})();
