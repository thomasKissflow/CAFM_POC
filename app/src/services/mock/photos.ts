// Illustrative placeholder images (drawn SVG, clearly not photographs) used when the demo
// runs without a camera. Real photos from the device camera replace these at runtime.
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function thermostatPhoto(temp: number): string {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#d9dcd8"/>
  <rect x="110" y="55" width="180" height="190" rx="14" fill="#f4f5f2" stroke="#9aa0a4" stroke-width="3"/>
  <rect x="135" y="85" width="130" height="80" rx="6" fill="#1e2a2a"/>
  <text x="200" y="142" font-family="monospace" font-size="46" fill="#ff7a3d" text-anchor="middle">${temp}°C</text>
  <text x="200" y="190" font-family="sans-serif" font-size="14" fill="#555" text-anchor="middle">SET 22°C · FAN HIGH</text>
  <circle cx="165" cy="220" r="10" fill="#c8ccc9"/><circle cx="235" cy="220" r="10" fill="#c8ccc9"/>
  <text x="200" y="285" font-family="sans-serif" font-size="12" fill="#6b7178" text-anchor="middle">Illustration · demo placeholder</text>
</svg>`);
}

export function componentPhoto(kind: "before" | "after"): string {
  const ok = kind === "after";
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#cfd3cf"/>
  <rect x="60" y="120" width="280" height="26" fill="#8a9196"/>
  <rect x="170" y="70" width="60" height="50" rx="4" fill="${ok ? "#2f6f4f" : "#7c3b2a"}"/>
  <text x="200" y="100" font-family="monospace" font-size="13" fill="#fff" text-anchor="middle">ACT</text>
  <circle cx="200" cy="133" r="16" fill="#5b6166"/>
  <text x="200" y="200" font-family="sans-serif" font-size="16" fill="#1b1e22" text-anchor="middle">${ok ? "New actuator · valve strokes 0–100%" : "Actuator: no stroke on demand"}</text>
  <text x="200" y="285" font-family="sans-serif" font-size="12" fill="#5b6166" text-anchor="middle">Illustration · demo placeholder (${kind})</text>
</svg>`);
}
