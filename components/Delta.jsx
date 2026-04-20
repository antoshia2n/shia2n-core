import { TrendingUp, TrendingDown } from "lucide-react";
import { T, fmt } from "../tokens.js";

export function Delta({ now, prev, size = 11, format = fmt }) {
  if (!prev || now === prev) return null;
  const diff = now - prev;
  const pos  = diff > 0;
  const pct  = Math.round(Math.abs(diff) / Math.abs(prev) * 100);
  return (
    <span style={{ fontSize: size, fontWeight: 600, color: pos ? T.green : T.red, display: "inline-flex", alignItems: "center", gap: 2 }}>
      {pos ? <TrendingUp size={size} /> : <TrendingDown size={size} />}
      {pos ? "+" : ""}{format(diff)}
      <span style={{ fontSize: size - 1, fontWeight: 400, color: T.muted, marginLeft: 1 }}>({pct}%)</span>
    </span>
  );
}
