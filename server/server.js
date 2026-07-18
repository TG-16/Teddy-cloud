const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const dotenv= require("dotenv").config();

// 1. Configure the Client
const s3Client = new S3Client({
  region: "ET-CLOUD-AA1", // Sometimes required by SDK, even if your cloud ignores it
  endpoint: "obsv3.et-global-1.ethiotelecom.et", // e.g., https://obs.example.com
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

testUpload();