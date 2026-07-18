const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");
const dotenv = require("dotenv").config();
const { Readable } = require("stream");

// 1. Configure the Client
const s3Client = new S3Client({
  region: "ET-CLOUD-AA1", // Sometimes required by SDK, even if your cloud ignores it
  endpoint: "https://obsv3.et-global-1.ethiotelecom.et", // e.g., https://obs.example.com
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // IMPORTANT: Needed for most S3-compatible providers
});

// 2. Upload Function
async function testUpload() {
  const bucketName = "test-buket";
  const fileName = "test-file.txt";

  // Create a dummy file for testing
  fs.writeFileSync(fileName, "Hello TeddyCloud! This is a connection test.");

  try {
    const fileContent = fs.readFileSync(fileName);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: fileContent,
    });

    const response = await s3Client.send(command);
    console.log("Success! File uploaded. ETag:", response.ETag);
  } catch (err) {
    console.error("Error uploading file:", err.message);
  } finally {
    // Cleanup: remove the test file from your local machine
    fs.unlinkSync(fileName);
  }
}

async function listMyFiles() {
  const command = new ListObjectsV2Command({ Bucket: "test-buket" });
  const response = await s3Client.send(command);
  console.log(
    "Files in bucket:",
    response.Contents.map((f) => f.Key),
  );
}

async function getImageUrl(key) {
  const command = new GetObjectCommand({
    Bucket: "test-buket",
    Key: key,
  });

  // Generate a URL that is valid for 1 hour (3600 seconds)
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  console.log("Copy this link into your browser to see the image:");
  console.log(url);
}

// Call it
// getImageUrl("profile-picture4.jpg");

async function downloadFile(key) {
  const command = new GetObjectCommand({
    Bucket: "test-buket",
    Key: key,
  });

  const response = await s3Client.send(command);

  // Convert the stream to a file
  const writeStream = fs.createWriteStream(`./downloaded_${key}`);
  response.Body.pipe(writeStream);

  console.log(`Successfully downloaded ${key} to your local folder!`);
}

// Call it
downloadFile("profile-picture4.jpg");
