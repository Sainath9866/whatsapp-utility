"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { isInlineActive, isLineActive, toggleInline, toggleLines, type FormatResult, type InlineMarker, type LineMarker, type TextSelection } from "@/lib/message-formatting";

const tools: Array<
  | { kind: "inline"; marker: InlineMarker; label: string; icon: string; placeholder: string; style?: string }
  | { kind: "line"; marker: LineMarker; label: string; icon: string }
> = [
  { kind: "inline", marker: "*", label: "Bold", icon: "B", placeholder: "bold text", style: "font-bold" },
  { kind: "inline", marker: "_", label: "Italic", icon: "I", placeholder: "italic text", style: "italic" },
  { kind: "inline", marker: "~", label: "Strikethrough", icon: "S", placeholder: "strikethrough text", style: "line-through" },
  { kind: "inline", marker: "`", label: "Inline code", icon: "{ }", placeholder: "code", style: "font-mono" },
  { kind: "line", marker: "- ", label: "Bullet list", icon: "• List" },
  { kind: "line", marker: "> ", label: "Quote", icon: "❯ Quote" },
];

export default function MessageEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  useLayoutEffect(() => {
    const element = editor.current;
    if (!element) return;
    function resize() {
      if (!element || !element.offsetWidth) return;
      element.style.height = "auto";
      element.style.height = `${Math.min(640, Math.max(180, element.scrollHeight + 2))}px`;
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);

  function syncSelection() {
    const element = editor.current;
    if (!element) return;
    setSelection({ start: element.selectionStart, end: element.selectionEnd });
  }

  function apply(result: FormatResult) {
    const element = editor.current;
    if (!element) return;
    onChange(result.text);
    setSelection({ start: result.start, end: result.end });
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(result.start, result.end);
    });
  }

  function toggle(tool: (typeof tools)[number]) {
    const element = editor.current;
    if (!element) return;
    const current = { start: element.selectionStart, end: element.selectionEnd };
    apply(tool.kind === "inline"
      ? toggleInline(value, current, tool.marker, tool.placeholder)
      : toggleLines(value, current, tool.marker));
  }

  function active(tool: (typeof tools)[number]) {
    return tool.kind === "inline"
      ? isInlineActive(value, selection, tool.marker)
      : isLineActive(value, selection, tool.marker);
  }

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor="message">Your message</label><span id="message-count" className={`mb-2 text-xs tabular-nums ${value.length > 4000 ? "font-semibold text-red-700" : "text-stone-400"}`}>{value.length.toLocaleString()} / 4,000</span></div>
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white focus-within:ring-2 focus-within:ring-emerald-700">
      <div role="toolbar" aria-label="Message formatting" className="flex gap-1 overflow-x-auto border-b border-stone-100 bg-stone-50 p-2">{tools.map((tool) => { const pressed = active(tool); return <button key={tool.label} type="button" aria-label={tool.label} aria-pressed={pressed} title={`${tool.label} — click again to remove`} className={`min-h-11 shrink-0 rounded-lg px-3 text-sm transition-colors ${tool.kind === "inline" ? tool.style : ""} ${pressed ? "bg-emerald-800 text-white shadow-sm" : "text-stone-600 hover:bg-stone-200"}`} onMouseDown={(event) => event.preventDefault()} onClick={() => toggle(tool)}>{tool.icon}</button>; })}</div>
      <textarea ref={editor} id="message" rows={7} required aria-describedby="message-help message-count" aria-invalid={value.length > 4000} className="message-editor block rounded-none border-0 leading-7 focus-visible:outline-none" placeholder="Paste your message here, or start typing…" value={value} onSelect={syncSelection} onClick={syncSelection} onKeyUp={syncSelection} onChange={(event) => { onChange(event.target.value); setSelection({ start: event.target.selectionStart, end: event.target.selectionEnd }); }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && !event.shiftKey && ["b", "i"].includes(event.key.toLowerCase())) { event.preventDefault(); toggle(tools[event.key.toLowerCase() === "b" ? 0 : 1]); } }} />
    </div>
    <p id="message-help" className="mt-2 text-xs leading-5 text-stone-500">Select text and tap a format button; the highlighted button shows what is active. Tap it again to remove that format. With no selection, a replaceable example is inserted. ⌘/Ctrl+B and ⌘/Ctrl+I work too. Double stars automatically become WhatsApp’s single-star bold format.</p>
    {value.length > 4000 && <p role="alert" className="mt-2 text-sm text-red-700">Your full paste is preserved. Shorten it by {(value.length - 4000).toLocaleString()} characters before adding it.</p>}
  </div>;
}
