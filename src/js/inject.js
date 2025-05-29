// Page functionality injection for TeeworldsCN Admin
// This script is injected into the remote page to provide page-specific functionality

(function () {
  "use strict";

  // Check if we're in NW.js environment
  if (typeof nw === "undefined") {
    console.log("[Inject] NW.js not available, page functionality limited");
    return;
  }

  console.log("[Inject] Initializing page functionality...");

  // Check if current page is the ticket page
  function isTicketPage() {
    return window.location.pathname.endsWith("/ddnet/tickets");
  }

  // Find and click logout button/form
  function performLogout() {
    let logoutElement = document.querySelector(
      'form[action="/login/logout"] button[type="submit"]'
    );

    if (logoutElement) {
      try {
        // Simulate click on the logout element
        logoutElement.click();
        console.log("Logout button clicked successfully");
        return true;
      } catch (error) {
        console.error("Error clicking logout button:", error);
        return false;
      }
    } else {
      console.log("No logout button found on the page");
      return false;
    }
  }

  function exposeNotificationControl() {
    let notificationCallback;
    const notificationState = {
      state: nw.global.localStorage.getItem("allowNotification", "granted"),
      addEventListener(type, listener) {
        if (type === "change") {
          console.log("Notification listener added");
          notificationCallback = listener;
        }
      },
    };

    const permissionRequest = Notification.requestPermission;
    Notification.requestPermission = async function () {
      console.log("Requesting permission");
      await permissionRequest();
      return Promise.resolve(notificationState.state);
    };

    Object.defineProperty(Notification, "permission", {
      get: function () {
        return notificationState.state;
      },
    });

    const originalNavigatorPermissionQuery = navigator.permissions.query;
    navigator.permissions.query = async function (permissionDesc) {
      if (permissionDesc.name === "notifications") {
        return Promise.resolve(notificationState);
      } else {
        return originalNavigatorPermissionQuery.call(this, permissionDesc);
      }
    };

    const toggleNotification = function (checked) {
      notificationState.state = checked ? "granted" : "denied";

      nw.global.localStorage.setItem(
        "allowNotification",
        notificationState.state.toString()
      );

      console.log("Notification toggled to:", notificationState.state);
      if (notificationCallback) {
        notificationCallback({ state: notificationState.state });
      }
    };

    if (window.nwTrayInterface) {
      window.nwTrayInterface.toggleNotification = toggleNotification;
    }
  }

  // Expose logout function to tray (called from main.js)
  function exposeLogoutFunction() {
    // Make logout function available globally for tray access
    if (window.nwTrayInterface) {
      window.nwTrayInterface.performLogout = performLogout;
      window.nwTrayInterface.isTicketPage = isTicketPage;
    } else {
      window.nwTrayInterface = {
        performLogout: performLogout,
        isTicketPage: isTicketPage,
      };
    }
  }

  function preventTitleModification() {
    document.addEventListener("DOMContentLoaded", function () {
      document.getElementsByTagName("title")[0].textContent =
        "TeeworldsCN 管理系统";
    });
    const originalTitle = "TeeworldsCN 管理系统";

    Object.defineProperty(document, "title", {
      get: function () {
        return originalTitle;
      },
      set: function (value) {
        console.log("Attempted to change title to:", value, "- Blocked");
      },
      configurable: false,
      enumerable: true,
    });
  }

  function pageCropHack() {
    document.addEventListener("DOMContentLoaded", function () {
      // inject css
      const style = document.createElement("style");
      style.textContent = `
        html {
          margin-top: -5.75rem !important;
          overflow: hidden !important;
        }
        nav {
          pointer-events: none !important;
        }
        .container {
          max-width: 100svw !important;
        }
        #admin-tickets-page {
          height: 100svh !important;
          padding-top: 0.25rem !important;
          padding-bottom: 0.25rem !important;
        }
        #ticket-panel {
          top: 0 !important;
          bottom: 0 !important;
        }
        #ticket-panel > button {
          top: 0.25rem !important;
        }
        #welcome-screen {
          display: none !important;
        }
        main {
          height: calc(100svh + 5rem) !important;
        }
      `;
      document.head.appendChild(style);
    });
  }

  // Initialize everything when DOM is ready
  function initialize() {
    console.log(
      "[Inject] Initializing TeeworldsCN Admin page functionality..."
    );

    // Prevent title modification first
    preventTitleModification();

    // Setup page crop hack
    pageCropHack();

    // Expose functions for tray interaction
    exposeLogoutFunction();
    exposeNotificationControl();

    console.log("[Inject] Page functionality initialized successfully");
  }

  initialize();
})();
