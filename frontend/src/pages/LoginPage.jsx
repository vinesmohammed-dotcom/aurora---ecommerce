import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../services/api";
import { setUser, setAuthLoading } from "../store/slices/authSlice";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { loginSchema } from "../features/auth/authValidators";

/**
 * Aurora Storefront — Customer Authentication Sign-In Page
 * Provides full credential authentication, field-level Zod validation,
 * session synchronization, and automated redirection.
 */
export default function LoginPage() {
  const [serverGenericError, setServerGenericError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || "/";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    },
    mode: "onTouched"
  });

  const onSubmit = async (data) => {
    setServerGenericError(null);
    setIsLoading(true);
    dispatch(setAuthLoading(true));

    try {
      const res = await api.post("/auth/login", data);
      if (res.success && res.data) {
        dispatch(setUser(res.data.user || res.data));
        navigate(from, { replace: true });
      } else {
        setServerGenericError(res.message || "Failed to sign in. Please verify your credentials.");
      }
    } catch (err) {
      // If the backend returns field-level validation errors (HTTP 422), map to form fields
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        err.errors.forEach((item) => {
          if (item.field) {
            setError(item.field, { type: "server", message: item.message });
          }
        });
      } else {
        setServerGenericError(err.message || "Invalid email or password.");
      }
    } finally {
      setIsLoading(false);
      dispatch(setAuthLoading(false));
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 sm:px-0">
      <Card className="shadow-lg border-slate-200">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold font-heading text-slate-900">Sign In to Your Account</h1>
            <p className="text-sm text-slate-500">
              Welcome back to Aurora. Enter your email and password to access your account.
            </p>
          </div>

          {serverGenericError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg" role="alert">
              {serverGenericError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register("email")}
                className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                  errors.email
                    ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                    : "border-slate-300 focus:ring-slate-900 focus:border-transparent"
                }`}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600 font-medium" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register("password")}
                className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                  errors.password
                    ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                    : "border-slate-300 focus:ring-slate-900 focus:border-transparent"
                }`}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600 font-medium" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          {/* Social Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-medium">Or continue with</span>
            </div>
          </div>

          {/* Google Sign-In Action */}
          <button
            type="button"
            onClick={async () => {
              const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
              if (!googleClientId) {
                alert(
                  "Google Sign-In is configured on the backend. To enable in browser, add VITE_GOOGLE_CLIENT_ID to your frontend .env file."
                );
                return;
              }
              // If GIS is present, trigger prompt
              if (window.google?.accounts?.id) {
                window.google.accounts.id.prompt();
              } else {
                alert("Loading Google authentication provider...");
              }
            }}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white py-2.5 px-4 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="pt-4 border-t border-slate-100 text-center text-sm text-slate-600">
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
