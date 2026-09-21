/**
 * Format numeric value to Indian Rupee currency format (₹)
 * @param {number} amount
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount) {
  if (typeof amount !== "number" || isNaN(amount)) {
    return "₹0.00";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}
