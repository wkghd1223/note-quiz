import { vi } from "vitest";

// The suite runs in Node. Provide the small DOM construction surface of the
// shared writer and pass its result to the real score model and timeline.
export function stubScoreDocument() {
  class Node {
    children: Node[] = [];
    private attributes = new Map<string, string>();
    textContent = "";
    constructor(readonly localName: string) {}
    setAttribute(key: string, value: string) {
      this.attributes.set(key, value);
    }
    hasAttribute(key: string) {
      return this.attributes.has(key);
    }
    getAttribute(key: string) {
      return this.attributes.get(key) ?? null;
    }
    appendChild(child: Node) {
      this.children.push(child);
    }
    insertBefore(child: Node, next: Node) {
      this.children.splice(this.children.indexOf(next), 0, child);
    }
  }
  vi.stubGlobal("document", {
    implementation: {
      createDocument: (_namespace: null, root: string) => ({
        documentElement: new Node(root),
        createElement: (tag: string) => new Node(tag),
        getElementsByTagName: () => [],
      }),
    },
  });
}
