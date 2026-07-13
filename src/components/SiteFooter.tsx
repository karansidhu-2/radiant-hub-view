import { Link } from "@tanstack/react-router";
import { Wind, Phone, Mail, MapPin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-6">
        <div>
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-lg gradient-cool text-primary-foreground">
              <Wind className="h-5 w-5" strokeWidth={2.4} />
            </span>
            HVAC<span className="text-primary">Pro</span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Licensed, insured, and NATE-certified HVAC service, repair, and installation across 28 US states.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">EPA #12345 · NATE Certified · BBB A+</p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Services</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/services/ac-repair" className="hover:text-foreground">AC Repair</Link></li>
            <li><Link to="/services/furnace-repair" className="hover:text-foreground">Furnace Repair</Link></li>
            <li><Link to="/services/new-system-install" className="hover:text-foreground">New Installation</Link></li>
            <li><Link to="/services/maintenance-plan" className="hover:text-foreground">Maintenance Plans</Link></li>
            <li><Link to="/services/emergency-service" className="hover:text-foreground">24/7 Emergency</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Company</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about" className="hover:text-foreground">About Us</Link></li>
            <li><Link to="/shop" className="hover:text-foreground">Shop Systems</Link></li>
            <li><Link to="/book" className="hover:text-foreground">Book Service</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Contact</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> (800) 555-1234</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> hello@hvacpro.com</li>
            <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-primary" /> 4200 Comfort Ave<br />Denver, CO 80202</li>
          </ul>
          <p className="mt-4 text-xs font-semibold text-[color:var(--ember)]">🔥 24/7 Emergency Line</p>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} HVAC Pro Services, Inc. All rights reserved.
      </div>
    </footer>
  );
}
