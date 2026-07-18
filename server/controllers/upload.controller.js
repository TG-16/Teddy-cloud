const {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  ListPartsCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const pool = require("../config/db");

const s3Client = new S3Client({
  region: "ET-CLOUD-AA1",
  endpoint: "https://obsv3.et-global-1.ethiotelecom.et",
  credentials: {
    accessKeyId: process.env.OBS_ACCESS_KEY,
    secretAccessKey: process.env.OBS_SECRET_KEY,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = "test-buket";

// 1. Initiate
exports.initiateUpload = async (req, res) => {
  const { fileName, fileSize } = req.body;
  const userId = req.user.id;
  const { allocated_storage_gb, used_bytes } = req.userMetadata;

  if (used_bytes + fileSize > allocated_storage_gb * 1024 ** 3) {
    return res.status(403).json({ error: "Insufficient storage" });
  }

  const key = `user_${userId}/${Date.now()}_${fileName}`;
  const command = new CreateMultipartUploadCommand({ Bucket: BUCKET_NAME, Key: key });
  const s3Response = await s3Client.send(command);

  const insert = await pool.query(
    "INSERT INTO file_uploads (user_id, s3_upload_id, file_key, file_name, total_size) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [userId, s3Response.UploadId, key, fileName, fileSize]
  );

  res.json({ uploadDbId: insert.rows[0].id, s3UploadId: s3Response.UploadId, key });
};

// 2. Presigned URL for Part
exports.getPresignedUrlForPart = async (req, res) => {
  const { s3UploadId, key, partNumber } = req.body;
  const command = new UploadPartCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: s3UploadId,
    PartNumber: partNumber,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  res.json({ url });
};

// 3. List Parts (Used for Resumption/Discovery)
exports.listUploadedParts = async (req, res) => {
  const { s3UploadId, key } = req.body;
  try {
    const command = new ListPartsCommand({ Bucket: BUCKET_NAME, Key: key, UploadId: s3UploadId });
    const data = await s3Client.send(command);
    res.json({ uploadedParts: data.Parts }); // Returns array of { PartNumber, ETag }
  } catch (err) {
    res.status(500).json({ error: "Could not retrieve upload status" });
  }
};

// 4. Complete Upload (Uses S3 as Source of Truth)
exports.completeUpload = async (req, res) => {
  const { uploadDbId, s3UploadId, key } = req.body;

  try {
    // A. Fetch existing parts directly from S3
    const listCommand = new ListPartsCommand({ Bucket: BUCKET_NAME, Key: key, UploadId: s3UploadId });
    const { Parts } = await s3Client.send(listCommand);

    // B. Finalize S3 Multipart
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: s3UploadId,
      MultipartUpload: { Parts: Parts }, // S3 ignores out-of-order, but sorted is safer
    });

    await s3Client.send(completeCommand);

    // C. Database Finalization
    await pool.query("UPDATE file_uploads SET status = 'COMPLETED' WHERE id = $1", [uploadDbId]);
    
    // TODO: Add logic here to move metadata to 'user_files' and update usage
    
    res.json({ message: "Upload complete" });
  } catch (err) {
    console.error("Complete Upload Error:", err);
    res.status(500).json({ error: "Failed to finalize upload" });
  }
};