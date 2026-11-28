/* ==========================================================================
   Crumb & Co. — Authentication & Account State Logic
   Vanilla JavaScript: 4-state auth flow, validation, localStorage & navbar sync
   ========================================================================== */

(function () {
  "use strict";

  // Storage keys used in browser localStorage
  const USERS_STORAGE_KEY = "crumbAndCoUsers";
  const ACTIVE_USER_KEY = "crumbAndCoActiveUser";
  const SAVED_OFFERS_KEY = "crumbAndCoSavedOffers";

  // Pre-seeded demo bakery account so Login & Incorrect Password states work right away
  const DEFAULT_DEMO_USER = {
    name: "Crumb Baker",
    email: "baker@crumbandco.com",
    password: "crumb123"
  };

  let toastTimer = null;

  /* ------------------------------------------------------------------------
     localStorage Helpers
     ------------------------------------------------------------------------ */

  function readUsers() {
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      if (!raw) {
        // Seed one demo account on first visit
        const initialUsers = [DEFAULT_DEMO_USER];
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initialUsers));
        return initialUsers;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [DEFAULT_DEMO_USER];
    }
  }

  function writeUsers(users) {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch {
      // Ignore storage errors in restricted browser contexts
    }
  }

  function readActiveUser() {
    try {
      const raw = localStorage.getItem(ACTIVE_USER_KEY);
      if (!raw) return null;
      const user = JSON.parse(raw);
      if (user && typeof user.email === "string" && typeof user.name === "string") {
        return user;
      }
      return null;
    } catch {
      return null;
    }
  }

  function writeActiveUser(user) {
    try {
      if (!user) {
        localStorage.removeItem(ACTIVE_USER_KEY);
        return;
      }
      // Store only non-sensitive profile details for the active session
      const sessionUser = {
        name: user.name,
        email: user.email
      };
      localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(sessionUser));
    } catch {
      // Ignore storage errors in restricted browser contexts
    }
  }

  function readSavedOffersCount() {
    try {
      const raw = localStorage.getItem(SAVED_OFFERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }

  /* ------------------------------------------------------------------------
     Validation & UI Feedback Helpers
     ------------------------------------------------------------------------ */

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function setFieldError(inputEl, errorEl, message) {
    if (!inputEl || !errorEl) return;
    errorEl.textContent = message;
    inputEl.classList.toggle("is-invalid", Boolean(message));
    if (message) {
      inputEl.setAttribute("aria-invalid", "true");
    } else {
      inputEl.removeAttribute("aria-invalid");
    }
  }

  function clearFormErrors(pairs) {
    pairs.forEach(([inputEl, errorEl]) => {
      setFieldError(inputEl, errorEl, "");
    });
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
    }, 2800);
  }

  /* ------------------------------------------------------------------------
     Navbar & Account Status Sync (Works on All Pages Including auth.js)
     ------------------------------------------------------------------------ */

  function getFirstName(fullName) {
    const trimmed = String(fullName || "").trim();
    if (!trimmed) return "Member";
    return trimmed.split(/\s+/)[0];
  }

  function updateNavbarAuthStatus() {
    const activeUser = readActiveUser();
    const authNavLinks = document.querySelectorAll(
      '[data-auth-nav], .nav-links a[href$="login.html"], .mobile-nav-list a[href$="login.html"], .footer-links a[href$="login.html"]'
    );
    const accountPill = document.getElementById("header-account-pill");
    const accountLabel = document.getElementById("header-account-label");

    authNavLinks.forEach((link) => {
      if (activeUser) {
        const firstName = getFirstName(activeUser.name);
        link.textContent = `Account (${firstName})`;
        link.setAttribute("aria-label", `Account signed in as ${activeUser.name}`);
        link.classList.add("is-logged-in");
      } else {
        link.textContent = "Login";
        link.setAttribute("aria-label", "Login or Register");
        link.classList.remove("is-logged-in");
      }
    });

    if (accountPill && accountLabel) {
      if (activeUser) {
        accountLabel.textContent = `Hi, ${getFirstName(activeUser.name)}`;
        accountPill.classList.add("is-authenticated");
        accountPill.setAttribute("aria-label", `Signed in as ${activeUser.name}`);
      } else {
        accountLabel.textContent = "Guest";
        accountPill.classList.remove("is-authenticated");
        accountPill.setAttribute("aria-label", "Not signed in");
      }
    }
  }

  /* ------------------------------------------------------------------------
     Mobile Navigation Menu (for pages/login.html)
     ------------------------------------------------------------------------ */

  function initMobileMenu() {
    const toggle = document.getElementById("menu-toggle");
    const mobileNav = document.getElementById("mobile-nav");
    if (!toggle || !mobileNav) return;

    // Avoid binding twice if another page script (such as offers.js) already bound it
    if (toggle.dataset.authMenuBound === "true") return;
    toggle.dataset.authMenuBound = "true";

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

  /* ------------------------------------------------------------------------
     4-State Auth View Controller (pages/login.html)
     ------------------------------------------------------------------------ */

  function initAuthPage() {
    const stateSections = {
      login: document.getElementById("state-login"),
      success: document.getElementById("state-success"),
      error: document.getElementById("state-error"),
      register: document.getElementById("state-register"),
      account: document.getElementById("state-account")
    };

    // Only run auth form logic on pages/login.html
    if (!stateSections.login || !stateSections.register) {
      return;
    }

    const loginForm = document.getElementById("login-form");
    const loginEmailInput = document.getElementById("login-email");
    const loginPasswordInput = document.getElementById("login-password");
    const loginEmailError = document.getElementById("login-email-error");
    const loginPasswordError = document.getElementById("login-password-error");

    const registerForm = document.getElementById("register-form");
    const registerNameInput = document.getElementById("register-name");
    const registerEmailInput = document.getElementById("register-email");
    const registerPasswordInput = document.getElementById("register-password");
    const registerNameError = document.getElementById("register-name-error");
    const registerEmailError = document.getElementById("register-email-error");
    const registerPasswordError = document.getElementById("register-password-error");

    const successUserDetail = document.getElementById("success-user-detail");
    const errorDetailText = document.getElementById("error-detail-text");

    const accountWelcomeSub = document.getElementById("account-welcome-sub");
    const accountNameValue = document.getElementById("account-name-value");
    const accountEmailValue = document.getElementById("account-email-value");
    const accountSavedOffersValue = document.getElementById("account-saved-offers-value");

    const goToRegisterBtn = document.getElementById("go-to-register-btn");
    const backToLoginBtn = document.getElementById("back-to-login-btn");
    const goToAccountBtn = document.getElementById("go-to-account-btn");
    const tryAgainBtn = document.getElementById("try-again-btn");
    const errorToRegisterBtn = document.getElementById("error-to-register-btn");
    const logoutBtn = document.getElementById("logout-btn");

    function showState(targetState) {
      Object.entries(stateSections).forEach(([key, section]) => {
        if (section) {
          section.hidden = key !== targetState;
        }
      });
    }

    function populateAccountView(user) {
      if (!user) return;
      if (accountWelcomeSub) {
        accountWelcomeSub.textContent = `Welcome back, ${user.name}! Your bakery profile is active.`;
      }
      if (accountNameValue) {
        accountNameValue.textContent = user.name;
      }
      if (accountEmailValue) {
        accountEmailValue.textContent = user.email;
      }
      if (accountSavedOffersValue) {
        accountSavedOffersValue.textContent = String(readSavedOffersCount());
      }
    }

    function openSuccessState(user, isNewAccount) {
      if (successUserDetail) {
        successUserDetail.textContent = isNewAccount
          ? `Account created for ${user.name} (${user.email}).`
          : `Signed in as ${user.name} (${user.email}).`;
      }
      showState("success");
      updateNavbarAuthStatus();
    }

    // Clear field error as soon as the user starts typing again
    const watchedFields = [
      [loginEmailInput, loginEmailError],
      [loginPasswordInput, loginPasswordError],
      [registerNameInput, registerNameError],
      [registerEmailInput, registerEmailError],
      [registerPasswordInput, registerPasswordError]
    ];

    watchedFields.forEach(([inputEl, errorEl]) => {
      if (!inputEl) return;
      inputEl.addEventListener("input", () => {
        setFieldError(inputEl, errorEl, "");
      });
    });

    // Show / Hide password toggles
    const toggleButtons = document.querySelectorAll("[data-toggle-password]");
    toggleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const targetId = button.getAttribute("data-toggle-password");
        const input = targetId ? document.getElementById(targetId) : null;
        if (!input) return;

        const showPlain = input.type === "password";
        input.type = showPlain ? "text" : "password";
        button.textContent = showPlain ? "Hide" : "Show";
        button.setAttribute("aria-pressed", String(showPlain));
        button.setAttribute("aria-label", showPlain ? "Hide password" : "Show password");
      });
    });

    // State 1 -> State 4 (Login -> Register)
    if (goToRegisterBtn) {
      goToRegisterBtn.addEventListener("click", () => {
        clearFormErrors([
          [registerNameInput, registerNameError],
          [registerEmailInput, registerEmailError],
          [registerPasswordInput, registerPasswordError]
        ]);
        showState("register");
        if (registerNameInput) {
          registerNameInput.focus();
        }
      });
    }

    // State 4 -> State 1 (Register -> Login)
    if (backToLoginBtn) {
      backToLoginBtn.addEventListener("click", () => {
        clearFormErrors([
          [loginEmailInput, loginEmailError],
          [loginPasswordInput, loginPasswordError]
        ]);
        showState("login");
        if (loginEmailInput) {
          loginEmailInput.focus();
        }
      });
    }

    // State 2 -> Account View
    if (goToAccountBtn) {
      goToAccountBtn.addEventListener("click", () => {
        const activeUser = readActiveUser();
        if (!activeUser) {
          showState("login");
          return;
        }
        populateAccountView(activeUser);
        showState("account");
      });
    }

    // State 3 -> State 1 ("Try Again" button)
    if (tryAgainBtn) {
      tryAgainBtn.addEventListener("click", () => {
        showState("login");
        if (loginPasswordInput) {
          loginPasswordInput.value = "";
          loginPasswordInput.focus();
        }
      });
    }

    // State 3 -> State 4 ("Create an Account" shortcut)
    if (errorToRegisterBtn) {
      errorToRegisterBtn.addEventListener("click", () => {
        if (registerEmailInput && loginEmailInput && loginEmailInput.value.trim()) {
          registerEmailInput.value = loginEmailInput.value.trim();
        }
        showState("register");
        if (registerNameInput) {
          registerNameInput.focus();
        }
      });
    }

    // Account -> State 1 (Log Out)
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        writeActiveUser(null);
        updateNavbarAuthStatus();
        if (loginForm) loginForm.reset();
        if (registerForm) registerForm.reset();
        clearFormErrors(watchedFields);
        showState("login");
        showToast("You have been logged out.");
        if (loginEmailInput) {
          loginEmailInput.focus();
        }
      });
    }

    // Login Form Submit -> State 2 (Success) or State 3 (Incorrect Password)
    if (loginForm) {
      loginForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const email = (loginEmailInput ? loginEmailInput.value : "").trim().toLowerCase();
        const password = loginPasswordInput ? loginPasswordInput.value : "";

        clearFormErrors([
          [loginEmailInput, loginEmailError],
          [loginPasswordInput, loginPasswordError]
        ]);

        let firstInvalidField = null;

        if (!email) {
          setFieldError(loginEmailInput, loginEmailError, "Please enter your email address.");
          firstInvalidField = firstInvalidField || loginEmailInput;
        } else if (!isValidEmail(email)) {
          setFieldError(
            loginEmailInput,
            loginEmailError,
            "Please enter a valid email address (e.g., name@example.com)."
          );
          firstInvalidField = firstInvalidField || loginEmailInput;
        }

        if (!password.trim()) {
          setFieldError(loginPasswordInput, loginPasswordError, "Please enter your password.");
          firstInvalidField = firstInvalidField || loginPasswordInput;
        }

        if (firstInvalidField) {
          firstInvalidField.focus();
          return;
        }

        const users = readUsers();
        const matchedUser = users.find((user) => user.email.toLowerCase() === email);

        if (!matchedUser) {
          if (errorDetailText) {
            errorDetailText.textContent =
              "No Crumb & Co. account matches that email, or the password is incorrect. Try again or register a new account.";
          }
          showState("error");
          return;
        }

        if (matchedUser.password !== password) {
          if (errorDetailText) {
            errorDetailText.textContent =
              "The password you entered does not match this account. Please check it and try again.";
          }
          showState("error");
          return;
        }

        writeActiveUser(matchedUser);
        openSuccessState(matchedUser, false);
        showToast(`Welcome back, ${getFirstName(matchedUser.name)}!`);
      });
    }

    // Register Form Submit -> Persist user in localStorage & open Success state
    if (registerForm) {
      registerForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const name = (registerNameInput ? registerNameInput.value : "").trim();
        const email = (registerEmailInput ? registerEmailInput.value : "").trim().toLowerCase();
        const password = registerPasswordInput ? registerPasswordInput.value : "";

        clearFormErrors([
          [registerNameInput, registerNameError],
          [registerEmailInput, registerEmailError],
          [registerPasswordInput, registerPasswordError]
        ]);

        let firstInvalidField = null;

        if (name.length < 2) {
          setFieldError(
            registerNameInput,
            registerNameError,
            "Please enter your full name (at least 2 characters)."
          );
          firstInvalidField = firstInvalidField || registerNameInput;
        }

        if (!email) {
          setFieldError(registerEmailInput, registerEmailError, "Please enter your email address.");
          firstInvalidField = firstInvalidField || registerEmailInput;
        } else if (!isValidEmail(email)) {
          setFieldError(
            registerEmailInput,
            registerEmailError,
            "Please enter a valid email address (e.g., name@example.com)."
          );
          firstInvalidField = firstInvalidField || registerEmailInput;
        }

        if (password.length < 6) {
          setFieldError(
            registerPasswordInput,
            registerPasswordError,
            "Password must be at least 6 characters long."
          );
          firstInvalidField = firstInvalidField || registerPasswordInput;
        }

        if (firstInvalidField) {
          firstInvalidField.focus();
          return;
        }

        const users = readUsers();
        const emailTaken = users.some((user) => user.email.toLowerCase() === email);

        if (emailTaken) {
          setFieldError(
            registerEmailInput,
            registerEmailError,
            "An account with this email already exists. Please go back to Login."
          );
          if (registerEmailInput) {
            registerEmailInput.focus();
          }
          return;
        }

        const newUser = {
          name,
          email,
          password
        };

        users.push(newUser);
        writeUsers(users);
        writeActiveUser(newUser);

        openSuccessState(newUser, true);
        showToast(`Account created! Welcome, ${getFirstName(newUser.name)}.`);
      });
    }

    // Restore logged-in state across page reloads
    const existingUser = readActiveUser();
    if (existingUser) {
      populateAccountView(existingUser);
      showState("account");
    } else {
      showState("login");
    }
  }

  /* ------------------------------------------------------------------------
     Initialization
     ------------------------------------------------------------------------ */

  document.addEventListener("DOMContentLoaded", () => {
    readUsers();
    updateNavbarAuthStatus();
    initMobileMenu();
    initAuthPage();
  });
})();
