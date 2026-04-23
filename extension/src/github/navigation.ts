export const NAV_EVENT = "prompttrace:navigate";

let installed = false;

export function installNavigationListener(): void {
  if (installed) return;
  installed = true;
  const fire = () => window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: { url: location.href } }));
  for (const m of ["pushState", "replaceState"] as const) {
    const orig = history[m];
    history[m] = function (this: History, ...args: Parameters<typeof orig>) {
      const ret = orig.apply(this, args as any);
      fire();
      return ret;
    } as typeof orig;
  }
  window.addEventListener("popstate", fire);
}
