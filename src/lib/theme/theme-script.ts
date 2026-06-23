export const THEME_STORAGE_KEY = "grid-theme";

/**
 * Inline script injected before hydration so `data-theme` is set on
 * `<html>` from the persisted preference (or system preference) before
 * first paint. Prevents a light/dark flash on load. Kept as a plain
 * string with no external references so it can run standalone.
 */
export const themeInitScript = `(function () {
  try {
    var key = "${THEME_STORAGE_KEY}";
    var stored = localStorage.getItem(key);
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();`;
