const VerificationRequest = require("../models/verificationRequestModel");
const PaymentNotification = require("../models/paymentNotificationModdel");
const paymentNotificationForAdmin = require("../models/paymentNotificationForAdmin");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const util = require("util");
const writeFile = util.promisify(fs.writeFile);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload file to Cloudinary
const uploadToCloudinary = async (file) => {
  try {
    if (!file) {
      throw new Error("No file provided");
    }

    // Debug file object
    console.log("File object structure:", {
      name: file.name,
      size: file.size,
      encoding: file.encoding,
      mimetype: file.mimetype,
      tempFilePath: file.tempFilePath,
      truncated: file.truncated,
      hasData: !!file.data,
      dataType: file.data ? typeof file.data : null,
      isBuffer: file.data instanceof Buffer,
    });

    // Use tempFilePath if available (express-fileupload creates this)
    if (file.tempFilePath && fs.existsSync(file.tempFilePath)) {
      console.log("Using tempFilePath for upload:", file.tempFilePath);

      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: "verification-documents",
        resource_type: "auto",
        timeout: 60000,
      });

      return result.secure_url;
    }

    // Fallback to handling the file data directly
    if (!file.data) {
      throw new Error("No file data available");
    }

    // Create a temporary file path
    const timestamp = Date.now();
    const tempPath = `/tmp/${timestamp}-${file.name}`;

    console.log("Creating temporary file at:", tempPath);

    // Ensure we have a Buffer
    let fileBuffer;
    if (file.data instanceof Buffer) {
      fileBuffer = file.data;
    } else if (typeof file.data === "string") {
      fileBuffer = Buffer.from(file.data, "base64");
    } else {
      throw new Error(`Invalid file data type: ${typeof file.data}`);
    }

    // Log buffer information
    console.log("Buffer info:", {
      length: fileBuffer.length,
      isBuffer: Buffer.isBuffer(fileBuffer),
      firstBytes: fileBuffer.length > 10 ? fileBuffer.slice(0, 10) : fileBuffer,
    });

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error("Empty file buffer");
    }

    // Write buffer to temporary file
    await writeFile(tempPath, fileBuffer);

    // Verify file was written correctly
    const stats = await fs.promises.stat(tempPath);
    console.log("Written file stats:", {
      size: stats.size,
      path: tempPath,
    });

    if (stats.size === 0) {
      throw new Error("Empty file created");
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(tempPath, {
      folder: "verification-documents",
      resource_type: "auto",
      timeout: 60000,
    });

    // Clean up temp file
    try {
      await fs.promises.unlink(tempPath);
      console.log("Temporary file deleted:", tempPath);
    } catch (unlinkError) {
      console.warn("Failed to delete temp file:", unlinkError);
    }

    return result.secure_url;
  } catch (error) {
    console.error("Detailed upload error:", {
      message: error.message,
      stack: error.stack,
      fileInfo: file
        ? {
            name: file.name,
            size: file.size,
            mimetype: file.mimetype,
          }
        : "No file",
    });
    throw new Error(`Failed to upload document: ${error.message}`);
  }
};

// Helper function to delete file from Cloudinary
const deleteFromCloudinary = async (url) => {
  try {
    if (!url) return;

    const publicId = url.split("/").slice(-1)[0].split(".")[0];
    await cloudinary.uploader.destroy(`verification-documents/${publicId}`);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
};

// Create verification request
const createVerificationRequest = async (req, res) => {
  const documentUrls = [];

  try {
    // Enhanced request debugging
    console.log("Detailed request info:", {
      hasFiles: !!req.files,
      fileKeys: req.files ? Object.keys(req.files) : [],
      documentsInfo: req.files?.documents
        ? {
            isArray: Array.isArray(req.files.documents),
            length: Array.isArray(req.files.documents)
              ? req.files.documents.length
              : 1,
            type: typeof req.files.documents,
            firstDocInfo: Array.isArray(req.files.documents)
              ? {
                  name: req.files.documents[0].name,
                  size: req.files.documents[0].size,
                  mimetype: req.files.documents[0].mimetype,
                  hasTempPath: !!req.files.documents[0].tempFilePath,
                }
              : null,
          }
        : null,
      body: {
        hasVerificationData: !!req.body.verificationData,
        verificationDataType: typeof req.body.verificationData,
      },
    });

    // Validate and parse verification data
    if (!req.body.verificationData) {
      return res.status(400).json({
        success: false,
        message: "Verification data is required",
      });
    }

    let verificationData;
    try {
      verificationData =
        typeof req.body.verificationData === "string"
          ? JSON.parse(req.body.verificationData)
          : req.body.verificationData;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification data format",
      });
    }

    // Check for existing verification request
    const existingVerification = await VerificationRequest.findOne({
      businessId: verificationData.businessId,
      status: { $in: ["pending", "in_review"] },
    });

    if (existingVerification) {
      return res.status(400).json({
        success: false,
        message:
          "A verification request has already been submitted for this business. Please check your notifications for verification updates.",
        requestId: existingVerification._id,
      });
    }

    // Validate required fields
    const requiredFields = [
      "businessId",
      "businessName",
      "fullAddress",
      "email",
      "phoneNumber",
      "description",
    ];
    const missingFields = requiredFields.filter(
      (field) => !verificationData[field]
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Validate files
    if (!req.files?.documents) {
      return res.status(400).json({
        success: false,
        message: "No documents uploaded",
      });
    }

    const documents = Array.isArray(req.files.documents)
      ? req.files.documents
      : [req.files.documents];

    if (documents.length > 3) {
      return res.status(400).json({
        success: false,
        message: "Maximum 3 documents allowed",
      });
    }

    // Validate file types and sizes
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    const maxSize = 5 * 1024 * 1024; // 5MB

    for (const doc of documents) {
      if (!allowedTypes.includes(doc.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `Invalid file type for ${doc.name}. Only JPEG, PNG, and PDF files are allowed.`,
        });
      }
      if (doc.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: `File ${doc.name} exceeds 5MB limit`,
        });
      }
    }

    // Upload documents with enhanced error handling
    for (const document of documents) {
      try {
        console.log(`Starting upload for document: ${document.name}`);
        const url = await uploadToCloudinary(document);
        if (!url) {
          throw new Error("Upload returned empty URL");
        }
        console.log(`Successfully uploaded ${document.name} to: ${url}`);
        documentUrls.push(url);
      } catch (uploadError) {
        throw new Error(
          `Failed to upload ${document.name}: ${uploadError.message}`
        );
      }
    }

    // Create and save verification request
    const verificationRequest = new VerificationRequest({
      businessId: verificationData.businessId,
      businessName: verificationData.businessName,
      fullAddress: verificationData.fullAddress,
      email: verificationData.email,
      phoneNumber: verificationData.phoneNumber,
      description: verificationData.description,
      documents: documentUrls,
      userId: req.user?._id,
      status: "pending",
    });

    await verificationRequest.save();

    //   Create notification
    const notification = new paymentNotificationForAdmin({
      userId: req.user._id,
      type: "VERIFICATION_REQUEST",
      title: "Submitted Documents for Verification",
      message: `New verification request from ${verificationData.businessName}`,
      recipients: ["admin"],
      relatedData: {
        requestId: verificationRequest._id,
      },
    });

    await notification.save();
    res.status(201).json({
      success: true,
      message: "Verification request submitted successfully",
      verificationRequest,
    });
  } catch (error) {
    console.error("Create verification request error:", error);

    // Clean up uploaded files on error
    for (const url of documentUrls) {
      try {
        await deleteFromCloudinary(url);
      } catch (deleteError) {
        console.error("Error deleting file:", deleteError);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit verification request",
    });
  }
};

// Delete verification request
const deleteVerificationRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Verification request ID is required",
      });
    }

    const verificationRequest = await VerificationRequest.findById(id);

    if (!verificationRequest) {
      return res.status(404).json({
        success: false,
        message: "Verification request not found",
      });
    }

    // Delete associated documents from Cloudinary
    for (const documentUrl of verificationRequest.documents) {
      await deleteFromCloudinary(documentUrl);
    }

    // Delete the verification request
    await VerificationRequest.findByIdAndDelete(id);

    //     // Create notification
    const notification = new PaymentNotification({
      userId: req.user._id,
      title: "Verification Request removed, Sumbmit proper documents",
      type: "VERIFICATION_DELETED",
      message: "Your verification request has been removed",
      recipients: [verificationRequest.userId],
      relatedData: {
        businessName: verificationRequest.businessName,
      },
    });

    await notification.save();

    res.status(200).json({
      success: true,
      message: "Verification request deleted successfully",
    });
  } catch (error) {
    console.error("Delete verification request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete verification request",
      error: error.message,
    });
  }
};

// Get verification requests (single or multiple)
const getVerificationRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, businessName, startDate, endDate } = req.query;

    // If ID is provided, return single verification request
    if (id) {
      const verificationRequest = await VerificationRequest.findById(id);

      if (!verificationRequest) {
        return res.status(404).json({
          success: false,
          message: "Verification request not found",
        });
      }

      // Check if user has permission to view this request
      if (
        req.user.role !== "admin" &&
        verificationRequest.userId.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this verification request",
        });
      }

      return res.status(200).json({
        success: true,
        verificationRequest,
      });
    }

    // Build query for multiple requests
    const query = {};

    // Add filters if provided
    if (status) {
      query.status = status;
    }

    if (businessName) {
      query.businessName = { $regex: businessName, $options: "i" };
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // If not admin, only show user's own requests
    if (req.user.role !== "admin") {
      query.userId = req.user._id;
    }

    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await VerificationRequest.countDocuments(query);

    // Get verification requests
    const verificationRequests = await VerificationRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: verificationRequests.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      verificationRequests,
    });
  } catch (error) {
    console.error("Get verification request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve verification request(s)",
      error: error.message,
    });
  }
};

const getVerificationRequestByBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const verificationRequest = await VerificationRequest.findOne({
      businessId,
      status: "pending",
    });

    res.json({
      success: true,
      verificationRequest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching verification request",
      error: error.message,
    });
  }
};

module.exports = {
  createVerificationRequest,
  getVerificationRequestByBusiness,
  deleteVerificationRequest,
  getVerificationRequest,
};
