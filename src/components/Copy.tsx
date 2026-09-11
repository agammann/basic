"use client";
import { useState } from "react";
export function Copy({ text }: { text: string }) {
  const [status, setStatus] = useState("Copy configuration");
  return (
    <>
      <button
        className="copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setStatus("Copied");
          } catch {
            setStatus("Select and copy the text below");
          }
        }}
      >
        {status}
      </button>
      <span className="secondary" aria-live="polite">
        {status === "Copied"
          ? " Configuration copied. Nothing was installed."
          : ""}
      </span>
    </>
  );
}
