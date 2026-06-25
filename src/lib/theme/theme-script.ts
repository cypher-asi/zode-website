export const THEME_STORAGE_KEY = "grid-theme";

/**
 * Inline script injected before hydration so `data-theme` is set on
 * `<html>` from the persisted preference before first paint. Prevents a
 * light/dark flash on load. Dark is the default unless the user has
 * explicitly chosen light; system preference is intentionally ignored.
 * Kept as a plain string with no external references so it can run
 * standalone.
 */
export const themeInitScript = `(function () {
  try {
    var key = "${THEME_STORAGE_KEY}";
    var stored = localStorage.getItem(key);
    var theme = stored === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();`;
