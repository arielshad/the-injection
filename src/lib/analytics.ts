/**
 * Umami's tracker, present only when the build turns analytics on (see
 * src/components/Analytics.astro). Everything here is a no-op without it.
 */
declare global {
  interface Window {
    umami?: { track: (name: string, data?: Record<string, string>) => Promise<unknown> };
  }
}

export function track(name: string, data?: Record<string, string>) {
  window.umami?.track(name, data)?.catch(() => {});
}

/** `data-track="name"` plus `data-track-foo="bar"` → name, { foo: "bar" }. */
export function trackedEvent(el: Element): { name: string; data: Record<string, string> } | null {
  const name = el.getAttribute("data-track");
  if (!name) return null;
  const data: Record<string, string> = {};
  for (const attr of el.getAttributeNames()) {
    const m = attr.match(/^data-track-(.+)$/);
    if (m) data[m[1]] = el.getAttribute(attr) ?? "";
  }
  return { name, data };
}
