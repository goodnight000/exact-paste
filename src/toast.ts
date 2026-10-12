// Presentation for smart-paste feedback. Behavior (what each button does, when it is trusted) stays in paste.ts.
export type Tone = "pending" | "choice" | "done" | "warn" | "info";
export type ActionKind = "pick" | "saved" | "undo" | "original" | "jev";
export type ToastAction = { kind: ActionKind; label: string; onClick: (event: MouseEvent) => void };

const STYLE_ID = "exact-paste-style";
const SVG = "http://www.w3.org/2000/svg";
const ICONS: Record<string, string[]> = {
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  close: ["M7 7l10 10M17 7L7 17"],
  undo: ["M9 14L4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
  original: ["M9 4.5H6.5A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15", "M9 3h6v3H9z"],
  jev: ["M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z", "M18.5 16v4M16.5 18h4"],
  warn: ["M10.3 4.7L3 17.4a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.7 4.7a2 2 0 0 0-3.4 0z", "M12 9.5v4", "M12 17h.01"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v5", "M12 7.5h.01"],
  choice: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.5", "M12 17h.01"],
  enter: ["M19 5v6a3 3 0 0 1-3 3H6", "M10 10l-4 4 4 4"],
  saved: ["M7 3.5h10a1 1 0 0 1 1 1V20.5l-6-4-6 4V4.5a1 1 0 0 1 1-1z"],
};

// Scoped by host id (the leaving panel gets its own id so it keeps every style while it fades), with explicit resets so page CSS cannot restyle the panel.
// Shortcut feedback never animates in: it is keyboard-driven and frequent, so it appears and changes in the same frame.
const H = ":is(#exact-paste-toast,#exact-paste-leaving)";
const CSS = `
${H}{--ep-bg:#fff;--ep-ink:#17201b;--ep-dim:#5b6660;--ep-line:#e3e7e4;--ep-hover:#f2f5f3;--ep-accent:#22684f;--ep-warn:#a1502a;
  all:initial;position:fixed;z-index:2147483647;box-sizing:border-box;display:block;min-width:220px;max-width:min(380px,calc(100vw - 16px));
  background:var(--ep-bg);color:var(--ep-ink);border:1px solid var(--ep-line);border-radius:12px;box-shadow:0 1px 2px #0000000f,0 8px 24px -8px #00000029;
  font:13px/1.4 "Avenir Next","Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-align:left;overflow:hidden}
${H}[data-tone=choice]{width:min(360px,calc(100vw - 16px))}
${H}[data-tone=done]{max-width:min(480px,calc(100vw - 16px))}
${H}[data-quiet]{visibility:hidden}
#exact-paste-leaving{pointer-events:none;animation:ep-out 120ms ease-out both}
${H} :not(svg,svg *){all:unset;box-sizing:border-box}
${H} :focus-visible{outline:2px solid var(--ep-accent);outline-offset:-2px;border-radius:6px}
${H}:focus{outline:none}
${H} svg{display:block;flex:none;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
${H} .ep-head{display:flex;align-items:center;gap:8px;min-height:40px;padding:6px 6px 6px 12px}
${H} .ep-mark{color:var(--ep-dim)}
${H}[data-tone=done] .ep-mark,${H}[data-tone=choice] .ep-mark{color:var(--ep-accent)}
${H}[data-tone=warn] .ep-mark{color:var(--ep-warn)}
${H} .ep-spin{display:block;flex:none;width:14px;height:14px;margin:1px;border-radius:50%;border:2px solid var(--ep-line);border-top-color:var(--ep-accent);animation:ep-spin 700ms linear infinite}
${H} .ep-text{flex:1;min-width:0;font-weight:500}
${H}[data-tone=done] .ep-text{flex:0 1 auto;margin-right:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${H} .ep-sub{display:block;font-weight:400;color:var(--ep-dim);font-size:12px}
${H} .ep-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
${H} button{display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:inherit;border-radius:6px;transition:background-color 120ms ease,transform 120ms cubic-bezier(.23,1,.32,1)}
${H} button:active{transform:scale(.97)}
${H} .ep-close{justify-content:center;width:28px;height:28px;color:var(--ep-dim)}
${H} .ep-corner{position:absolute;top:6px;right:6px}
${H}:not([data-tone=done]) .ep-head{padding-right:40px}
${H} .ep-inline{height:28px;padding:0 8px;font-weight:500;color:var(--ep-ink);white-space:nowrap}
${H} .ep-inline svg{width:14px;height:14px;color:var(--ep-dim)}
${H} .ep-list{display:block;border-top:1px solid var(--ep-line)}
${H} .ep-pick{display:flex;width:100%;gap:10px;padding:10px 12px;border-radius:0;font-size:14px;font-weight:500;border-bottom:1px solid var(--ep-line)}
${H} .ep-pick:active{transform:none;background:var(--ep-line)}
${H} .ep-value{flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;white-space:pre-line}
${H} .ep-pick svg{color:var(--ep-dim);opacity:.55}
${H} .ep-pick:focus-visible svg{opacity:1;color:var(--ep-accent)}
${H} .ep-foot{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:6px}
${H} .ep-note{display:block;width:100%;padding:0 8px 4px;color:var(--ep-dim);font-size:12px}
@media (hover:hover) and (pointer:fine){
  ${H} button:hover{background:var(--ep-hover)}
  ${H} .ep-pick:hover svg{opacity:1;color:var(--ep-accent)}
}
@media (prefers-color-scheme:dark){
  ${H}{--ep-bg:#232725;--ep-ink:#e2e5e3;--ep-dim:#a3aba6;--ep-line:#363b38;--ep-hover:#2d322f;--ep-accent:#8cbfac;--ep-warn:#e0a37e;box-shadow:0 8px 24px -8px #00000080}
}
@media (prefers-reduced-motion:reduce){
  ${H} button:active{transform:none}
  ${H} .ep-spin{animation:ep-pulse 1.2s ease-in-out infinite alternate}
}
@keyframes ep-out{to{opacity:0}}
@keyframes ep-spin{to{transform:rotate(1turn)}}
@keyframes ep-pulse{to{opacity:.4}}
`;

// Constructed sheets are CSSOM, so a page's style-src CSP cannot block them; jsdom and old engines get a <style>.
function ensureStyle(doc: Document): void {
  try {
    const view = doc.defaultView as (Window & typeof globalThis & { __exactPasteSheet?: CSSStyleSheet }) | null;
    if (!view || !("adoptedStyleSheets" in doc)) throw new Error("no adopted sheets");
    const sheet = view.__exactPasteSheet ??= new view.CSSStyleSheet();
    if (!sheet.cssRules.length) sheet.replaceSync(CSS);
    if (!doc.adoptedStyleSheets.includes(sheet)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  } catch {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style"); style.id = STYLE_ID; style.textContent = CSS;
    (doc.head ?? doc.documentElement).append(style);
  }
}

function icon(doc: Document, name: string): SVGSVGElement {
  const svg = doc.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  for (const d of ICONS[name] ?? []) {
    const path = doc.createElementNS(SVG, "path"); path.setAttribute("d", d); svg.append(path);
  }
  return svg;
}

function span(doc: Document, className: string, text = ""): HTMLSpanElement {
  const node = doc.createElement("span"); node.className = className; node.textContent = text; return node;
}

function button(doc: Document, className: string, action: ToastAction): HTMLButtonElement {
  const node = doc.createElement("button"); node.type = "button"; node.className = className;
  node.addEventListener("click", action.onClick);
  return node;
}

// Button text stays exactly the action label (tests and assistive tech read it); icons carry no text.
function actionButton(doc: Document, action: ToastAction): HTMLButtonElement {
  if (action.kind === "pick" || action.kind === "saved") {
    const node = button(doc, "ep-pick", action); node.dataset.pick = "";
    if (action.kind === "saved") node.append(span(doc, "ep-value", action.label));
    else node.append(span(doc, "ep-sr", "Use: "), span(doc, "ep-value", action.label));
    node.append(icon(doc, action.kind === "saved" ? "saved" : "enter"));
    return node;
  }
  const node = button(doc, "ep-inline", action);
  node.append(icon(doc, action.kind), action.label);
  return node;
}

export function buildToast(doc: Document, tone: Tone, text: string, actions: ToastAction[], dismiss: ToastAction): HTMLElement {
  ensureStyle(doc);
  const panel = doc.createElement("aside"); panel.id = "exact-paste-toast";
  panel.setAttribute("aria-label", "Exact Paste"); panel.setAttribute("role", "dialog"); panel.tabIndex = -1;
  panel.dataset.tone = tone;
  const head = doc.createElement("div"); head.className = "ep-head";
  if (tone === "pending") head.append(span(doc, "ep-spin"));
  else { const mark = icon(doc, tone === "done" ? "check" : tone); mark.classList.add("ep-mark"); head.append(mark); }
  const [title, detail] = text.split("\n");
  const message = span(doc, "ep-text", title); message.setAttribute("role", "status");
  if (tone === "done") message.title = title ?? "";
  if (detail) message.append(span(doc, "ep-sub", detail));
  head.append(message);
  const picks = actions.filter((a) => a.kind === "pick" || a.kind === "saved");
  const rest = actions.filter((a) => !picks.includes(a));
  // Compact result: the follow-up actions sit on the header line instead of a stack of full-width buttons.
  if (tone === "done") head.append(...rest.map((a) => actionButton(doc, a)));
  const close = button(doc, "ep-close", dismiss); close.setAttribute("aria-label", dismiss.label);
  close.append(icon(doc, "close"));
  panel.append(head);
  if (picks.length) {
    const list = doc.createElement("div"); list.className = "ep-list";
    list.append(...picks.map((a) => actionButton(doc, a))); panel.append(list);
  }
  if (tone !== "done" && rest.length) {
    const foot = doc.createElement("div"); foot.className = "ep-foot";
    foot.append(...rest.map((a) => actionButton(doc, a)));
    if (rest.some((a) => a.kind === "jev")) foot.append(span(doc, "ep-note", "Ask Jev sends your clipboard, field labels and enabled notes to TypeSafe."));
    panel.append(foot);
  }
  // Last in document order so the first button is always the first choice; CSS pins it to the header corner.
  if (tone === "done") head.append(close);
  else { close.classList.add("ep-corner"); panel.append(close); }
  // Arrow keys move between choices; Tab and Escape keep their native and paste.ts meanings.
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...panel.querySelectorAll<HTMLButtonElement>("[data-pick]")];
    if (!items.length) return;
    event.preventDefault();
    const at = items.indexOf(event.target as HTMLButtonElement);
    const next = at < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1) : (at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
    items[next]?.focus();
  });
  return panel;
}

const CONTROLS = "input:not([type=hidden]),textarea,select,button,label,summary,a[href],[role=button],[contenteditable]:not([contenteditable=false])";
type Spot = { left: number; top: number };

// A choice is focused and modal, so it opens like a dropdown: below the field when it fits, otherwise above.
// Every other panel stays clear of the page's other controls, so a click meant for the next field never lands on Undo:
// below, beside, above, then the bottom-right corner. Never covers the field when there is room.
export function placeToast(panel: HTMLElement, anchor: Element | null): void {
  const doc = panel.ownerDocument, view = doc.defaultView;
  if (!view) return;
  const vw = view.innerWidth, vh = view.innerHeight, gap = 8;
  const { width, height } = panel.getBoundingClientRect();
  const rect = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
  const clamp = ({ left, top }: Spot): Spot => ({ left: Math.max(gap, Math.min(left, vw - width - gap)), top: Math.max(gap, top) });
  const corner = clamp({ left: vw - width - 16, top: vh - height - 16 });
  let spot = corner;
  if (rect && rect.bottom > 0 && rect.top < vh) {
    const fits = (top: number): boolean => top >= gap && top + height <= vh - gap;
    const below = clamp({ left: rect.left, top: rect.bottom + gap }), above = clamp({ left: rect.left, top: rect.top - gap - height });
    const spots = [below, above].filter((s) => fits(s.top));
    if (panel.dataset.tone !== "choice") {
      const beside = { left: rect.right + gap, top: rect.top + (rect.height - height) / 2 };
      if (beside.left + width <= vw - gap && fits(beside.top)) spots.splice(spots[0] === below ? 1 : 0, 0, beside);
      // ponytail: rescans the page's controls on every scroll; cache the rects if a huge form makes this measurable.
      const others = [...doc.querySelectorAll(CONTROLS)].filter((el) => el !== anchor && !el.contains(anchor) && !panel.contains(el))
        .map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height);
      const free = ({ left, top }: Spot): boolean => [rect, ...others].every((r) =>
        r.right <= left || r.left >= left + width || r.bottom <= top || r.top >= top + height);
      spot = spots.find(free) ?? (free(corner) ? corner : spots[0] ?? { left: rect.left, top: vh - height - gap });
    } else spot = spots[0] ?? { left: rect.left, top: vh - height - gap };
  }
  panel.style.left = `${Math.round(clamp(spot).left)}px`;
  panel.style.top = `${Math.round(clamp(spot).top)}px`;
}
