import { installNavigationListener, NAV_EVENT } from "./github/navigation.js";
import { isPrompttraceBlobUrl } from "./github/url.js";
import { Controller } from "./controller.js";

let active: Controller | null = null;

function onNav(url: string): void {
  active?.dispose();
  active = null;
  if (!isPrompttraceBlobUrl(url)) return;
  active = new Controller(url);
  active.run().catch((e) => console.error("[show-me-your-prompt]", e));
}

installNavigationListener();
window.addEventListener(NAV_EVENT, (e) => onNav((e as CustomEvent).detail.url));
onNav(location.href);
