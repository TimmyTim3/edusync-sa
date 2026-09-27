import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  GraduationCap,
  MessageCircle,
  NotebookPen,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduSync Parent Hub — Real-time school updates for parents" },
      {
        name: "description",
        content:
          "Teachers update attendance, marks, behaviour and homework once. Parents see it instantly on web and WhatsApp.",
      },
      { property: "og:title", content: "EduSync Parent Hub" },
      {
        property: "og:description",
        content: "Real-time attendance, marks, homework and notices for every family in your school.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: CalendarCheck, title: "Real-time attendance", text: "Parents know by 08:05 if their child is marked absent or late." },
  { icon: GraduationCap, title: "Marks & report cards", text: "Publish assessments once. Progress graphs update for every family." },
  { icon: NotebookPen, title: "Homework tracker", text: "Due, upcoming and overdue work — filtered per child, per subject." },
  { icon: Sparkles, title: "Behaviour & merits", text: "Celebrate wins, flag concerns, keep private teacher notes private." },
  { icon: Megaphone, title: "Targeted notices", text: "School, grade or class notices with priority and read receipts." },
  { icon: MessageCircle, title: "WhatsApp-ready", text: "Absence alerts and urgent notices straight to the parent's phone." },
];

const plans = [
  { name: "Starter", price: "R9", note: "per learner / month", items: ["Attendance", "Homework", "Notices"] },
  { name: "Growth", price: "R15", note: "per learner / month", items: ["Everything in Starter", "Marks & behaviour", "Analytics"], featured: true },
  { name: "Enterprise", price: "Custom", note: "annual contract", items: ["WhatsApp alerts", "Student portal", "White-label & report cards"] },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Users className="h-5 w-5" />
          </span>
          EduSync
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/auth" search={{ mode: "signup" }}>Start free trial</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 md:grid-cols-2">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
            <ShieldCheck className="h-4 w-4" /> Built for South African schools
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
            Teachers update once. <span className="text-primary">Every parent knows instantly.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            Attendance, marks, behaviour, homework and notices — shared live with families on the web and WhatsApp.
            No more lost letters or surprise report cards.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>Start free trial</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="mailto:hello@edusync.school?subject=EduSync%20demo%20request">Request a demo</a>
            </Button>
          </div>
        </div>
        <div className="rounded-3xl border bg-card p-6 shadow-lift">
          <p className="text-sm text-muted-foreground">Today · Thabo, Grade 10B</p>
          <div className="mt-4 space-y-3">
            {[
              ["Attendance", "Present · marked 07:52", "bg-success/15 text-success"],
              ["Mathematics", "Mid-term exam · 78%", "bg-primary/10 text-primary"],
              ["Homework", "Life Sciences due tomorrow", "bg-warning/15 text-warning"],
              ["Merit", "Helping a peer · +5", "bg-accent/15 text-accent"],
            ].map(([t, d, c]) => (
              <div key={t} className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <p className="font-medium">{t}</p>
                  <p className="text-sm text-muted-foreground">{d}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>Live</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl font-semibold">Everything families ask about, in one place</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-soft">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl font-semibold">Simple per-learner pricing</h2>
        <p className="mt-2 text-muted-foreground">30-day free trial. Monthly or annual billing.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl border p-6 ${p.featured ? "border-primary bg-card shadow-lift" : "bg-card"}`}
            >
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-3 font-display text-3xl font-semibold">{p.price}</p>
              <p className="text-sm text-muted-foreground">{p.note}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {p.items.map((i) => (
                  <li key={i}>✓ {i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} EduSync Parent Hub ·{" "}
        <Link to="/master-login" className="hover:underline">Platform admin</Link>
      </footer>
    </div>
  );
}
