"use client";

import { useId, useState } from "react";
import MessageText from "./MessageText";

export default function MessageBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const long = text.length > 500 || text.split("\n").length > 8;
  return <><div id={id} className={long && !expanded ? "line-clamp-6" : ""}><MessageText text={text} /></div>{long && <button type="button" aria-expanded={expanded} aria-controls={id} className="mt-2 min-h-11 text-sm font-medium text-emerald-800 underline underline-offset-4" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show less" : "Read full message"}</button>}</>;
}
