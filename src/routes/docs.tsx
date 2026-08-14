import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/docs")({ component: DocsPage });

const BASE_URL = "https://tuvqxwyqrgsowirmmyhp.supabase.co/functions/v1/public-api";

function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-display mt-12 text-3xl first:mt-0">{children}</h2>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="font-display mt-8 text-xl">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{children}</code>;
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/50 p-4 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="mt-6 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
          {method}
        </span>
        <code className="text-sm">{path}</code>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function DocsPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <a href="/" className="font-display text-xl">
            SubTracker
          </a>
          <a href="/auth" className="text-sm text-muted-foreground hover:text-foreground">
            Open the app
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-4xl">SubTracker Documentation</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Everything you can do with SubTracker: the public API for automation, webhooks for
          integrations, and the analytics built into the dashboard.
        </p>

        <H2>Public API</H2>
        <P>
          A small REST API for adding and reacting to subscriptions from anywhere - Zapier, Make,
          scripts, cron jobs. The same data the dashboard shows, through the same access control.
        </P>
        <H3>Base URL &amp; authentication</H3>
        <Pre>{BASE_URL}</Pre>
        <P>
          Every request needs an API key. Create one in the app: dashboard header, key icon,{" "}
          <Code>API access</Code>. The key is shown once at creation and stored only as a hash - if
          you lose it, create a new one. Keys can be revoked anytime. Send the key as a bearer
          token:
        </P>
        <Pre>{`curl ${BASE_URL}/subscriptions \\
  -H "Authorization: Bearer st_your_api_key_here"`}</Pre>

        <H3>Endpoints</H3>

        <Endpoint
          method="GET"
          path="/me"
          desc="Connection test. Returns the key name if the token is valid."
        />
        <Pre>{`curl ${BASE_URL}/me -H "Authorization: Bearer st_..."`}</Pre>

        <Endpoint
          method="GET"
          path="/subscriptions"
          desc="List your subscriptions, newest first."
        />
        <Pre>{`curl ${BASE_URL}/subscriptions -H "Authorization: Bearer st_..."`}</Pre>

        <Endpoint
          method="POST"
          path="/subscriptions"
          desc="Create a subscription. Only name and cost are required."
        />
        <Pre>{`curl -X POST ${BASE_URL}/subscriptions \\
  -H "Authorization: Bearer st_..." \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Spotify","cost":9.99,"currency":"EUR","billing_cycle":"monthly","category":"Music","next_billing_date":"2026-09-05"}'`}</Pre>
        <P>Accepted fields:</P>
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Field</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Default / notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ["name", "string", "required"],
                ["cost", "number", "required, ≥ 0"],
                ["currency", "string", "USD; 3-letter code, e.g. EUR, GBP, CHF"],
                ["billing_cycle", "string", "monthly; weekly | quarterly | yearly"],
                ["status", "string", "active; trialing | paused | cancelled"],
                ["category", "string", "Other; any name works"],
                ["next_billing_date", "date", "null; YYYY-MM-DD"],
                ["trial_ends", "date", "null; YYYY-MM-DD"],
                ["notes", "string", "null"],
                ["url", "string", "null"],
                ["plan", "string", "null"],
                ["icon", "string", "null"],
                ["color", "string", "null; hex like #22c55e"],
              ].map(([f, t, d]) => (
                <tr key={f}>
                  <td className="px-3 py-1.5">
                    <Code>{f}</Code>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{t}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Endpoint method="GET" path="/subscriptions/:id" desc="Fetch one subscription by id." />

        <Endpoint
          method="PATCH"
          path="/subscriptions/:id"
          desc="Update any subset of fields. Changing status is how you cancel or pause from an automation. Changing cost automatically records the old price in the price history."
        />
        <Pre>{`# Cancel a subscription from Zapier / a script:
curl -X PATCH ${BASE_URL}/subscriptions/8f2c...-a1b2 \\
  -H "Authorization: Bearer st_..." \\
  -H "Content-Type: application/json" \\
  -d '{"status":"cancelled"}'`}</Pre>

        <Endpoint
          method="DELETE"
          path="/subscriptions/:id"
          desc="Permanently delete a subscription."
        />

        <H3>Errors</H3>
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ["400", "Missing/invalid field in the body"],
                ["401", "Missing, invalid, or revoked API key"],
                ["404", "Unknown path or subscription id"],
                ["405", "Method not allowed on this path"],
                ["500", "Server error"],
              ].map(([s, m]) => (
                <tr key={s}>
                  <td className="px-3 py-1.5">
                    <Code>{s}</Code>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          Errors come back as <Code>{'{"error":"..."}'}</Code>. Success responses wrap the payload
          in <Code>{'{"data": ...}'}</Code>.
        </P>

        <H2>Webhooks</H2>
        <P>
          SubTracker POSTs a JSON event to your webhook URL whenever a subscription is created,
          updated, or deleted - whether the change came from the API or from the dashboard.
        </P>
        <H3>Events</H3>
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Fires when</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ["subscription.created", "a subscription is created"],
                ["subscription.updated", "any field changes, including status"],
                ["subscription.deleted", "a subscription is deleted"],
              ].map(([e, m]) => (
                <tr key={e}>
                  <td className="px-3 py-1.5">
                    <Code>{e}</Code>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <H3>Payload</H3>
        <Pre>{`{
  "event": "subscription.updated",
  "subscription": {
    "id": "8f2c...",
    "name": "Spotify",
    "cost": 9.99,
    "currency": "EUR",
    "billing_cycle": "monthly",
    "status": "cancelled",
    "category": "Music",
    ...
  }
}`}</Pre>
        <P>
          Configure the URL in the app: key icon, <Code>API access</Code>, Webhook field. One
          webhook per account.
        </P>
        <H3>Zapier &amp; Make</H3>
        <P>
          <b>Zapier:</b> create a Zap with trigger <Code>Webhooks by Zapier → Catch Hook</Code> and
          paste your SubTracker webhook URL - you now react to subscription events. To modify
          subscriptions, use an action step <Code>Webhooks by Zapier → POST/PATCH</Code> against the
          API with your bearer key.
        </P>
        <P>
          <b>Make:</b> use the <Code>Webhooks</Code> module to receive events, and the{" "}
          <Code>HTTP → Make a request</Code> module to call the API.
        </P>
        <P>
          Delivery is best-effort: events are fired immediately from the database with no retries
          and no signatures, so don't rely on a webhook for anything that must never be missed.
        </P>

        <H2>Analytics</H2>
        <P>The dashboard computes everything from your active and trialing subscriptions.</P>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <b className="text-foreground">Monthly &amp; annual spend</b> - converted to a single
            USD-equivalent total so currencies can be compared.
          </li>
          <li>
            <b className="text-foreground">Spend by currency</b> - per-currency native totals with
            the USD equivalent.
          </li>
          <li>
            <b className="text-foreground">Projected spend</b> - the next 12 months, rolling every
            subscription forward on its billing cycle. The chart shows monthly-equivalent values: a
            €120 yearly subscription appears as €10 in its renewal month. Subscriptions without a
            next billing date are assumed to renew monthly.
          </li>
          <li>
            <b className="text-foreground">Category breakdown &amp; budgets</b> - pie chart by
            category, plus over-budget alerts when a category passes its monthly budget.
          </li>
          <li>
            <b className="text-foreground">Upcoming payments</b> - the next 8 billing dates, soonest
            first, with overdue and trial badges.
          </li>
        </ul>

        <H2>Changelog</H2>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>
            <b className="text-foreground">2026-08-14</b> - Public API, webhooks, spend-by-currency
            and the 12-month projection shipped.
          </p>
          <p>
            <b className="text-foreground">2026-08-03</b> - SubTracker launched: subscriptions,
            categories, budgets, price history, CSV/JSON export.
          </p>
        </div>
      </main>
    </div>
  );
}
