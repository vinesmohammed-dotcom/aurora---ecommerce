import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { registerSchema, verifyOtpSchema } from "../features/auth/authValidators";

/**
 * Aurora Storefront — Customer Registration & Verification Page
 * Handles new user account provisioning and 6-digit OTP verification
 * with client-side Zod validation and field-level error messages.
 */
export default function RegisterPage() {
  const [step, setStep] = useState("register"); // 'register' | 'otp'
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [serverGenericError, setServerGenericError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  // Registration Form Hook
  const {
    register: registerField,
    handleSubmit: handleRegisterSubmit,
    setError: setRegisterError,
    formState: { errors: registerErrors }
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      referralCode: ""
    },
    mode: "onTouched"
  });

  // OTP Verification Form Hook
  const {
    register: registerOtpField,
    handleSubmit: handleOtpSubmit,
    setError: setOtpError,
    formState: { errors: otpErrors }
  } = useForm({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: {
      otp: ""
    },
    mode: "onTouched"
  });

  const onRegister = async (data) => {
    setServerGenericError(null);
    setIsLoading(true);

    try {
      const res = await api.post("/auth/register", data);
      setRegisteredEmail(data.email);
      setSuccessMsg(res.message || "Account registered! Please enter the OTP code sent to your email.");
      setStep("otp");
    } catch (err) {
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        err.errors.forEach((item) => {
          if (item.field) {
            setRegisterError(item.field, { type: "server", message: item.message });
          }
        });
      } else {
        setServerGenericError(err.message || "Failed to register account.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onVerifyOtp = async (data) => {
    setServerGenericError(null);
    setIsLoading(true);

    try {
      const res = await api.post("/auth/verify-otp", {
        email: registeredEmail,
        otp: data.otp,
        purpose: "REGISTRATION"
      });
      setSuccessMsg(res.message || "Email verified successfully! Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        err.errors.forEach((item) => {
          if (item.field) {
            setOtpError(item.field, { type: "server", message: item.message });
          }
        });
      } else {
        setServerGenericError(err.message || "Failed to verify OTP code.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 sm:px-0">
      <Card className="shadow-lg border-slate-200">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold font-heading text-slate-900">Create an Account</h1>
            <p className="text-sm text-slate-500">
              Join Aurora E-Commerce for live order tracking, wallet credits, and curated catalog offers.
            </p>
          </div>

          {serverGenericError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg" role="alert">
              {serverGenericError}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg" role="alert">
              {successMsg}
            </div>
          )}

          {step === "register" ? (
            <form onSubmit={handleRegisterSubmit(onRegister)} noValidate className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Jane Doe"
                  {...registerField("name")}
                  className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    registerErrors.name
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                      : "border-slate-300 focus:ring-slate-900 focus:border-transparent"
                  }`}
                />
                {registerErrors.name && (
                  <p className="mt-1 text-xs text-rose-600 font-medium" role="alert">
                    {registerErrors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  {...registerField("email")}
                  className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    registerErrors.email
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                      : "border-slate-300 focus:ring-slate-900 focus:border-transparent"
                  }`}
                />
                {registerErrors.email && (
                  <p className="mt-1 text-xs text-rose-600 font-medium" role="alert">
                    {registerErrors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  {...registerField("password")}
                  className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    registerErrors.password
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                      : "border-slate-300 focus:ring-slate-900 focus:border-transparent"
                  }`}
                />
                {registerErrors.password && (
                  <p className="mt-1 text-xs text-rose-600 font-medium" role="alert">
                    {registerErrors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="referralCode" className="block text-sm font-medium text-slate-700 mb-1">
                  Referral Code <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="referralCode"
                  type="text"
                  placeholder="e.g. AUR-XXXXXX"
                  {...registerField("referralCode")}
                  className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 uppercase placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    registerErrors.referralCode
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                      : "border-slate-300 focus:ring-slate-900 focus:border-transparent"
                  }`}
                />
                {registerErrors.referralCode && (
                  <p className="mt-1 text-xs text-rose-600 font-medium" role="alert">
                    {registerErrors.referralCode.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isLoading}
              >
                Create Account
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit(onVerifyOtp)} noValidate className="space-y-4">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-slate-700 mb-1">
                  Enter 6-Digit OTP Code
                </label>
                <input
                  id="otp"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  {...registerOtpField("otp")}
                  className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 transition-all ${
                    otpErrors.otp
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                      : "border-slate-300 focus:ring-slate-900 focus:border-transparent"
                  }`}
                />
                {otpErrors.otp && (
                  <p className="mt-1 text-xs text-rose-600 font-medium" role="alert">
                    {otpErrors.otp.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isLoading}
              >
                Verify & Continue
              </Button>
            </form>
          )}

          {/* Social Divider */}
          {step === "register" && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400 font-medium">Or continue with</span>
                </div>
              </div>

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
            </>
          )}

          <div className="pt-4 border-t border-slate-100 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link to="/login" className="text-emerald-600 font-semibold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
