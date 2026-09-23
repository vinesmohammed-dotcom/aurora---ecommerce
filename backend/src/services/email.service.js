const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const env = require("../config/env");

/**
 * Isolated Email Service
 * Provider-agnostic transactional email dispatcher.
 * Logs to console during development/testing; dispatches via AWS SES in production.
 */
class EmailService {
  static sesClient = null;

  /**
   * Lazily initialize the SESClient instance
   */
  static getSesClient() {
    if (!this.sesClient) {
      const config = {
        region: env.AWS_REGION
      };

      if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
        config.credentials = {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY
        };
      }

      this.sesClient = new SESClient(config);
    }
    return this.sesClient;
  }

  /**
   * Check if AWS SES is fully configured
   */
  static isConfigured() {
    return Boolean(
      env.isProduction &&
      (env.AWS_ACCESS_KEY_ID || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || process.env.AWS_EC2_METADATA_DISABLED !== "true")
    );
  }

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
      REGISTRATION: "Verify Your Account - Aurora Store",
      PASSWORD_RESET: "Password Reset Request - Aurora Store",
      EMAIL_CHANGE: "Verify Your New Email - Aurora Store"
    };

    const subject = subjectMap[purpose] || "Verification Code - Aurora Store";

    // In development and test modes, log the OTP cleanly for instant manual/automated verification
    if (!this.isConfigured()) {
      console.log("\n=======================================================");
      console.log(`[EMAIL SERVICE MOCK] To: ${to}`);
      console.log(`[EMAIL SERVICE MOCK] Subject: ${subject}`);
      console.log(`[EMAIL SERVICE MOCK] Purpose: ${purpose}`);
      console.log(`[EMAIL SERVICE MOCK] OTP CODE: >>> ${otp} <<< (Valid for 5 minutes)`);
      console.log("=======================================================\n");
      return true;
    }

    // In production with AWS credentials, dispatch via AWS SES v3 Client
    try {
      const client = this.getSesClient();
      const command = new SendEmailCommand({
        Source: env.AWS_SES_FROM_EMAIL,
        Destination: {
          ToAddresses: [to]
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: "UTF-8"
          },
          Body: {
            Html: {
              Data: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <h2 style="color: #0f172a; margin-bottom: 8px;">Aurora E-Commerce</h2>
                  <p style="color: #475569; font-size: 15px;">Your verification code for <strong>${purpose}</strong> is:</p>
                  <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb;">${otp}</span>
                  </div>
                  <p style="color: #64748b; font-size: 13px;">This code is valid for 5 minutes. If you did not request this, please disregard this email.</p>
                </div>
              `,
              Charset: "UTF-8"
            },
            Text: {
              Data: `Your Aurora Store verification code for ${purpose} is: ${otp}. It expires in 5 minutes.`,
              Charset: "UTF-8"
            }
          }
        }
      });

      await client.send(command);
      console.log(`[AWS SES] Dispatched OTP email to ${to} for purpose ${purpose}`);
      return true;
    } catch (err) {
      console.error(`[AWS SES ERROR] Failed to dispatch email to ${to}:`, err.message);
      // Fall back to console log so customer is not locked out during email gateway degradation
      console.log(`[FALLBACK OTP CODE] >>> ${otp} <<<`);
      return false;
    }
  }
}

module.exports = EmailService;
