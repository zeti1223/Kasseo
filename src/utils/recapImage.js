/**
 * Renders a single recap card to a shareable PNG, drawn directly on an
 * offscreen canvas (no DOM screenshot library required).
 */

const WIDTH = 1080;
const HEIGHT = 1350;

function wrapLines(ctx, text, maxWidth) {
  const words = String(text ?? "").split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCentered(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = wrapLines(ctx, text, maxWidth);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
  return lines.length * lineHeight;
}

/**
 * @param {Object} card - { icon, eyebrow, value, label, subtitle, colorFrom, colorTo }
 * @param {Object} [meta] - { fundName, brand }
 * @returns {Promise<Blob>}
 */
export function renderRecapCardToBlob(card, meta = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  const cx = WIDTH / 2;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, card.colorFrom || "#8A5FBF");
  grad.addColorStop(1, card.colorTo || "#C8A5FC");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Soft dark overlay so white text stays readable regardless of the
  // chosen gradient colors.
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Decorative soft circles
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.beginPath();
  ctx.arc(WIDTH * 0.85, HEIGHT * 0.12, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(WIDTH * 0.1, HEIGHT * 0.9, 260, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";

  // Fund name (top)
  if (meta.fundName) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "600 34px 'Segoe UI', Arial, sans-serif";
    drawCentered(ctx, meta.fundName, cx, 130, WIDTH - 200, 42);
  }

  // Eyebrow label
  if (card.eyebrow) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "700 30px 'Segoe UI', Arial, sans-serif";
    drawCentered(ctx, card.eyebrow.toUpperCase(), cx, HEIGHT * 0.34, WIDTH - 180, 40);
  }

  // Icon (emoji, works cross-platform without extra font loading)
  if (card.emoji) {
    ctx.font = "150px sans-serif";
    ctx.fillText(card.emoji, cx, HEIGHT * 0.34 - 130);
  }

  // Big value
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 108px 'Segoe UI', Arial, sans-serif";
  const valueHeight = drawCentered(ctx, card.value, cx, HEIGHT * 0.48, WIDTH - 140, 110);

  // Label under the value
  if (card.label) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "600 40px 'Segoe UI', Arial, sans-serif";
    drawCentered(ctx, card.label, cx, HEIGHT * 0.48 + valueHeight / 2 + 60, WIDTH - 160, 48);
  }

  // Subtitle
  if (card.subtitle) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "500 32px 'Segoe UI', Arial, sans-serif";
    drawCentered(ctx, card.subtitle, cx, HEIGHT * 0.66, WIDTH - 200, 42);
  }

  // Brand footer
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.font = "700 30px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(meta.brand || "Kasseo", cx, HEIGHT - 70);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export failed"));
    }, "image/png");
  });
}

/**
 * Renders a recap card and triggers a browser download of the PNG.
 * @param {Object} card
 * @param {Object} [meta]
 * @param {string} [filename]
 */
export async function downloadRecapCardImage(card, meta = {}, filename = "kasseo-recap.png") {
  const blob = await renderRecapCardToBlob(card, meta);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
