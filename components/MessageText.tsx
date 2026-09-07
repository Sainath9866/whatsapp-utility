import { Fragment, type ReactNode } from "react";

// Render only React text/elements: pasted HTML is never interpreted as HTML.
function inline(text: string, depth = 0): ReactNode {
  if (depth > 4) return text;
  const expression = /(```[\s\S]+?```|`[^`\n]+`|(?<![\p{L}\p{N}])\*(?=\S)[^*\n]*?\S\*(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])_(?=\S)[^_\n]*?\S_(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])~(?=\S)[^~\n]*?\S~(?![\p{L}\p{N}]))/gu;
  const nodes: ReactNode[] = [];
  let end = 0;
  for (const match of text.matchAll(expression)) {
    nodes.push(text.slice(end, match.index));
    const token = match[0];
    const content = token.startsWith("```") ? token.slice(3, -3) : token.slice(1, -1);
    nodes.push(<Fragment key={match.index}>{token[0] === "`" ? <code className="rounded bg-black/5 px-1 font-mono">{content}</code> : token[0] === "*" ? <strong>{inline(content, depth + 1)}</strong> : token[0] === "_" ? <em>{inline(content, depth + 1)}</em> : <s>{inline(content, depth + 1)}</s>}</Fragment>);
    end = match.index + token.length;
  }
  nodes.push(text.slice(end));
  return nodes;
}

export default function MessageText({ text }: { text: string }) {
  // Split code spans first so list/quote markers inside code remain literal.
  const parts = text.split(/(```[\s\S]+?```)/g);
  return <div className="message-text">{parts.map((part, index) => part.startsWith("```") && part.endsWith("```") ? <code key={index} className="font-mono">{part.slice(3, -3)}</code> : <Fragment key={index}>{part.split("\n").map((line, i, lines) => {
    const bullet = line.match(/^(\s*)(?:[-*] |\d+\. )(.*)$/);
    const quote = line.startsWith("> ");
    return <Fragment key={i}>{quote ? <span className="border-l-2 border-emerald-600 pl-3 text-stone-600">{inline(line.slice(2))}</span> : bullet ? <>{line.slice(0, line.length - bullet[2].length).replace(/[-*] /, "• ")}{inline(bullet[2])}</> : inline(line)}{i < lines.length - 1 ? "\n" : ""}</Fragment>;
  })}</Fragment>)}</div>;
}
