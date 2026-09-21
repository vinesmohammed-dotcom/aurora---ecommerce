import React from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";

export default function ProfilePage() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading text-slate-900">Account Settings</h1>
        <Badge variant="info">User Profile</Badge>
      </div>
      <Card>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Address management, password updates, and email OTP verification settings will be managed here.
          </p>
        </div>
      </Card>
    </div>
  );
}
