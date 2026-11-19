import { MAX_SCORE_ELEMENTS } from "./xml";

/** Both converters write the same editable score-partwise tree. Count generated
 * elements while building it so small binary inputs cannot expand indefinitely. */
export function createScoreWriter() {
  const doc = document.implementation.createDocument(null, "score-partwise");
  const root = doc.documentElement;
  root.setAttribute("version", "4.0");
  const partList = doc.createElement("part-list");
  root.appendChild(partList);
  let count = 2;

  function add(
    parent: Element,
    name: string,
    text?: string | number,
    attributes?: Record<string, string | number>,
  ) {
    if (++count > MAX_SCORE_ELEMENTS) throw new Error("fileTooLarge");
    const el = doc.createElement(name);
    for (const [key, val] of Object.entries(attributes ?? {}))
      el.setAttribute(key, String(val));
    if (text !== undefined) el.textContent = String(text);
    if (parent === root && name !== "part") root.insertBefore(el, partList);
    else parent.appendChild(el);
    return el;
  }

  function part(id: string, name: string) {
    const description = add(partList, "score-part", undefined, { id });
    add(description, "part-name", name);
    return add(root, "part", undefined, { id });
  }
  return { document: doc, root, add, part };
}
