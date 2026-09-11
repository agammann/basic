"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="error">
      <h1>Basic couldn’t load this page</h1>
      <p>The catalog is temporarily unavailable. Please try again.</p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
