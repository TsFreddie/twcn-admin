// Main entry point for TeeworldsCN Admin NW.js application
// This script initializes the tray and opens the main application window

const { env } = require("process");
const AutoLaunch = require("auto-launch");

const VERSION = "1.0";

(function () {
  "use strict";

  // Configuration
  const APP_CONFIG = {
    remoteUrl: env.DEV_URL || "https://teeworlds.cn/admin/tickets",
    windowOptions: {
      title: "TeeworldsCN 管理系统",
      width: 1152,
      height: 648,
      min_width: 364,
      min_height: 648,
      icon: "./icon.png",
      show: true,
      focus: true,
    },
  };

  const match = new chrome.declarativeWebRequest.RequestMatcher({
    url: { hostSuffix: "", schemes: ["http"] },
    stages: ["onBeforeSendHeaders"],
  });

  const action = new chrome.declarativeWebRequest.SetRequestHeader({
    name: "origin",
    value: new URL(APP_CONFIG.remoteUrl).origin,
  });

  chrome.declarativeWebRequest.onRequest.addRules([
    {
      priority: 1000,
      conditions: [match],
      actions: [action],
    },
  ]);

  // Global state
  let tray = null;
  let mainWindow = null;
  let isQuitting = false;

  // Initialize auto-launch
  const autoLauncher = new AutoLaunch({
    name: "TeeworldsCN 管理系统",
  });

  // Initialize system tray
  function initializeTray() {
    try {
      // Create tray icon
      tray = new nw.Tray({
        title: "TeeworldsCN 管理系统",
        icon: "./icon.png",
        iconsAreTemplates: false,
      });

      // Create context menu for tray
      const menu = new nw.Menu();
      nw.global.nwMenu = menu;

      // Version menu item at the top
      const appVersion = VERSION;
      menu.append(
        new nw.MenuItem({
          label: `TWCN管理系统 - 版本 ${appVersion}`,
          enabled: false, // Make it non-clickable, just for display
        })
      );

      // Logout menu item
      menu.append(
        new nw.MenuItem({
          label: "更换账号",
          click: function () {
            performLogoutInMainWindow();
          },
        })
      );

      // Notification toggle menu item
      menu.append(
        new nw.MenuItem({
          label: "弹窗通知",
          type: "checkbox",
          checked: localStorage.getItem("allowNotification") === "granted",
          click: function () {
            toggleNotificationInMainWindow(this.checked);
          },
        })
      );

      // Auto-start toggle menu item
      const autoStartMenuItem = new nw.MenuItem({
        label: "开机自启",
        type: "checkbox",
        checked: false, // Will be updated after initialization
        click: function () {
          toggleAutoStart(this);
        },
      });
      menu.append(autoStartMenuItem);

      // Initialize auto-start menu item state
      isAutoStartEnabled().then((enabled) => {
        autoStartMenuItem.checked = enabled;
      });

      // Separator
      menu.append(
        new nw.MenuItem({
          type: "separator",
        })
      );

      // Show/Hide main window menu item
      menu.append(
        new nw.MenuItem({
          label: "显示/隐藏",
          click: function () {
            toggleMainWindow();
          },
        })
      );

      // Separator
      menu.append(
        new nw.MenuItem({
          type: "separator",
        })
      );

      // Reload main window menu item
      menu.append(
        new nw.MenuItem({
          label: "重新加载",
          click: function () {
            reloadMainWindow();
          },
        })
      );

      // Separator
      menu.append(
        new nw.MenuItem({
          type: "separator",
        })
      );

      // Quit menu item
      menu.append(
        new nw.MenuItem({
          label: "退出",
          click: function () {
            quitApplication();
          },
        })
      );

      // Assign menu to tray
      tray.menu = menu;

      // Handle tray click (show/hide main window)
      tray.on("click", function () {
        toggleMainWindow();
      });

      console.log("[Main] System tray initialized successfully");
      return true;
    } catch (error) {
      console.error("[Main] Failed to initialize system tray:", error);
      return false;
    }
  }

  // Open main application window
  function openMainWindow() {
    try {
      // Open the main application window
      nw.Window.open(
        APP_CONFIG.remoteUrl,
        APP_CONFIG.windowOptions,
        function (win) {
          mainWindow = win;

          // Handle window events
          setupMainWindowEvents(win);
          console.log("[Main] Main application window opened successfully");
        }
      );

      return true;
    } catch (error) {
      console.error("[Main] Failed to open main window:", error);
      return false;
    }
  }

  // Setup main window event handlers
  function setupMainWindowEvents(win) {
    // Handle window close event (minimize to tray instead of closing)
    win.on("close", function () {
      if (isQuitting) {
        // Actually close the window if we're quitting
        this.close(true);
      } else {
        // Hide window instead of closing
        this.hide();
      }
    });

    // Handle minimize event
    win.on("minimize", function () {
      // Hide window when minimized
      this.hide();
    });

    // Handle window focus
    win.on("focus", function () {
      console.log("[Main] Main window focused");
    });

    // Handle window blur
    win.on("blur", function () {
      console.log("[Main] Main window blurred");
    });
  }

  // Toggle main window visibility
  function toggleMainWindow() {
    if (!mainWindow) {
      // If main window doesn't exist, create it
      openMainWindow();
      return;
    }

    try {
      // Check if window is currently visible
      if (
        mainWindow.window &&
        mainWindow.window.document.visibilityState === "visible"
      ) {
        // Window is visible, hide it
        mainWindow.hide();
        console.log("[Main] Main window hidden");
      } else {
        // Window is hidden, show it
        mainWindow.show();
        mainWindow.focus();
        console.log("[Main] Main window shown and focused");
      }
    } catch (error) {
      // Fallback: just show the window
      console.log("[Main] Error checking window state, showing window:", error);
      mainWindow.show();
      mainWindow.focus();
    }
  }

  // Reload main window
  function reloadMainWindow() {
    if (mainWindow) {
      try {
        mainWindow.reload();
        console.log("[Main] Main window reloaded");
      } catch (error) {
        console.error("[Main] Failed to reload main window:", error);
      }
    }
  }

  // Perform logout in main window
  function performLogoutInMainWindow() {
    if (mainWindow && mainWindow.window) {
      try {
        // Check if the logout interface is available
        const nwTrayInterface = mainWindow.window.nwTrayInterface;
        if (
          nwTrayInterface &&
          typeof nwTrayInterface.performLogout === "function"
        ) {
          const success = nwTrayInterface.performLogout();
          if (success) {
            console.log("[Main] Logout performed successfully");
          } else {
            console.log("[Main] Logout failed - no logout element found");
          }
        } else {
          console.log("[Main] Logout interface not available in main window");
        }
      } catch (error) {
        console.error("[Main] Failed to perform logout:", error);
      }
    } else {
      console.log("[Main] Main window not available for logout");
    }
  }

  // Toggle notification in main window
  function toggleNotificationInMainWindow(checked) {
    if (mainWindow && mainWindow.window) {
      try {
        // Check if the notification interface is available
        const nwTrayInterface = mainWindow.window.nwTrayInterface;
        if (
          nwTrayInterface &&
          typeof nwTrayInterface.toggleNotification === "function"
        ) {
          nwTrayInterface.toggleNotification(checked);
          console.log("[Main] Notification toggled successfully");
        } else {
          console.log(
            "[Main] Notification interface not available in main window"
          );
        }
      } catch (error) {
        console.error("[Main] Failed to toggle notification:", error);
      }
    } else {
      console.log("[Main] Main window not available for notification toggle");
    }
  }

  // Auto-start related functions
  async function isAutoStartEnabled() {
    try {
      return await autoLauncher.isEnabled();
    } catch (error) {
      console.error("[Main] Failed to check auto-start status:", error);
      return false;
    }
  }

  async function enableAutoStart() {
    try {
      await autoLauncher.enable();
      console.log("[Main] Auto-start enabled successfully");
      return true;
    } catch (error) {
      console.error("[Main] Failed to enable auto-start:", error);
      return false;
    }
  }

  async function disableAutoStart() {
    try {
      await autoLauncher.disable();
      console.log("[Main] Auto-start disabled successfully");
      return true;
    } catch (error) {
      console.error("[Main] Failed to disable auto-start:", error);
      return false;
    }
  }

  async function toggleAutoStart(menuItem) {
    const currentState = await isAutoStartEnabled();
    let success = false;

    if (currentState) {
      success = await disableAutoStart();
    } else {
      success = await enableAutoStart();
    }

    if (success) {
      // Update menu item state
      menuItem.checked = !currentState;
    }
  }

  // Update notification menu item label (called from inject.js)
  function updateNotificationMenuItemLabel(state) {}

  // Quit application
  function quitApplication() {
    isQuitting = true;
    console.log("[Main] Quitting application...");

    // Clean up tray
    if (tray) {
      try {
        tray.remove();
        tray = null;
        console.log("[Main] Tray removed");
      } catch (error) {
        console.error("[Main] Error removing tray:", error);
      }
    }

    // Close main window
    if (mainWindow) {
      try {
        mainWindow.close(true);
        console.log("[Main] Main window closed");
      } catch (error) {
        console.error("[Main] Error closing main window:", error);
      }
    }

    // Close the application
    nw.App.quit();
  }

  // Initialize the application
  function initialize() {
    console.log("[Main] Initializing TeeworldsCN Admin application...");

    // Initialize tray first
    initializeTray();
    openMainWindow();

    // Handle launcher window close event
    const launcherWindow = nw.Window.get();
    launcherWindow.on("close", function () {
      if (isQuitting) {
        this.close(true);
      } else {
        // Just hide the launcher window
        this.hide();
      }
    });

    nw.global.localStorage = localStorage;

    // Set up global function for inject.js to call when notification state changes
    nw.global.updateNotificationMenuItem = updateNotificationMenuItemLabel;

    // Handle reopen event (when user clicks dock/taskbar icon while app is running)
    nw.App.onOpen.addListener(function () {
      console.log("[Main] App open event triggered");

      // If main window exists and is hidden, show it
      if (mainWindow) {
        try {
          // Check if window is hidden or minimized
          if (
            !mainWindow.window ||
            mainWindow.window.document.visibilityState !== "visible"
          ) {
            // Window is hidden, show and focus it
            mainWindow.show();
            mainWindow.focus();
            console.log(
              "[Main] Main window shown and focused due to open event"
            );
          } else {
            // Window is already visible, just focus it
            mainWindow.focus();
            console.log("[Main] Main window focused due to open event");
          }
        } catch (error) {
          // Fallback: just show and focus the window
          console.log(
            "[Main] Error checking window state on open, showing window:",
            error
          );
          mainWindow.show();
          mainWindow.focus();
        }
      } else {
        // If main window doesn't exist, create it
        console.log(
          "[Main] Main window doesn't exist on open, creating new window"
        );
        openMainWindow();
      }
    });
  }

  initialize();
})();
