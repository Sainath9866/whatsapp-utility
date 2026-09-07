export type TextSelection = { start: number; end: number };
export type FormatResult = TextSelection & { text: string };
export type InlineMarker = "*" | "_" | "~" | "`";
export type LineMarker = "- " | "> ";

function orderedSelection(text: string, selection: TextSelection): TextSelection {
  const first = Math.max(0, Math.min(selection.start, text.length));
  const second = Math.max(0, Math.min(selection.end, text.length));
  return { start: Math.min(first, second), end: Math.max(first, second) };
}

function inlineWrapper(text: string, selection: TextSelection, marker: InlineMarker) {
  const { start, end } = orderedSelection(text, selection);
  const width = marker.length;

  if (end - start >= width * 2 && text.slice(start, start + width) === marker && text.slice(end - width, end) === marker) {
    return { open: start, close: end - width };
  }
  if (start >= width && text.slice(start - width, start) === marker && text.slice(end, end + width) === marker) {
    return { open: start - width, close: end };
  }

  const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const positions: number[] = [];
  for (let index = lineStart; index < lineEnd; index += 1) {
    if (text[index] !== marker) continue;
    // A leading "* " is a bullet, not an inline bold delimiter.
    if (marker === "*" && text[index + 1] === " " && !text.slice(lineStart, index).trim()) continue;
    positions.push(index);
  }
  const before = positions.filter((position) => position < start);
  if (before.length % 2 === 0) return null;
  const open = before[before.length - 1];
  const close = positions.find((position) => position >= end);
  return close === undefined ? null : { open, close };
}

export function isInlineActive(text: string, selection: TextSelection, marker: InlineMarker) {
  return inlineWrapper(text, selection, marker) !== null;
}

export function toggleInline(text: string, selection: TextSelection, marker: InlineMarker, placeholder: string): FormatResult {
  const current = orderedSelection(text, selection);
  const wrapper = inlineWrapper(text, current, marker);
  if (wrapper) {
    const mapPosition = (position: number) => position <= wrapper.open
      ? position
      : position <= wrapper.close
        ? position - marker.length
        : position - marker.length * 2;
    return {
      text: text.slice(0, wrapper.open) + text.slice(wrapper.open + marker.length, wrapper.close) + text.slice(wrapper.close + marker.length),
      start: mapPosition(current.start),
      end: mapPosition(current.end),
    };
  }

  const content = text.slice(current.start, current.end) || placeholder;
  return {
    text: text.slice(0, current.start) + marker + content + marker + text.slice(current.end),
    start: current.start + marker.length,
    end: current.start + marker.length + content.length,
  };
}

function selectedLines(text: string, selection: TextSelection) {
  const current = orderedSelection(text, selection);
  const start = text.lastIndexOf("\n", Math.max(0, current.start - 1)) + 1;
  const endProbe = current.end > current.start && text[current.end - 1] === "\n" ? current.end - 1 : current.end;
  const nextBreak = text.indexOf("\n", endProbe);
  const end = nextBreak === -1 ? text.length : nextBreak;
  return { ...current, lineStart: start, lineEnd: end, lines: text.slice(start, end).split("\n") };
}

export function isLineActive(text: string, selection: TextSelection, marker: LineMarker) {
  const { lines } = selectedLines(text, selection);
  const contentLines = lines.filter((line) => line.length > 0);
  return contentLines.length > 0 && contentLines.every((line) => line.startsWith(marker));
}

export function toggleLines(text: string, selection: TextSelection, marker: LineMarker): FormatResult {
  const block = selectedLines(text, selection);
  const active = isLineActive(text, selection, marker);
  const nextLines = block.lines.map((line) => {
    if (active) return line.startsWith(marker) ? line.slice(marker.length) : line;
    return line || block.lines.length > 1 ? (line ? marker + line : line) : marker;
  });
  const replacement = nextLines.join("\n");
  const nextText = text.slice(0, block.lineStart) + replacement + text.slice(block.lineEnd);

  if (block.start === block.end) {
    const position = active
      ? Math.max(block.lineStart, block.start - marker.length)
      : block.start + marker.length;
    return { text: nextText, start: position, end: position };
  }
  return { text: nextText, start: block.lineStart, end: block.lineStart + replacement.length };
}
