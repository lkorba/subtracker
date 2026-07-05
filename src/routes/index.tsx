import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PieChart, Wallet, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Wallet className="h-4 w-4" />
          </div>
          <span className="font-display text-2xl">Subtracker</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth"><Button>Get started</Button></Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Personal subscription intelligence
          </div>
          <h1 className="font-display mt-6 text-6xl leading-[1.05] md:text-7xl">
            Every subscription,<br />in one calm place.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Add Netflix, Spotify, ChatGPT, and the dozen others you forgot about. Subtracker shows you the real monthly and annual damage — beautifully.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/auth"><Button size="lg">Start tracking free</Button></Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            { icon: Wallet, title: "One-tap add", body: "Popular services preloaded — Netflix, Spotify, ChatGPT Plus and more." },
            { icon: PieChart, title: "Real dashboards", body: "Monthly and annual totals with category breakdowns and pie charts." },
            { icon: Sparkles, title: "Smart categories", body: "Entertainment, AI, Education — see where your money actually goes." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
              <h3 className="mt-4 font-display text-2xl">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
