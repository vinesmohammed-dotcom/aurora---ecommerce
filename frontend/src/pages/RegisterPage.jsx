import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { useDispatch } from "react-redux";
import { setUser, setAuthLoading } from "../store/slices/authSlice";
import GoogleSignInButton from "../components/auth/GoogleSignInButton";
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
  const dispatch = useDispatch();

  // Registration Form Hook
  const {
    register: registerField,
    handleSubmit: handleRegisterSubmit,
    setError: setRegisterError,
    getValues: getRegisterValues,
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

  const handleGoogleSuccess = async (credential) => {
    setServerGenericError(null);
    setIsLoading(true);
    dispatch(setAuthLoading(true));

    try {
      const referralCode = getRegisterValues("referralCode");
      const res = await api.post("/auth/google", { credential, referralCode });
      if (res.success && res.data) {
        dispatch(setUser(res.data.user || res.data));
        navigate("/", { replace: true });
      } else {
        setServerGenericError(res.message || "Failed to sign up with Google.");
      }
    } catch (err) {
      setServerGenericError(err.message || "Google authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
      dispatch(setAuthLoading(false));
    }
  };

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

              <GoogleSignInButton
                onSuccess={handleGoogleSuccess}
                onError={(msg) => setServerGenericError(msg)}
                text="signup_with"
                disabled={isLoading}
              />
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
