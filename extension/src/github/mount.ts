const CONTAINER_ID = "prompttrace-container";

const SELECTORS = [
  '[data-testid="code-view"]',
  'react-app[app-name="react-code-view"]',
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

export function mountIntoFileView(codeView: HTMLElement): Mounted {
  removeExistingContainer();
  const parent = codeView.parentElement;
  if (!parent) throw new Error("code-view has no parent");
  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  parent.insertBefore(container, codeView);
  const originalDisplay = codeView.style.display;
  codeView.style.display = "none";
  const unmount = () => {
    container.remove();
    codeView.style.display = originalDisplay;
  };
  return { container, nativeView: codeView, unmount };
}

export function setNativeViewVisible(m: Mounted, visible: boolean): void {
  m.nativeView.style.display = visible ? "" : "none";
}

function removeExistingContainer(): void {
  document.getElementById(CONTAINER_ID)?.remove();
}
