import { T } from "./tokens.js";

export const card = {
  background:   T.surface,
  border:       `1px solid ${T.border}`,
  borderRadius: 10,
};

export const lb10 = {
  fontSize:      10,
  fontWeight:    600,
  color:         T.muted,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
};

export const mc = {
  background:   T.s2,
  borderRadius: 6,
  padding:      "8px 10px",
};

export const inp = {
  padding:      "6px 9px",
  border:       `1px solid ${T.border2}`,
  borderRadius: 6,
  fontSize:     12,
  background:   T.s2,
  color:        T.text,
  fontFamily:   "inherit",
  outline:      "none",
  width:        "100%",
};

export const solidBtn = (bg = T.text, color = "#fff") => ({
  background:  bg,
  color,
  border:      "none",
  borderRadius: 7,
  padding:     "6px 14px",
  fontSize:    11,
  fontWeight:  700,
  cursor:      "pointer",
  fontFamily:  "inherit",
  display:     "flex",
  alignItems:  "center",
  gap:         4,
  transition:  "opacity 0.15s",
});

export const ghostBtn = {
  background:   "transparent",
  border:       `1px solid ${T.border2}`,
  borderRadius: 5,
  padding:      "4px 9px",
  cursor:       "pointer",
  display:      "flex",
  alignItems:   "center",
  gap:          4,
  color:        T.muted,
  fontSize:     11,
  fontFamily:   "inherit",
  transition:   "opacity 0.15s",
};

export const mono = {
  fontFamily: "'DM Mono', 'JetBrains Mono', monospace",
  fontWeight: 700,
};
