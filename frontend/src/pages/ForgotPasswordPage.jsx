import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { forgotPasswordRequestSchema, resetPasswordSubmitSchema } from "../features/auth/authValidators";
import { KeyRound, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

/**
 * Aurora Storefront — Customer Forgot & Reset Password Page
 * Two-stage verified password recovery workflow:
 * 1. Request single-use 6-digit OTP code to verified email
 * 2. Verify OTP and securely commit new hashed password with session revocation
 */
export default function ForgotPasswordPage() {
  const [step, setStep] = useState("request"); // 'request' | 'reset' | 'success'
  const [targetEmail, setTargetEmail] = useState("");
  const [serverError, setServerError] = useState(null);
  const [serverNotice, setServerNotice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  // Stage 1 Form: Request OTP
  const {
    register: registerRequest,
    handleSubmit: handleRequestSubmit,
    formState: { errors: requestErrors }
  } = useForm({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: "" },
    mode: "onTouched"
  });

  // Stage 2 Form: Enter OTP & New Password
  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors }
  } = useForm({
    resolver: zodResolver(resetPasswordSubmitSchema),
    defaultValues: { otp: "", newPassword: "", confirmPassword: "" },
    mode: "onTouched"
  });

  const onRequestOtp = async (data) => {
    setServerError(null);
    setServerNotice(null);
    setIsLoading(true);

    try {
      const res = await api.post("/auth/forgot-password", { email: data.email });
      setTargetEmail(data.email);
      setServerNotice(res.message || "If an active account is registered, an OTP code has been dispatched.");
      setStep("reset");
    } catch (err) {
      setServerError(err.message || "Failed to process password reset request.");
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPassword = async (data) => {
    setServerError(null);
    setServerNotice(null);
    setIsLoading(true);

    try {
      const res = await api.post("/auth/reset-password", {
        email: targetEmail,
        otp: data.otp,
        newPassword: data.newPassword
      });
      setServerNotice(res.message || "Password updated successfully!");
      setStep("success");
    } catch (err) {
      setServerError(err.message || "Invalid or expired OTP code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 sm:px-0">
      <Card className="shadow-lg border-slate-200">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-2">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold font-heading text-slate-900">
              {step === "success"
                ? "Password Reset Complete"
                : step === "reset"
                ? "Enter Verification Code"
                : "Reset Your Password"}
            </h1>
            <p className="text-sm text-slate-500">
              {step === "success"
                ? "Your account credentials have been secured with your new password."
                : step === "reset"
                ? `Enter the 6-digit OTP code sent to ${targetEmail} and choose a new password.`
                : "Enter your registered email address to receive a secure password reset code."}
            </p>
          </div>

          {/* Feedback Notices */}
          {serverError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg" role="alert">
              {serverError}
            </div>
          )}

          {serverNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg" role="alert">
              {serverNotice}
            </div>
          )}

          {/* Stage 1: Request OTP Form */}
          {step === "request" && (
            <form onSubmit={handleRequestSubmit(onRequestOtp)} noValidate className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    {...registerRequest("email")}
                    className={`w-full px-3 py-2 pl-9 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                      requestErrors.email
                        ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                        : "border-slate-300 focus:ring-slate-900 focus:border-transparent"
                    }`}
                  />
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                {requestErrors.email && (
                  <p className="mt-1 text-xs text-rose-600 font-medium" role="alert">
                    {requestErrors.email.message}
                  </p>
                )}
              </div>

              <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
                Send Verification Code
              </Button>
            </form>
          )}

          {/* Stage 2: Reset Password Form */}
          {step === "reset" && (
            <form onSubmit={handleResetSubmit(onResetPassword)} noValidate className="space-y-4">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-slate-700 mb-1">
                  6-Digit OTP Code
                </label>
                <input
                  id="otp"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  {...registerReset("otp")}
                  className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 transition-all ${
                    resetErrors.otp
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                      : "border-slate-300 focus:ring-slate-900 focus:border-transparent"
                  }`}
                />
                {resetErrors.otp && (
                  <p className="mt-1 text-xs text-rose-600 font-medium" role="alert">
                    {resetErrors.otp.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  {...registerReset("newPassword")}
                  className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    resetErrors.newPassword
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                      : "border-slate-300 focus:ring-slate-900 focus:border-transparent"
                  }`}
                />
                {resetErrors.newPassword && (
                  <p className="mt-1 text-xs text-rose-600 font-medium" role="alert">
                    {resetErrors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-type new password"
                  {...registerReset("confirmPassword")}
                  className={`w-full px-3 py-2 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    resetErrors.confirmPassword
                      ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500"
                      : "border-slate-300 focus:ring-slate-900 focus:border-transparent"
                  }`}
                />
                {resetErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-rose-600 font-medium" role="alert">
                    {resetErrors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setStep("request")}
                  className="text-slate-500 hover:text-slate-800 transition"
                >
                  Change Email
                </button>
              </div>

              <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
                Reset Password & Continue
              </Button>
            </form>
          )}

          {/* Stage 3: Success Screen */}
          {step === "success" && (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="text-sm text-slate-600">
                Your password has been securely updated. You can now sign in with your new credentials.
              </p>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => navigate("/login")}
              >
                Sign In Now
              </Button>
            </div>
          )}

          {/* Footer Back to Login */}
          <div className="pt-4 border-t border-slate-100 text-center text-sm text-slate-600">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-indigo-600 font-semibold hover:underline">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
