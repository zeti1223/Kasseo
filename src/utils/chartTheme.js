// Shared Chart.js styling: currency-formatted tooltips and a dark-mode-aware grid.
import { formatCompactNumber } from "./format";

export function formatMoney(value, currency) {
  const amount = formatCompactNumber(value);
  return currency ? `${amount} ${currency}` : amount;
}

function tooltipBase(currency) {
  return {
    mode: "index",
    intersect: false,
    backgroundColor: "rgba(17, 17, 27, 0.92)",
    titleColor: "#fff",
    bodyColor: "#e5e7eb",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    padding: 10,
    boxPadding: 4,
    displayColors: true,
    callbacks: {
      label(ctx) {
        const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : "";
        return `${label}${formatMoney(ctx.parsed.y ?? ctx.parsed, currency)}`;
      },
    },
  };
}

// Options for line/bar charts that plot a numeric y-axis over time or
// category labels on the x-axis.
export function cartesianOptions(currency, extra = {}) {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const gridColor = isDark
    ? "rgba(255, 255, 255, 0.06)"
    : "rgba(0, 0, 0, 0.05)";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, font: { size: 11 }, color: tickColor },
      },
      tooltip: tooltipBase(currency),
      ...(extra.plugins || {}),
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: tickColor, font: { size: 10 } },
        ...(extra.scales?.x || {}),
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: tickColor,
          font: { size: 10 },
          callback: (v) => formatMoney(v, currency),
        },
        ...(extra.scales?.y || {}),
      },
    },
    ...extra.rest,
  };
}

// Options for doughnut/pie charts.
export function radialOptions(currency) {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const tickColor = isDark ? "#9ca3af" : "#6b7280";

  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, font: { size: 11 }, color: tickColor },
      },
      tooltip: {
        backgroundColor: "rgba(17, 17, 27, 0.92)",
        titleColor: "#fff",
        bodyColor: "#e5e7eb",
        borderColor: "rgba(255, 255, 255, 0.08)",
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label(ctx) {
            const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
            const pct = total ? Math.round((ctx.parsed / total) * 100) : 0;
            return `${ctx.label}: ${formatMoney(ctx.parsed, currency)} (${pct}%)`;
          },
        },
      },
    },
  };
}

// Vertical gradient for line-chart fills; falls back to a flat color
// before the canvas is ready.
export function areaGradient(ctx, chartArea, colorHex, alpha = 0.25) {
  if (!chartArea) return colorHex;
  const gradient = ctx.createLinearGradient(
    0,
    chartArea.top,
    0,
    chartArea.bottom,
  );
  const rgb = hexToRgb(colorHex);
  gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  return gradient;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
}
