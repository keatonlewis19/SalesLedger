import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { TrendingUp, Shield, Users, BarChart3 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-teal-50 via-white to-slate-50 flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 leading-none">CRM Group</div>
            <div className="text-xs text-slate-500">Insurance Agency</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-sm font-medium mb-6">
            <Shield className="w-3.5 h-3.5" />
            Agency Management Platform
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 leading-tight">
            Track sales.<br />
            <span className="text-teal-600">Grow your agency.</span>
          </h1>

          <p className="text-lg text-slate-600 mb-8 leading-relaxed">
            The complete sales tracking platform for CRM Group Insurance agents.
            Log sales, track commissions, and get automated weekly reports — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
            <Link href="/sign-in">
              <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white px-8">
                Sign In to Your Account
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              {
                icon: TrendingUp,
                title: "Commission Tracking",
                desc: "Auto-calculate commissions using FMV rates and plan types.",
              },
              {
                icon: Users,
                title: "Team Management",
                desc: "Admin view for all agents, invite new team members.",
              },
              {
                icon: BarChart3,
                title: "Automated Reports",
                desc: "Weekly, monthly and annual reports delivered by email.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-white/70 border border-slate-200 rounded-xl p-5">
                <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-teal-600" />
                </div>
                <div className="font-semibold text-slate-900 mb-1">{f.title}</div>
                <div className="text-sm text-slate-500">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 border-t bg-white/50">
        © {new Date().getFullYear()} CRM Group Insurance. All rights reserved.
      </footer>
    </div>
  );
}
