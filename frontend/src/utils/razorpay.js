/**
 * Asynchronously loads Razorpay Checkout.js client library
 *
 * @returns {Promise<boolean>} Resolves true when loaded, false if script loading fails
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Launch Razorpay checkout modal with server-authoritative checkout details
 *
 * @param {Object} params
 * @param {Object} params.checkoutInfo Server generated checkout configuration
 * @param {Function} params.onSuccess Verification callback handler
 * @param {Function} [params.onFailure] Gateway payment failure event handler
 * @param {Function} [params.onDismiss] Modal dismissal callback
 */
export async function launchRazorpayModal({
  checkoutInfo,
  onSuccess,
  onFailure,
  onDismiss
}) {
  const isLoaded = await loadRazorpayScript();

  if (!isLoaded) {
    throw new Error(
      "Failed to load Razorpay payment gateway SDK. Please check your network connection."
    );
  }

  const options = {
    key: checkoutInfo.keyId,
    amount: checkoutInfo.amount,
    currency: checkoutInfo.currency || "INR",
    name: "AURORA LUXURY",
    description: `Order #${checkoutInfo.orderNumber}`,
    order_id: checkoutInfo.razorpayOrderId,
    prefill: checkoutInfo.prefill || {},
    theme: {
      color: "#4f46e5" // Indigo brand color
    },
    handler: function (response) {
      if (onSuccess) {
        onSuccess(response);
      }
    },
    modal: {
      ondismiss: function () {
        if (onDismiss) {
          onDismiss();
        }
      }
    }
  };

  const rzp = new window.Razorpay(options);

  if (onFailure) {
    rzp.on("payment.failed", function (response) {
      onFailure(response);
    });
  }

  rzp.open();
  return rzp;
}
