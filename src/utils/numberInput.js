/**
 * Prevents non-numeric characters on keydown for number inputs.
 * Blocks 'e', 'E', '+', '-', letters, and special characters.
 *
 * @param {KeyboardEvent} event
 * @param {boolean} [allowDecimal=true] - Whether to allow a decimal point/comma.
 */
export function handleNumberKeyDown(event, allowDecimal = true) {
  // Allow navigation / control / shortcut keys
  if (
    [
      "Backspace",
      "Delete",
      "Tab",
      "Escape",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ].includes(event.key) ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) {
    return;
  }

  // Allow decimal point or comma (if allowDecimal is true and not already typed)
  if (allowDecimal && (event.key === "." || event.key === ",")) {
    const target = event.target;
    const val = target?.value ?? "";
    if (val.includes(".")) {
      event.preventDefault();
      return;
    }
    // If comma was pressed, convert it to dot so it works consistently across browsers
    if (event.key === ",") {
      event.preventDefault();
      let start = target.value?.length ?? 0;
      let end = target.value?.length ?? 0;
      try {
        start = target.selectionStart ?? start;
        end = target.selectionEnd ?? end;
      } catch {
        // selectionStart not supported on some input types
      }
      const cur = target.value || "";
      target.value = cur.slice(0, start) + "." + cur.slice(end);
      target.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    return;
  }

  // Allow digits 0-9
  if (/^[0-9]$/.test(event.key)) {
    return;
  }

  // Prevent any other key (letters like e, E, a-z, +, -, symbols)
  event.preventDefault();
}

/**
 * Sanitizes a numeric string value by removing disallowed characters.
 *
 * @param {string|number} value
 * @param {boolean} [allowDecimal=true]
 * @returns {string}
 */
export function sanitizeNumberInput(value, allowDecimal = true) {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (allowDecimal) {
    str = str.replace(/,/g, ".");
    str = str.replace(/[^0-9.]/g, "");
    const parts = str.split(".");
    if (parts.length > 2) {
      str = parts[0] + "." + parts.slice(1).join("");
    }
  } else {
    str = str.replace(/[^0-9]/g, "");
  }
  return str;
}

/**
 * Handles paste events on numeric inputs to strip out non-numeric characters.
 *
 * @param {ClipboardEvent} event
 * @param {boolean} [allowDecimal=true]
 */
export function handleNumberPaste(event, allowDecimal = true) {
  const pasteData =
    (event.clipboardData || window.clipboardData)?.getData("text") || "";
  const sanitized = sanitizeNumberInput(pasteData, allowDecimal);

  if (pasteData !== sanitized) {
    event.preventDefault();
    const target = event.target;
    if (!target) return;

    let start = target.value?.length ?? 0;
    let end = target.value?.length ?? 0;
    try {
      start = target.selectionStart ?? start;
      end = target.selectionEnd ?? end;
    } catch {
      // selectionStart not supported on some input types
    }

    const currentVal = target.value || "";
    const nextVal = sanitizeNumberInput(
      currentVal.slice(0, start) + sanitized + currentVal.slice(end),
      allowDecimal,
    );
    target.value = nextVal;
    target.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
