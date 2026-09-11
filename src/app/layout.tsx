import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Basic — Find the right tools for your agent.",
    template: "%s | Basic",
  },
  description:
    "Search MCP servers, understand setup requirements, and inspect dated evidence.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <div className="shell">
          <header>
            <Link className="brand" href="/">
              Basic
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/checks">How checks work</Link>
              <Link className="accent" href="/connect">
                Connect your agent
              </Link>
            </nav>
          </header>
          <main id="main">{children}</main>
          <footer>
            <span>Discovery with sources. Checks have limits.</span>
            <nav aria-label="Footer">
              <Link href="/privacy">Privacy</Link>
              <a href="https://github.com/agammann/basic">GitHub</a>
            </nav>
          </footer>
        </div>
      </body>
    </html>
  );
}
