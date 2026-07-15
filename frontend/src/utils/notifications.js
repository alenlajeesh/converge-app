import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { getCurrentWindow } from "@tauri-apps/api/window";

let permissionGranted = false;

export async function initNotifications() {
  try {
    permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const result = await requestPermission();
      permissionGranted = result === "granted";
    }
  } catch (err) {
    console.error("Notification permission error:", err);
  }
  return permissionGranted;
}

// Fires a native Windows toast ONLY when the window is unfocused
// (minimized to tray, or another app has focus). When the window is
// focused, the in-app toast (NotificationToast) already covers it —
// firing both would be redundant/annoying.
export async function notifyIfUnfocused(title, body) {
  try {
    const win = getCurrentWindow();
    const focused = await win.isFocused();
    if (focused) return false;

    if (!permissionGranted) {
      permissionGranted = await isPermissionGranted();
    }
    if (!permissionGranted) return false;

    sendNotification({ title, body });
    return true;
  } catch (err) {
    console.error("Notification error:", err);
    return false;
  }
}