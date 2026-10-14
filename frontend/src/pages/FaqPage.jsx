import React, { useState } from "react";
import Card from "../components/ui/Card";
import { Search, ChevronDown, HelpCircle, Package, CreditCard, RotateCcw, ShieldCheck } from "lucide-react";

export default function FaqPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [openItems, setOpenItems] = useState({ 0: true });

  const faqs = [
    {
      id: 0,
      category: "ORDERS",
      question: "How do I track my order once placed?",
      answer:
        "Once your order is confirmed, you can track its progress in real-time under the 'Orders' section of your account. You will see milestone updates ranging from Confirmed, Processing, Shipped, to Delivered with timestamps."
    },
    {
      id: 1,
      category: "ORDERS",
      question: "Can I cancel an order after placing it?",
      answer:
        "Yes, orders in Pending, Confirmed, or Processing status can be cancelled directly from your Orders page. Delivers or shipped orders cannot be cancelled mid-transit; however, you may initiate an easy return within 7 days of delivery."
    },
    {
      id: 2,
      category: "PAYMENTS",
      question: "What payment methods are supported on Aurora?",
      answer:
        "We support Cash on Delivery (COD) for eligible items, Instant Online Checkout via Razorpay (UPI, Credit/Debit Cards, Net Banking), and Aurora Customer Wallet balances."
    },
    {
      id: 3,
      category: "PAYMENTS",
      question: "How does wallet refund processing work?",
      answer:
        "Refunds issued to your Aurora Wallet are processed instantly upon admin approval and immediately available for your next purchase. Card/UPI refunds via Razorpay are routed back to the original funding source within 5 to 7 banking business days."
    },
    {
      id: 4,
      category: "SHIPPING",
      question: "What are your delivery timelines and shipping charges?",
      answer:
        "Standard delivery across India takes 3 to 5 business days. We offer free shipping on all orders over ₹999. Orders below ₹999 incur a nominal ₹99 shipping and handling fee, visible clearly at checkout before payment."
    },
    {
      id: 5,
      category: "RETURNS",
      question: "What is your return policy and how do I request one?",
      answer:
        "We maintain a 7-day return window starting on the delivery date. To initiate a return, open your order details in the Orders page, click 'Request Return', select your reason, and submit. Once our logistics team collects and inspects the item, your refund is approved and credited."
    },
    {
      id: 6,
      category: "ACCOUNT",
      question: "Can I sign in using Google Sign-In?",
      answer:
        "Yes! Aurora supports Google One-Tap and Google Sign-In. You can log in or create an account with a single click using your verified Google credentials."
    },
    {
      id: 7,
      category: "SECURITY",
      question: "Are my personal details and payment data secure?",
      answer:
        "Yes. Aurora employs encrypted sessions, server-authoritative payment verification, industry-standard AES-256 data transmission over TLS, and does not store sensitive card or CVV details on our servers."
    }
  ];

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = activeCategory === "ALL" || faq.category === activeCategory;
    const matchesQuery =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const toggleItem = (id) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold font-heading text-slate-900 tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-sm text-slate-500 max-w-lg mx-auto">
          Quick answers to common questions about orders, payments, shipping, returns, and security.
        </p>

        {/* Search Input */}
        <div className="relative max-w-md mx-auto mt-6">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions or keywords..."
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 bg-white shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[
          { key: "ALL", label: "All Questions", icon: HelpCircle },
          { key: "ORDERS", label: "Orders", icon: Package },
          { key: "PAYMENTS", label: "Payments & Wallet", icon: CreditCard },
          { key: "SHIPPING", label: "Shipping", icon: Package },
          { key: "RETURNS", label: "Returns & Refunds", icon: RotateCcw },
          { key: "SECURITY", label: "Trust & Security", icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeCategory === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveCategory(tab.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                isActive
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* FAQ Accordion List */}
      <div className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No questions found matching your search. Try adjusting keywords or viewing all categories.
          </div>
        ) : (
          filteredFaqs.map((faq) => {
            const isOpen = Boolean(openItems[faq.id]);
            return (
              <Card
                key={faq.id}
                className="overflow-hidden border border-slate-200 transition-shadow hover:shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => toggleItem(faq.id)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left text-xs sm:text-sm font-semibold text-slate-900 bg-white hover:bg-slate-50/60 transition"
                >
                  <span className="pr-4">{faq.question}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-indigo-600" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/40">
                    {faq.answer}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
