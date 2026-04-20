export const T = {
  bg:      "#F0EEE7",
  surface: "#FAFAF7",
  s2:      "#F4F2EB",
  text:    "#1C1B18",
  muted:   "#7A7769",
  faint:   "#B5B2A8",
  border:  "#E5E2D9",
  border2: "#D4D0C6",
  blue:    "#2F54C8",
  green:   "#256E45",
  amber:   "#9A6010",
  red:     "#B8302A",
};

export const fmt = (n) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency", currency: "JPY", minimumFractionDigits: 0,
  }).format(n);

export const fmtK = (n) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M`
  : n >= 1000  ? `${Math.round(n / 1000)}K`
  : `${n}`;

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const p2 = (n) => String(n).padStart(2, "0");
export const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
