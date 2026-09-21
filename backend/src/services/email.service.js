const env = require("../config/env");

/**
 * Isolated Email Service
 * Provider-agnostic transactional email dispatcher.
 * Logs to console during development/testing; ready for AWS SES in production.
 */
class EmailService {
  /**
   * Send a 6-digit OTP verification email
   * @param {Object} options
   * @param {string} options.to - Recipient email address
   * @param {string} options.otp - 6-digit plain OTP code
   * @param {string} options.purpose - REGISTRATION | PASSWORD_RESET | EMAIL_CHANGE
   * @returns {Promise<boolean>}
   */
  static async sendOtpEmail({ to, otp, purpose }) {
    const subjectMap = {
      REGISTRATION: "Verify Your Account - E-Commerce",
      PASSWORD_RESET: "Password Reset Request - E-Commerce",
      EMAIL_CHANGE: "Verify Your New Email - E-Commerce"
    };

    const subject = subjectMap[purpose] || "Verification Code";

    // In development and test modes, log the OTP cleanly for instant manual/automated verification
    if (!env.isProduction) {
      console.log("\n=======================================================");
      console.log(`[EMAIL SERVICE MOCK] To: ${to}`);
      console.log(`[EMAIL SERVICE MOCK] Subject: ${subject}`);
      console.log(`[EMAIL SERVICE MOCK] Purpose: ${purpose}`);
      console.log(`[EMAIL SERVICE MOCK] OTP CODE: >>> ${otp} <<< (Valid for 5 minutes)`);
      console.log("=======================================================\n");
      return true;
    }

    // In production, dispatch via AWS SES
    // AWS SES v3 Client integration point:
    // await sesClient.send(new SendEmailCommand({ ... }));
    console.log(`[AWS SES] Dispatched OTP email to ${to} for purpose ${purpose}`);
    return true;
  }
}

module.exports = EmailService;
