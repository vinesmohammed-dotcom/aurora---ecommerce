const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const env = require("../config/env");

/**
 * AWS S3 Storage Service
 * Provides secure object storage operations for product media, customer return proofs,
 * and executive report archives. Supports direct-to-S3 presigned URLs (least privilege)
 * and server-side streaming uploads.
 */
class S3Service {
  static client = null;

  /**
   * Lazily initialize the S3Client instance
   */
  static getClient() {
    if (!this.client) {
      const config = {
        region: env.AWS_REGION
      };

      // In EC2 with IAM Instance Profiles, credentials are automatically resolved.
      // If explicit keys are provided in .env, use them.
      if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
        config.credentials = {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY
        };
      }

      this.client = new S3Client(config);
    }
    return this.client;
  }

  /**
   * Check if AWS S3 is fully configured
   */
  static isConfigured() {
    return Boolean(env.AWS_S3_BUCKET && (env.AWS_ACCESS_KEY_ID || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || process.env.AWS_EC2_METADATA_DISABLED !== "true"));
  }

  /**
   * Generate a Presigned URL for client-side direct upload
   * @param {Object} options
   * @param {string} options.key - Destination S3 object key (e.g. 'products/watch-1.jpg')
   * @param {string} options.contentType - MIME type (e.g. 'image/jpeg')
   * @param {number} [options.expiresIn=300] - Expiration in seconds (default 5 minutes)
   * @returns {Promise<{ uploadUrl: string, key: string, publicUrl: string }>}
   */
  static async getPresignedUploadUrl({ key, contentType, expiresIn = 300 }) {
    if (!this.isConfigured() && !env.isProduction) {
      // Mock upload URL for local development/testing
      return {
        uploadUrl: `http://localhost:5000/api/v1/mock-s3-upload/${key}`,
        key,
        publicUrl: `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`
      };
    }

    const s3 = this.getClient();
    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn });
    const publicUrl = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

    return { uploadUrl, key, publicUrl };
  }

  /**
   * Generate a Presigned URL for private asset download
   * @param {Object} options
   * @param {string} options.key - S3 object key
   * @param {number} [options.expiresIn=3600] - Expiration in seconds (default 1 hour)
   * @returns {Promise<string>}
   */
  static async getPresignedDownloadUrl({ key, expiresIn = 3600 }) {
    if (!this.isConfigured() && !env.isProduction) {
      return `http://localhost:5000/api/v1/mock-s3-download/${key}`;
    }

    const s3 = this.getClient();
    const command = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key
    });

    return await getSignedUrl(s3, command, { expiresIn });
  }

  /**
   * Upload a memory Buffer directly from server to S3
   * @param {Object} options
   * @param {string} options.key - Destination S3 object key
   * @param {Buffer} options.buffer - Binary file buffer
   * @param {string} options.contentType - MIME type
   * @returns {Promise<{ key: string, location: string }>}
   */
  static async uploadBuffer({ key, buffer, contentType }) {
    if (!this.isConfigured() && !env.isProduction) {
      console.log(`[S3 MOCK] Uploaded buffer (${buffer.length} bytes) to mock key: ${key}`);
      return {
        key,
        location: `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`
      };
    }

    const s3 = this.getClient();
    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType
    });

    await s3.send(command);
    return {
      key,
      location: `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`
    };
  }
}

module.exports = S3Service;
