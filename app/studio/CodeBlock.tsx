"use client";

import { useState } from "react";
import { copyText } from "./studio/files";
import { useFlash } from "./studio/hooks";

export function CodeBlock({ text, html, language }: { text: string; html?: string; language: string }) {
  const [copied, flashCopied] = useFlash();
  const [error, setError] = useState("");
  return <div className="docs-code-block">
    <button className="btn btn-sm" onClick={() => {
      void copyText(text).then(ok => {
        setError(ok ? "" : "Select the example and copy it manually.");
        if (ok) flashCopied();
      });
    }}>{copied ? "Copied" : "Copy example"}</button>
    <pre className="code" tabIndex={0} aria-label={`${language} example`}>
      {html ? <code dangerouslySetInnerHTML={{ __html: html }} /> : <code>{text}</code>}
    </pre>
    <span className="sr-only" role="status">{error || (copied ? "Example copied." : "")}</span>
  </div>;
}
