/* ==========================================================================
   Crumb & Co. — Contact Page Validation & State Logic
   Vanilla JavaScript: live + submit-time validation and local confirmation UI
   ========================================================================== */

(function () {
  "use strict";

  const MIN_NAME_LENGTH = 2;
  const MIN_MESSAGE_LENGTH = 10;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Centralized form state:
   * - values: current trimmed/raw input values
   * - touched: tracks fields the user has blurred or edited
   * - hasAttemptedSubmit: forces validation feedback on every field after Send
   * - errors: latest validation message per field (empty string when valid)
   * - lastSubmitted: details for the local confirmation banner
   */
  const formState = {
    values: {
      name: "",
      email: "",
      message: ""
    },
    touched: {
      name: false,
      email: false,
      message: false
    },
    hasAttemptedSubmit: false,
    errors: {
      name: "",
      email: "",
      message: ""
    },
    lastSubmitted: null
  };

  let toastTimer = null;

  /* ------------------------------------------------------------------------
     Validation Rules (Pure Functions)
     ------------------------------------------------------------------------ */

  function validateName(rawValue) {
    const trimmed = String(rawValue || "").trim();
    if (!trimmed) {
      return "Please enter your name.";
    }
    if (trimmed.length < MIN_NAME_LENGTH) {
      return `Please enter at least ${MIN_NAME_LENGTH} characters for your name.`;
    }
    return "";
  }

  function validateEmail(rawValue) {
    const trimmed = String(rawValue || "").trim();
    if (!trimmed) {
      return "Please enter your email address.";
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      return "Please enter a valid email address (e.g., name@example.com).";
    }
    return "";
  }

  function validateMessage(rawValue) {
    const trimmed = String(rawValue || "").trim();
    if (!trimmed) {
      return "Please enter a message before sending.";
    }
    if (trimmed.length < MIN_MESSAGE_LENGTH) {
      return `Your message is too short — please write at least ${MIN_MESSAGE_LENGTH} characters (${trimmed.length}/${MIN_MESSAGE_LENGTH}).`;
    }
    return "";
  }

  const FIELD_VALIDATORS = {
    name: validateName,
    email: validateEmail,
    message: validateMessage
  };

  /* ------------------------------------------------------------------------
     UI Feedback Helpers
     ------------------------------------------------------------------------ */

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
    }, 3000);
  }

  function updateMessageCounter(rawValue) {
    const counter = document.getElementById("contact-message-counter");
    if (!counter) return;

    const length = String(rawValue || "").trim().length;
    const isMet = length >= MIN_MESSAGE_LENGTH;
    counter.textContent = isMet
      ? `${length} characters`
      : `${length} / ${MIN_MESSAGE_LENGTH} min`;
    counter.classList.toggle("is-met", isMet);
  }

  function renderFieldState(fieldKey, fieldsMap) {
    const field = fieldsMap[fieldKey];
    if (!field) return;

    const { input, errorEl } = field;
    const rawValue = input.value;
    const trimmed = rawValue.trim();
    const shouldValidate =
      formState.hasAttemptedSubmit ||
      formState.touched[fieldKey] ||
      trimmed.length > 0;

    const errorMessage = shouldValidate
      ? FIELD_VALIDATORS[fieldKey](rawValue)
      : "";

    formState.errors[fieldKey] = errorMessage;
    errorEl.textContent = errorMessage;

    const showValid = shouldValidate && !errorMessage;
    input.classList.toggle("is-invalid", Boolean(errorMessage));
    input.classList.toggle("is-valid", showValid);

    if (errorMessage) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }

  function renderConfirmation(confirmationEls) {
    const { box, title, text } = confirmationEls;
    if (!box || !title || !text) return;

    if (!formState.lastSubmitted) {
      box.hidden = true;
      return;
    }

    const { name, email } = formState.lastSubmitted;
    title.textContent = `Thank you, ${name}!`;
    text.textContent = `Your message has been recorded locally for ${email}. No external submission was made — our bakery team will reply soon.`;
    box.hidden = false;
  }

  /* ------------------------------------------------------------------------
     Mobile Navigation Fallback (if auth.js is absent or loads later)
     ------------------------------------------------------------------------ */

  function initMobileMenu() {
    const toggle = document.getElementById("menu-toggle");
    const mobileNav = document.getElementById("mobile-nav");
    if (!toggle || !mobileNav) return;

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
     Contact Form Controller
     ------------------------------------------------------------------------ */

  function initContactForm() {
    const form = document.getElementById("contact-form");
    const nameInput = document.getElementById("contact-name");
    const emailInput = document.getElementById("contact-email");
    const messageInput = document.getElementById("contact-message");

    const nameError = document.getElementById("contact-name-error");
    const emailError = document.getElementById("contact-email-error");
    const messageError = document.getElementById("contact-message-error");

    const confirmationEls = {
      box: document.getElementById("contact-confirmation"),
      title: document.getElementById("contact-confirmation-title"),
      text: document.getElementById("contact-confirmation-text"),
      dismissBtn: document.getElementById("contact-confirmation-dismiss")
    };

    if (!form || !nameInput || !emailInput || !messageInput) {
      return;
    }

    const fieldsMap = {
      name: { input: nameInput, errorEl: nameError },
      email: { input: emailInput, errorEl: emailError },
      message: { input: messageInput, errorEl: messageError }
    };

    function resetValidationState() {
      formState.values = { name: "", email: "", message: "" };
      formState.touched = { name: false, email: false, message: false };
      formState.hasAttemptedSubmit = false;
      formState.errors = { name: "", email: "", message: "" };

      Object.values(fieldsMap).forEach(({ input, errorEl }) => {
        input.classList.remove("is-invalid", "is-valid");
        input.removeAttribute("aria-invalid");
        if (errorEl) {
          errorEl.textContent = "";
        }
      });

      updateMessageCounter("");
    }

    // Live validation on input & blur for each field
    Object.entries(fieldsMap).forEach(([fieldKey, { input }]) => {
      input.addEventListener("input", () => {
        formState.values[fieldKey] = input.value;
        if (input.value.trim().length > 0) {
          formState.touched[fieldKey] = true;
        }
        if (fieldKey === "message") {
          updateMessageCounter(input.value);
        }
        if (formState.lastSubmitted) {
          formState.lastSubmitted = null;
          renderConfirmation(confirmationEls);
        }
        renderFieldState(fieldKey, fieldsMap);
      });

      input.addEventListener("blur", () => {
        formState.touched[fieldKey] = true;
        renderFieldState(fieldKey, fieldsMap);
      });
    });

    if (confirmationEls.dismissBtn) {
      confirmationEls.dismissBtn.addEventListener("click", () => {
        formState.lastSubmitted = null;
        renderConfirmation(confirmationEls);
        nameInput.focus();
      });
    }

    // Submit-time validation (prevents network submission)
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      formState.hasAttemptedSubmit = true;

      let firstInvalidInput = null;
      ["name", "email", "message"].forEach((fieldKey) => {
        formState.touched[fieldKey] = true;
        formState.values[fieldKey] = fieldsMap[fieldKey].input.value;
        renderFieldState(fieldKey, fieldsMap);
        if (formState.errors[fieldKey] && !firstInvalidInput) {
          firstInvalidInput = fieldsMap[fieldKey].input;
        }
      });

      if (firstInvalidInput) {
        formState.lastSubmitted = null;
        renderConfirmation(confirmationEls);
        firstInvalidInput.focus();
        return;
      }

      formState.lastSubmitted = {
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        message: messageInput.value.trim()
      };

      form.reset();
      resetValidationState();
      renderConfirmation(confirmationEls);
      showToast(`Thanks, ${formState.lastSubmitted.name}! Your message is confirmed.`);
    });

    updateMessageCounter(messageInput.value);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initMobileMenu();
    initContactForm();
  });
})();
