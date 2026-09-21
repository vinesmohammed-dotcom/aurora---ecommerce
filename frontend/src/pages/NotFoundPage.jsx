import React from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <Card>
        <div className="space-y-4">
          <h1 className="text-6xl font-extrabold font-heading text-slate-900">404</h1>
          <h2 className="text-xl font-bold font-heading text-slate-800">Page Not Found</h2>
          <p className="text-sm text-slate-500">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="pt-2">
            <Link to="/">
              <Button variant="primary">Return Home</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
