const CONTAINER_ID = "prompttrace-container";

const SELECTORS = [
  'react-app[app-name="react-code-view"]',
  '[data-testid="code-view"]',
  "#repo-content-turbo-frame",
  "#repo-content-pjax-container",
  "main",
];

export async function waitForFileView(timeoutMs = 3000): Promise<HTMLElement | null> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const check = () => {
      for (const sel of SELECTORS) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) return resolve(el);
      }
      if (Date.now() > deadline) return resolve(null);
      setTimeout(check, 100);
    };
    check();
  });
}

export interface Mounted {
  container: HTMLElement;
  nativeView: HTMLElement;
  unmount: () => void;
}

export function insertContainerAbove(nativeView: HTMLElement): Mounted {
  removeExistingContainer();
  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  nativeView.parentElement?.insertBefore(container, nativeView);
  const originalDisplay = nativeView.style.display;
  const unmount = () => {
    container.remove();
    nativeView.style.display = originalDisplay;
  };
  return { container, nativeView, unmount };
}

export function setNativeViewVisible(m: Mounted, visible: boolean): void {
  m.nativeView.style.display = visible ? "" : "none";
}

function removeExistingContainer(): void {
  document.getElementById(CONTAINER_ID)?.remove();
}
