import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../services/api";
import { setUser, setAuthLoading } from "../store/slices/authSlice";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import GoogleSignInButton from "../components/auth/GoogleSignInButton";
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

  const handleGoogleSuccess = async (credential) => {
    setServerGenericError(null);
    setIsLoading(true);
    dispatch(setAuthLoading(true));

    try {
      const res = await api.post("/auth/google", { credential });
      if (res.success && res.data) {
        dispatch(setUser(res.data.user || res.data));
        navigate(from, { replace: true });
      } else {
        setServerGenericError(res.message || "Failed to sign in with Google.");
      }
    } catch (err) {
      setServerGenericError(err.message || "Google authentication failed. Please try again.");
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
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setServerGenericError(msg)}
            text="continue_with"
            disabled={isLoading}
          />

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
