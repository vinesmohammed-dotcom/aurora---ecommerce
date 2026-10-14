import React, { useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Mail, Phone, Clock, MapPin, Send, CheckCircle2, AlertCircle } from "lucide-react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    orderNumber: "",
    topic: "ORDER_STATUS",
    subject: "",
    message: ""
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState(null);

  const validate = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Full name is required";
    if (!formData.email.trim()) {
      nextErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.email = "Please provide a valid email address";
    }
    if (!formData.subject.trim()) nextErrors.subject = "Subject line is required";
    if (!formData.message.trim()) {
      nextErrors.message = "Message cannot be empty";
    } else if (formData.message.trim().length < 15) {
      nextErrors.message = "Please provide at least 15 characters describing your enquiry";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    // Simulate support ticket dispatch to customer service queue
    setTimeout(() => {
      setIsSubmitting(false);
      const refId = `INQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      setSubmittedRef(refId);
      setFormData({
        name: "",
        email: "",
        orderNumber: "",
        topic: "ORDER_STATUS",
        subject: "",
        message: ""
      });
      setErrors({});
    }, 600);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-16">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-extrabold font-heading text-slate-900 tracking-tight">
          Customer Support & Concierge
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Have an enquiry regarding an order, payment, or sizing? Our support specialists are available 6 days a week.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Contact Info Column */}
        <div className="space-y-4">
          <Card className="p-6 border border-slate-200 space-y-4">
            <h2 className="text-base font-bold font-heading text-slate-900">Direct Contact</h2>

            <div className="flex items-start gap-3 text-xs text-slate-600">
              <Mail className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">Email Inquiries</p>
                <a href="mailto:support@aurora.local" className="text-indigo-600 hover:underline">
                  support@aurora.local
                </a>
                <p className="text-[11px] text-slate-400 mt-0.5">Typical response within 4 hours</p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-xs text-slate-600">
              <Phone className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">Customer Helpline</p>
                <p className="font-mono text-slate-700">+91 (080) 4123-5678</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Toll-free across India</p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-xs text-slate-600">
              <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">Operational Hours</p>
                <p>Monday – Saturday: 9:00 AM – 7:00 PM IST</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Sunday: Closed for maintenance</p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-xs text-slate-600">
              <MapPin className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">Fulfillment Hub</p>
                <p>Aurora Logistics Center, Sector 4, Bangalore 560001, Karnataka, India</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Enquiry Form Column */}
        <div className="md:col-span-2">
          <Card className="p-6 sm:p-8 border border-slate-200">
            {submittedRef ? (
              <div className="text-center py-10 space-y-4">
                <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Enquiry Received</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Thank you for reaching out. Your enquiry ticket has been logged with reference identifier:
                </p>
                <div className="inline-block bg-slate-100 px-4 py-2 rounded-lg font-mono text-xs font-bold text-slate-800">
                  {submittedRef}
                </div>
                <p className="text-[11px] text-slate-400">
                  A representative will review your request and get back to you shortly.
                </p>
                <div className="pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setSubmittedRef(null)}
                  >
                    Submit Another Enquiry
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="text-lg font-bold font-heading text-slate-900">Send an Enquiry</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Jane Doe"
                      className={`w-full text-xs px-3.5 py-2.5 rounded-lg border ${
                        errors.name ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                      } focus:ring-2 focus:ring-indigo-500 focus:outline-none`}
                    />
                    {errors.name && <p className="text-[11px] text-rose-600 mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jane@example.com"
                      className={`w-full text-xs px-3.5 py-2.5 rounded-lg border ${
                        errors.email ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                      } focus:ring-2 focus:ring-indigo-500 focus:outline-none`}
                    />
                    {errors.email && <p className="text-[11px] text-rose-600 mt-1">{errors.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category Topic
                    </label>
                    <select
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="ORDER_STATUS">Order Status & Tracking</option>
                      <option value="RETURN_REFUND">Return & Refund Assistance</option>
                      <option value="PAYMENT_WALLET">Payment Gateway & Wallet</option>
                      <option value="PRODUCT_INQUIRY">Product Sizing & Stock</option>
                      <option value="ACCOUNT">Account & Credentials</option>
                      <option value="OTHER">General Feedback</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Order Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.orderNumber}
                      onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                      placeholder="e.g. ORD-1729-ABCD"
                      className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Brief summary of your question"
                    className={`w-full text-xs px-3.5 py-2.5 rounded-lg border ${
                      errors.subject ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    } focus:ring-2 focus:ring-indigo-500 focus:outline-none`}
                  />
                  {errors.subject && <p className="text-[11px] text-rose-600 mt-1">{errors.subject}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Message Details <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Please include relevant specifics regarding your inquiry..."
                    className={`w-full text-xs px-3.5 py-2.5 rounded-lg border ${
                      errors.message ? "border-rose-400 bg-rose-50/30" : "border-slate-300"
                    } focus:ring-2 focus:ring-indigo-500 focus:outline-none`}
                  />
                  {errors.message && <p className="text-[11px] text-rose-600 mt-1">{errors.message}</p>}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400">
                    Fields marked with <span className="text-rose-500">*</span> are mandatory
                  </span>
                  <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
                    <Send className="h-4 w-4 mr-1.5" />
                    <span>{isSubmitting ? "Submitting..." : "Send Message"}</span>
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
