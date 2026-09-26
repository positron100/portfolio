const N = 24;

/** Static spoke-ring loader; styled by the `.cor-*` rules in index.css. */
const SPOKES = `<svg xmlns="http://www.w3.org/2000/svg" class="cor" viewBox="0 0 64 64" width="96" height="96" fill="none" role="img" aria-label="Loading">${Array.from(
  { length: N },
  (_, i) => {
    const a = (i * 360) / N;
    const rest = (0.65 + 0.35 * Math.cos((a * Math.PI) / 180)).toFixed(4);
    return `<g class="cor-spoke" style="--a:${a}deg"><rect class="cor-tip" x="31" y="2" width="2" height="19.1" rx="1" style="--i:${i};--rest:${rest}"/></g>`;
  },
).join("")}<circle class="cor-hub" cx="32" cy="32" r="5.8"/></svg>`;

const RIPPLE = `<svg xmlns="http://www.w3.org/2000/svg" class="ht" viewBox="0 0 64 64" width="96" height="96" fill="none" role="img" aria-label="Loading"><defs><clipPath id="ht-disc"><circle cx="32" cy="32" r="32"/></clipPath><pattern id="ht-grid" width="6.4" height="6.4" patternUnits="userSpaceOnUse"><circle cx="3.2" cy="3.2" r="1.15" fill="currentColor"/></pattern><mask id="ht-ring-a"><circle class="ht-wave" cx="32" cy="32" r="0" fill="none" stroke="#fff" stroke-width="7"/></mask><mask id="ht-ring-b"><circle class="ht-wave ht-late" cx="32" cy="32" r="0" fill="none" stroke="#fff" stroke-width="7"/></mask></defs><g clip-path="url(#ht-disc)"><rect class="ht-base" x="0" y="0" width="64" height="64" fill="url(#ht-grid)"/><rect x="0" y="0" width="64" height="64" fill="url(#ht-grid)" mask="url(#ht-ring-a)"/><rect x="0" y="0" width="64" height="64" fill="url(#ht-grid)" mask="url(#ht-ring-b)"/></g><circle class="ht-rim" cx="32" cy="32" r="31.5"/></svg>`;

/** One of the two loader styles, chosen at random. */
export const randomLoader = () => (Math.random() < 0.5 ? SPOKES : RIPPLE);
