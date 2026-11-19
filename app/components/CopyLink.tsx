import { useState } from "react";

// A link with a Copy button. Without JavaScript, the link can still be selected and copied.
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="copy-link">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Link to your note" />
      <button type="button" className="button" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
