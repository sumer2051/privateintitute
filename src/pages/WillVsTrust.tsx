import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Scale, Clock, EyeOff, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";

const SITE = "https://privateintitute.lovable.app";

const rows: { label: string; will: string; trust: string }[] = [
  { label: "When it takes effect", will: "Only after death", trust: "Immediately once funded, and continues after death" },
  { label: "Probate court", will: "Assets pass through probate", trust: "Funded assets avoid probate" },
  { label: "Privacy", will: "Becomes a public record", trust: "Stays private between trustee and beneficiaries" },
  { label: "Incapacity planning", will: "No protection while you are alive", trust: "Successor trustee can step in without a court" },
  { label: "Typical cost to set up", will: "Lower upfront", trust: "Higher upfront, lower settlement cost later" },
  { label: "Naming guardians for children", will: "Yes — only a will can do this", trust: "No" },
  { label: "Ongoing upkeep", will: "Minimal", trust: "Requires titling assets into the trust" },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "What is the main difference between a will and a trust?",
    a: "A will is a set of instructions that takes effect after death and is administered through probate court. A living trust is a legal entity that holds assets during your lifetime and passes them to beneficiaries without probate.",
  },
  {
    q: "Do I need both a will and a trust?",
    a: "Most families with a trust still keep a pour-over will. It names guardians for minor children and catches any asset that was never retitled into the trust.",
  },
  {
    q: "Does a trust avoid estate tax?",
    a: "A basic revocable living trust does not reduce estate tax on its own. Irrevocable structures such as ILITs or SLATs can, but they trade away control and should be reviewed with a tax adviser.",
  },
  {
    q: "What happens if I have neither?",
    a: "State intestacy law decides who inherits, and a court appoints an administrator and any guardian for minor children — usually the slowest and most expensive outcome.",
  },
];

const WillVsTrust = () => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "Will vs Trust: Which Protects Your Legacy?",
        description:
          "A plain-English comparison of wills and living trusts — probate, privacy, cost, incapacity planning and how to choose.",
        mainEntityOfPage: `${SITE}/insights/will-vs-trust`,
        author: { "@type": "Organization", name: "BoA private institute" },
        publisher: { "@type": "Organization", name: "BoA private institute" },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Insights", item: `${SITE}/insights/will-vs-trust` },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Will vs Trust: Which Protects Your Legacy?"
        description="Wills vs living trusts compared: probate, privacy, cost, incapacity planning and guardianship — plus how to decide which your estate plan needs."
        path="/insights/will-vs-trust"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="BoA private institute" width={32} height={32} className="h-8 w-8 rounded-full object-contain" />
            <span className="font-display text-base font-bold text-secondary">BoA private institute</span>
          </Link>
          <Button asChild size="sm" variant="outline">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">Home</Link> <span aria-hidden="true">/</span> Insights
        </nav>

        <h1 className="font-display text-3xl font-bold tracking-tight text-secondary sm:text-4xl">
          Will vs Trust: Which Protects Your Legacy?
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Both documents move wealth to the people you choose. They differ in when they take effect, whether a court is
          involved, and how much of your estate stays private. Here is the practical comparison wealth clients ask for
          most.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Scale className="h-4 w-4 text-primary" /> What a will does</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              A will names who inherits your property, who administers your estate, and — uniquely — who raises your
              minor children. It only speaks after death, and a probate judge supervises it.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> What a trust does</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              A revocable living trust holds title to assets while you are alive. You stay in control as trustee; if you
              become incapacitated or die, your successor trustee distributes assets without probate.
            </CardContent>
          </Card>
        </div>

        <h2 className="mt-12 font-display text-2xl font-bold text-secondary">Side-by-side comparison</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Comparison of wills and living trusts</caption>
            <thead className="bg-muted/60">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Factor</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Will</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Living trust</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t align-top">
                  <th scope="row" className="px-4 py-3 text-left font-medium">{r.label}</th>
                  <td className="px-4 py-3 text-muted-foreground">{r.will}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.trust}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-12 font-display text-2xl font-bold text-secondary">Three questions that usually decide it</h2>
        <ol className="mt-4 space-y-4">
          <li className="flex gap-3">
            <Clock className="mt-1 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">How long can your heirs wait?</strong> Probate commonly runs six
              months to two years. If your family depends on the assets for living costs, a funded trust delivers faster.
            </p>
          </li>
          <li className="flex gap-3">
            <EyeOff className="mt-1 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Does privacy matter?</strong> A probated will and its inventory become
              public. A trust keeps balances, beneficiaries and business interests out of the record.
            </p>
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Do you own property in more than one state?</strong> Each state can
              open its own probate. A trust holding the deeds avoids repeat proceedings.
            </p>
          </li>
        </ol>

        <h2 className="mt-12 font-display text-2xl font-bold text-secondary">A trust only works if you fund it</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          The most common estate-planning failure is a signed trust with nothing inside it. Retitle deeds, brokerage and
          deposit accounts into the trust name, and keep beneficiary designations on retirement accounts and life
          insurance consistent with the plan — those pass by contract and override both documents.
        </p>

        <h2 className="mt-12 font-display text-2xl font-bold text-secondary">Frequently asked questions</h2>
        <dl className="mt-4 space-y-6">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold text-foreground">{f.q}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>

        <Card className="mt-12 border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg font-bold text-secondary">Plan the accounts behind the paperwork</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open your portal to review balances, beneficiaries and transfers in one place.
              </p>
            </div>
            <Button asChild>
              <Link to="/auth">Sign in to your portal <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        <p className="mt-8 text-xs text-muted-foreground">
          This guide is general information, not legal or tax advice. Estate rules vary by state — confirm your plan with
          a licensed attorney.
        </p>
      </main>
    </div>
  );
};

export default WillVsTrust;
