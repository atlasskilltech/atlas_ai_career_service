const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET;

function isConfigured() {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && BUCKET);
}

/**
 * Upload a file buffer to S3
 * @param {Buffer} buffer - File contents
 * @param {string} originalName - Original filename
 * @param {string} folder - S3 folder prefix (e.g. 'documents', 'resumes', 'profiles')
 * @param {string} mimeType - MIME type
 * @returns {Promise<{key: string, url: string}>}
 */
async function upload(buffer, originalName, folder, mimeType) {
  const ext = path.extname(originalName);
  const key = `uploads/${folder}/${uuidv4()}${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));

  const url = `https://${BUCKET}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
  return { key, url };
}

/**
 * Delete a file from S3 by key
 * @param {string} key - S3 object key
 */
async function remove(key) {
  if (!key) return;
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

/**
 * Get file buffer from S3
 * @param {string} key - S3 object key
 * @returns {Promise<Buffer>}
 */
async function getBuffer(key) {
  const resp = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
  const chunks = [];
  for await (const chunk of resp.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = { s3, upload, remove, getBuffer, isConfigured, BUCKET };
