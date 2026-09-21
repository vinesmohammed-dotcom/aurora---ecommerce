import React from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="bg-slate-900 rounded-2xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="max-w-2xl space-y-4">
          <Badge variant="success">Phase 1 Foundation Active</Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-heading leading-tight">
            Engineered for High-Performance E-Commerce.
          </h1>
          <p className="text-slate-300 text-base sm:text-lg">
            A modular monolith built on MongoDB, Express, React, and Node.js with secure session cookies and atomic inventory safeguards.
          </p>
          <div className="pt-4 flex flex-wrap gap-4">
            <Link to="/shop">
              <Button variant="accent" size="lg">
                Explore Catalog Preview
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" size="lg">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="space-y-2">
            <h3 className="text-lg font-bold font-heading text-slate-900">Modular Monolith</h3>
            <p className="text-sm text-slate-600">
              Clean separation of concerns with thin controllers, rich domain services, and Mongoose document models.
            </p>
          </div>
        </Card>
        <Card>
          <div className="space-y-2">
            <h3 className="text-lg font-bold font-heading text-slate-900">Session Security</h3>
            <p className="text-sm text-slate-600">
              MongoDB-backed sessions with httpOnly secure cookies, eliminating XSS token theft risks.
            </p>
          </div>
        </Card>
        <Card>
          <div className="space-y-2">
            <h3 className="text-lg font-bold font-heading text-slate-900">Atomic Concurrency</h3>
            <p className="text-sm text-slate-600">
              Mathematical guards on stock decrement to physically prevent overselling during checkout.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
