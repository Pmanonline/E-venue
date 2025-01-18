const VenueVerificationRequest = require("../models/venueVerificationRqstModel");
const Venue = require("../models/venueModel");
const PaymentNotification = require("../models/paymentNotificationModdel");
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

// Helper functions
const uploadToCloudinary = async (file, folder) => {
  try {
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: folder,
      resource_type: "auto",
      timeout: 60000,
    });
    return result.secure_url;
  } catch (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

const deleteFromCloudinary = async (url) => {
  try {
    if (!url) return;
    const publicId = url.split("/").slice(-1)[0].split(".")[0];
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
};

const createVenueVerificationRequest = async (req, res) => {
  const documentUrls = [];
  const safetyDocUrls = [];

  try {
    if (!req.body.verificationData) {
      return res.status(400).json({
        success: false,
        message: "Verification data is required",
      });
    }

    let verificationData =
      typeof req.body.verificationData === "string"
        ? JSON.parse(req.body.verificationData)
        : req.body.verificationData;

    // Check for existing verification request
    const existingVerification = await VenueVerificationRequest.findOne({
      venueId: verificationData.venueId,
      status: { $in: ["pending", "in_review"] },
    });

    if (existingVerification) {
      return res.status(400).json({
        success: false,
        message: "A verification request already exists for this venue",
      });
    }

    // Validate required fields
    const requiredFields = [
      "venueId",
      "venueName",
      "capacity",
      "ownerEmail",
      "ownerPhone",
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

    // Validate and upload documents
    if (!req.files?.documents && !req.files?.safetyDocuments) {
      return res.status(400).json({
        success: false,
        message: "Required documents are missing",
      });
    }

    // Process regular documents
    if (req.files.documents) {
      const documents = Array.isArray(req.files.documents)
        ? req.files.documents
        : [req.files.documents];

      for (const doc of documents) {
        const url = await uploadToCloudinary(
          doc,
          "venue-verification-documents"
        );
        documentUrls.push(url);
      }
    }

    // Process safety documents
    if (req.files.safetyDocuments) {
      const safetyDocs = Array.isArray(req.files.safetyDocuments)
        ? req.files.safetyDocuments
        : [req.files.safetyDocuments];

      for (const doc of safetyDocs) {
        const url = await uploadToCloudinary(doc, "venue-safety-documents");
        safetyDocUrls.push({
          type: String,
          url: url,
          description: doc.description || "Safety Document",
        });
      }
    }

    // Create verification request
    const verificationRequest = new VenueVerificationRequest({
      venueId: verificationData.venueId,
      venueName: verificationData.venueName,
      capacity: verificationData.capacity,
      address: verificationData.address,
      ownerEmail: verificationData.ownerEmail,
      ownerPhone: verificationData.ownerPhone,
      description: verificationData.description,
      documents: documentUrls,
      safetyDocuments: safetyDocUrls,
      userId: req.user._id,
      status: "pending",
    });

    await verificationRequest.save();

    // Create notification for admin
    const notification = new PaymentNotification({
      userId: req.user._id,
      type: "VENUE_VERIFICATION_REQUEST",
      title: "New Venue Verification Request",
      message: `New verification request for venue: ${verificationData.venueName}`,
      recipients: ["admin"],
      relatedData: {
        requestId: verificationRequest._id,
      },
    });

    await notification.save();

    res.status(201).json({
      success: true,
      message: "Venue verification request submitted successfully",
      verificationRequest,
    });
  } catch (error) {
    console.error("Venue verification request error:", error);

    // Cleanup uploaded files on error
    [...documentUrls, ...safetyDocUrls].forEach(async (url) => {
      try {
        await deleteFromCloudinary(url);
      } catch (deleteError) {
        console.error("Error deleting file:", deleteError);
      }
    });

    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit venue verification request",
    });
  }
};

const getVenueVerificationRequests = async (req, res) => {
  try {
    const { id, status, venueName, startDate, endDate } = req.query;
    const query = {};

    // Single request lookup
    if (id) {
      const request = await VenueVerificationRequest.findById(id);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Verification request not found",
        });
      }

      // Authorization check
      if (
        req.user.role !== "admin" &&
        request.userId.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this request",
        });
      }

      return res.status(200).json({
        success: true,
        verificationRequest: request,
      });
    }

    // Build query for multiple requests
    if (status) query.status = status;
    if (venueName) query.venueName = { $regex: venueName, $options: "i" };
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Non-admin users can only view their own requests
    if (req.user.role !== "admin") {
      query.userId = req.user._id;
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await VenueVerificationRequest.countDocuments(query);
    const requests = await VenueVerificationRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: requests.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      verificationRequests: requests,
    });
  } catch (error) {
    console.error("Get venue verification requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve verification requests",
    });
  }
};

// Delete venue verification request
const deleteVenueVerificationRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Verification request ID is required",
      });
    }

    const verificationRequest = await VenueVerificationRequest.findById(id);

    if (!verificationRequest) {
      return res.status(404).json({
        success: false,
        message: "Verification request not found",
      });
    }

    // Check authorization
    if (
      req.user.role !== "admin" &&
      verificationRequest.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this request",
      });
    }

    // Delete associated documents from Cloudinary
    for (const documentUrl of verificationRequest.documents) {
      await deleteFromCloudinary(documentUrl);
    }

    // Delete safety documents
    for (const safetyDoc of verificationRequest.safetyDocuments) {
      await deleteFromCloudinary(safetyDoc.url);
    }

    // Delete the verification request
    await VenueVerificationRequest.findByIdAndDelete(id);

    // Create notification for venue owner
    const notification = new PaymentNotification({
      userId: verificationRequest.userId,
      title: "Venue Verification Request Deleted",
      type: "VENUE_VERIFICATION_DELETED",
      message: "Your venue verification request has been deleted",
      recipients: [verificationRequest.userId],
      relatedData: {
        venueName: verificationRequest.venueName,
      },
    });

    await notification.save();

    res.status(200).json({
      success: true,
      message: "Venue verification request deleted successfully",
    });
  } catch (error) {
    console.error("Delete venue verification request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete verification request",
      error: error.message,
    });
  }
};

const getVenueVerificationRequestByVenue = async (req, res) => {
  try {
    const { venueId } = req.params;

    if (!venueId) {
      return res.status(400).json({
        success: false,
        message: "Venue ID is required",
      });
    }

    const verificationRequest = await VenueVerificationRequest.findOne({
      venueId,
      status: { $in: ["pending", "in_review"] },
    });

    // Check authorization
    if (
      verificationRequest &&
      req.user.role !== "admin" &&
      verificationRequest.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this request",
      });
    }

    res.status(200).json({
      success: true,
      verificationRequest,
    });
  } catch (error) {
    console.error("Get venue verification request error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching verification request",
      error: error.message,
    });
  }
};

// Update venue verification status (admin only)
const updateVenueVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;

    if (!id || !status) {
      return res.status(400).json({
        success: false,
        message: "Request ID and status are required",
      });
    }

    if (!["pending", "in_review", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const verificationRequest = await VenueVerificationRequest.findById(id);

    if (!verificationRequest) {
      return res.status(404).json({
        success: false,
        message: "Verification request not found",
      });
    }

    verificationRequest.status = status;
    if (comments) {
      verificationRequest.adminComments = comments;
    }

    await verificationRequest.save();

    // Create notification for venue owner
    const notification = new PaymentNotification({
      userId: verificationRequest.userId,
      type: "VENUE_VERIFICATION_UPDATE",
      title: "Venue Verification Status Updated",
      message: `Your venue verification request for ${verificationRequest.venueName} has been ${status}`,
      recipients: [verificationRequest.userId],
      relatedData: {
        requestId: verificationRequest._id,
        status,
        comments,
      },
    });

    await notification.save();

    res.status(200).json({
      success: true,
      message: "Verification status updated successfully",
      verificationRequest,
    });
  } catch (error) {
    console.error("Update venue verification status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: error.message,
    });
  }
};

module.exports = {
  createVenueVerificationRequest,
  getVenueVerificationRequests,
  deleteVenueVerificationRequest,
  getVenueVerificationRequestByVenue,
  updateVenueVerificationStatus,
};
