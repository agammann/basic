import Link from "next/link";
export default function NotFound() {
  return (
    <>
      <h1>Profile unavailable</h1>
      <p>This profile does not exist, has been removed, or is not published.</p>
      <Link href="/">Return to search</Link>
    </>
  );
}
