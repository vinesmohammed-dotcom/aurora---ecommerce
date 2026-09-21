import React from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { Link } from "react-router-dom";

export default function RegisterPage() {
  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <div className="space-y-4 text-center">
          <Badge variant="info">Phase 1 Foundation</Badge>
          <h2 className="text-2xl font-bold font-heading text-slate-900">Create an Account</h2>
          <p className="text-sm text-slate-500">
            Registration and email OTP verification pipelines will be implemented in Phase 2.
          </p>
          <div className="pt-4 border-t border-slate-100 text-sm text-slate-600">
            Already registered?{" "}
            <Link to="/login" className="text-emerald-600 font-semibold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
