/**
 * Format ISO date string into human-readable format
 * @param {string|Date} dateInput
 * @returns {string} Formatted date string
 */
export function formatDate(dateInput) {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}
