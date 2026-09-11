export default function Privacy() {
  return (
    <div className="prose">
      <h1>Privacy</h1>
      <p className="lead">
        Basic has no accounts, advertising, analytics trackers or third-party
        credential storage.
      </p>
      <section>
        <h2>Search and connection data</h2>
        <p>
          Search queries are sent to Basic’s server and appear in shareable URLs
          and browser history. Basic queries its own PostgreSQL catalog. Search
          text is not forwarded to catalog publishers or an AI service.
        </p>
        <p>
          The production application does not intentionally log raw queries,
          request bodies, authorization headers or third-party tool responses.
          Avoid putting secrets in searches or URLs. A hosting provider may
          process network metadata under its own policies.
        </p>
      </section>
      <section>
        <h2>Operational records</h2>
        <p>
          Basic stores public catalog metadata, editorial sources,
          synchronization history and protocol observations. Database rate
          limits retain short-lived hashed network identifiers when the trusted
          proxy supplies a client address; otherwise a shared bucket is used.
          Rate-limit buckets are cleaned by the worker.
        </p>
        <p>
          Operational logs contain event names, times, counts and sanitized
          outcomes. Deployment defaults rotate logs by size, with a documented
          14-day cleanup setting for scheduled maintenance. Verification history
          is retained for evidence continuity. No third-party tool execution
          responses are collected.
        </p>
      </section>
      <section>
        <h2>Your device</h2>
        <p>
          Copy buttons write the displayed configuration to your clipboard only
          when clicked. Basic does not set application cookies or use browser
          storage for tracking. Following a publisher link takes you to that
          publisher’s own service and privacy policy.
        </p>
      </section>
    </div>
  );
}
