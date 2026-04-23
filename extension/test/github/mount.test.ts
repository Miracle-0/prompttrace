import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { mountIntoFileView, setNativeViewVisible, waitForFileView } from "../../src/github/mount.js";

beforeEach(() => {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div class="repo-layout">
        <aside id="file-tree">tree</aside>
        <div class="content-cell">
          <div data-testid="code-view">original code view</div>
        </div>
      </div>
    </body></html>`,
  );
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
});

describe("mountIntoFileView", () => {
  it("inserts container as sibling before codeView in same parent", () => {
    const codeView = document.querySelector<HTMLElement>('[data-testid="code-view"]')!;
    const parent = codeView.parentElement!;
    const m = mountIntoFileView(codeView);
    expect(m.container.parentElement).toBe(parent);
    expect(parent.firstElementChild).toBe(m.container);
    expect(m.container.nextElementSibling).toBe(codeView);
  });

  it("hides codeView on mount", () => {
    const codeView = document.querySelector<HTMLElement>('[data-testid="code-view"]')!;
    mountIntoFileView(codeView);
    expect(codeView.style.display).toBe("none");
  });

  it("unmount removes container and restores codeView display", () => {
    const codeView = document.querySelector<HTMLElement>('[data-testid="code-view"]')!;
    codeView.style.display = "block";
    const m = mountIntoFileView(codeView);
    m.unmount();
    expect(document.getElementById("prompttrace-container")).toBeNull();
    expect(codeView.style.display).toBe("block");
  });

  it("removes any pre-existing container before mounting a new one", () => {
    const codeView = document.querySelector<HTMLElement>('[data-testid="code-view"]')!;
    const stale = document.createElement("div");
    stale.id = "prompttrace-container";
    stale.textContent = "stale";
    document.body.appendChild(stale);
    const m = mountIntoFileView(codeView);
    expect(m.container.textContent).toBe("");
    expect(document.querySelectorAll("#prompttrace-container").length).toBe(1);
  });

  it("throws when codeView has no parent", () => {
    const orphan = document.createElement("div");
    orphan.setAttribute("data-testid", "code-view");
    expect(() => mountIntoFileView(orphan)).toThrow();
  });
});

describe("setNativeViewVisible", () => {
  it("toggles codeView display between '' and 'none'", () => {
    const codeView = document.querySelector<HTMLElement>('[data-testid="code-view"]')!;
    const m = mountIntoFileView(codeView);
    setNativeViewVisible(m, true);
    expect(codeView.style.display).toBe("");
    setNativeViewVisible(m, false);
    expect(codeView.style.display).toBe("none");
  });
});

describe("waitForFileView", () => {
  it("resolves to the codeView element when present", async () => {
    const el = await waitForFileView(100);
    expect(el).not.toBeNull();
    expect(el?.getAttribute("data-testid")).toBe("code-view");
  });

  it("resolves to null when no matching element exists within timeout", async () => {
    document.querySelector('[data-testid="code-view"]')!.remove();
    const el = await waitForFileView(50);
    expect(el).toBeNull();
  });

  it("prefers react-app[app-name=code-view] when both it and #repo-content-pjax-container exist", async () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>
        <main>
          <div id="repo-content-pjax-container">
            <react-app app-name="code-view">ra</react-app>
          </div>
        </main>
      </body></html>`,
    );
    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
    (globalThis as any).HTMLElement = dom.window.HTMLElement;
    const el = await waitForFileView(100);
    expect(el?.tagName.toLowerCase()).toBe("react-app");
    expect(el?.getAttribute("app-name")).toBe("code-view");
  });

  it("falls back to [data-testid=code-view] when react-app is absent", async () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>
        <main>
          <div class="content-cell">
            <div data-testid="code-view">testid</div>
          </div>
        </main>
      </body></html>`,
    );
    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
    (globalThis as any).HTMLElement = dom.window.HTMLElement;
    const el = await waitForFileView(100);
    expect(el?.getAttribute("data-testid")).toBe("code-view");
  });

  it("does NOT fall back to #repo-content-pjax-container", async () => {
    document.querySelector('[data-testid="code-view"]')!.remove();
    const pjax = document.createElement("div");
    pjax.id = "repo-content-pjax-container";
    document.body.appendChild(pjax);
    const el = await waitForFileView(50);
    expect(el).toBeNull();
  });

  it("does NOT fall back to document.querySelector('main')", async () => {
    document.querySelector('[data-testid="code-view"]')!.remove();
    const main = document.createElement("main");
    main.id = "should-not-match";
    document.body.appendChild(main);
    const el = await waitForFileView(50);
    expect(el).toBeNull();
  });
});
