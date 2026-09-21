import React from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { Link } from "react-router-dom";

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <div className="space-y-4 text-center">
          <Badge variant="info">Phase 1 Foundation</Badge>
          <h2 className="text-2xl font-bold font-heading text-slate-900">Sign In to Your Account</h2>
          <p className="text-sm text-slate-500">
            Authentication logic, form validation (React Hook Form + Zod), and OTP workflows will be activated in Phase 2.
          </p>
          <div className="pt-4 border-t border-slate-100 text-sm text-slate-600">
            Don't have an account?{" "}
            <Link to="/register" className="text-emerald-600 font-semibold hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
