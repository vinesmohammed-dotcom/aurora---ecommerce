import React, { useState, useEffect } from "react";
import { Navigate, Outlet, Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import api from "../../services/api";
import { setUser } from "../../store/slices/authSlice";
import Card from "../ui/Card";
import Button from "../ui/Button";

/**
 * AdminRoute Guard
 * Restricts access to authenticated users with ADMIN role.
 * Automatically attempts session validation if user state is not yet hydrated.
 */
export default function AdminRoute() {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const [checking, setChecking] = useState(!user);
  const [errorStatus, setErrorStatus] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function verifyAdminSession() {
      if (user) {
        setChecking(false);
        return;
      }

      try {
        const res = await api.get("/users/me");
        if (res.success && res.data?.user) {
          if (isMounted) {
            dispatch(setUser(res.data.user));
            setChecking(false);
          }
        } else {
          if (isMounted) {
            setErrorStatus(401);
            setChecking(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          setErrorStatus(err.statusCode || 401);
          setChecking(false);
        }
      }
    }

    verifyAdminSession();

    return () => {
      isMounted = false;
    };
  }, [user, dispatch]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Verifying Administrative Privileges...</p>
        </div>
      </div>
    );
  }

  // If not authenticated or 401, redirect to login
  if (!user || errorStatus === 401) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }

  // If authenticated but role is not ADMIN, show 403 Forbidden screen
  if (user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card className="bg-slate-800 border-slate-700 p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              🚫
            </div>
            <h1 className="text-2xl font-bold font-heading text-white mb-2">403 — Access Forbidden</h1>
            <p className="text-slate-400 text-sm mb-6">
              Your account (<span className="text-slate-200 font-semibold">{user.email}</span>) does not possess administrator permissions required to access this control plane.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/">
                <Button variant="secondary" className="w-full">
                  Return to Storefront
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="primary" className="w-full">
                  View My Profile
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
