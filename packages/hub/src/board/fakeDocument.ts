type Listener = (event: { readonly preventDefault: () => void }) => void;

export class FakeElement {
  readonly tagName: string;
  className = "";
  type = "";
  disabled = false;
  rows = 0;
  placeholder = "";
  value = "";
  children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Listener[]>();
  private text = "";

  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
  }

  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.text = value;
    this.children = [];
  }

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children = [...children];
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ preventDefault: () => undefined });
    }
  }

  all(): readonly FakeElement[] {
    return [this, ...this.children.flatMap((child) => child.all())];
  }
}

export function installFakeDocument(): { readonly created: FakeElement[] } {
  const created: FakeElement[] = [];

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: (tag: string) => {
        const node = new FakeElement(tag);

        created.push(node);

        return node;
      },
    },
  });

  return { created };
}
