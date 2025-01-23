const ServiceInterest = require("../models/serviceInterestModel");
const paymentNotificationForAdmin = require("../models/paymentNotificationForAdmin");
const Service = require("../models/businessModel");

// Utility function for notifications
const createNotification = async (data) => {
  try {
    const notification = new paymentNotificationForAdmin({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      recipients: data.recipients,
      relatedData: data.relatedData,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error("Notification creation error:", error);
    throw new Error("Failed to create notification");
  }
};

// Create service interest
const createServiceInterest = async (req, res) => {
  try {
    const {
      serviceId,
      fullName,
      email,
      phoneNumber,
      preferredDate,
      additionalNotes,
    } = req.body;

    // Validate required fields
    if (!serviceId || !fullName || !email || !phoneNumber || !preferredDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check if service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }
    console.log(serviceId,"serviceId")
    console.log(service,"service")

    // Create service interest
    const serviceInterest = new ServiceInterest({
      serviceId,
      userId: req.user._id,
      fullName,
      email,
      phoneNumber,
      preferredDate,
      additionalNotes,
       status: "pending"
    });

    await serviceInterest.save();

    // Create notification for admin
    await createNotification({
      userId: req.user._id,
      type: "SERVICE_INTEREST",
      title: "New Service Interest",
      message: `New interest request for service: ${service.name}`,
      recipients: ["admin"],
      relatedData: {
        interestId: serviceInterest._id,
        serviceName: service.name,
        preferredDate,
      },
    });

    res.status(201).json({
      success: true,
      message: "Service interest submitted successfully",
      serviceInterest,
    });
  } catch (error) {
    console.error("Create service interest error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit service interest",
      error: error.message,
    });
  }
};

// Get service interests
// const getServiceInterests = async (req, res) => {
//     try {
//       const { serviceId, serviceName, status, page = 1, limit = 10 } = req.query;
//       const query = {};
  
//       // Build query filters
//       if (serviceId) {
//         query['serviceId._id'] = serviceId;
//       }
      
//       if (serviceName) {
//         query['serviceId.name'] = { $regex: serviceName, $options: 'i' };
//       }
  
//       if (status) {
//         query.status = status.toLowerCase();
//       }
  
//       // Non-admin users can only view their own interests
//       if (req.user.role !== "admin") {
//         query.userId = req.user._id;
//       }
  
//       // Calculate pagination
//       const skip = (page - 1) * limit;
      
//       const total = await ServiceInterest.countDocuments(query);
      
//       const interests = await ServiceInterest.find(query)
//         .populate('serviceId', 'name _id')
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(parseInt(limit));
  
//       const totalPages = Math.ceil(total / limit);
  
//       res.status(200).json({
//         success: true,
//         interests,
//         currentPage: parseInt(page),
//         totalPages,
//         total
//       });
//     } catch (error) {
//       console.error("Get service interests error:", error);
//       res.status(500).json({
//         success: false,
//         message: "Failed to retrieve service interests",
//         error: error.message,
//       });
//     }
//   };
const getServiceInterests = async (req, res) => {
    try {
      const { serviceId, serviceName, status, page = 1, limit = 10 } = req.query;
      let query = {};
  
      // If serviceId is provided, search by exact ID
      if (serviceId) {
        query.serviceId = serviceId;
      }
  
      // If serviceName is provided, first find matching services
      if (serviceName) {
        const matchingServices = await Service.find({
          name: { $regex: serviceName, $options: 'i' }
        }).select('_id');
        
        const serviceIds = matchingServices.map(service => service._id);
        
        if (serviceIds.length > 0) {
          // If we found matching services, add their IDs to the query
          query.serviceId = { $in: serviceIds };
        } else {
          // If no services match the name, return empty results
          return res.status(200).json({
            success: true,
            interests: [],
            currentPage: parseInt(page),
            totalPages: 0,
            total: 0
          });
        }
      }
  
      // Add status filter if provided
      if (status) {
        query.status = status.toLowerCase();
      }
  
      // Add user filter for non-admin users
      if (req.user.role !== "admin") {
        query.userId = req.user._id;
      }
  
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Get total count for pagination
      const total = await ServiceInterest.countDocuments(query);
      
      // Get paginated results with populated service details
      const interests = await ServiceInterest.find(query)
        .populate('serviceId', 'name _id')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
  
      const totalPages = Math.ceil(total / parseInt(limit));
  
      res.status(200).json({
        success: true,
        interests,
        currentPage: parseInt(page),
        totalPages,
        total
      });
    } catch (error) {
      console.error("Get service interests error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve service interests",
        error: error.message
      });
    }
  };
// Delete service interest
const deleteServiceInterest = async (req, res) => {
  try {
    const { id } = req.params;

    const interest = await ServiceInterest.findById(id);
    if (!interest) {
      return res.status(404).json({
        success: false,
        message: "Service interest not found",
      });
    }

    // Check authorization
    if (
      req.user.role !== "admin" &&
      interest.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this interest",
      });
    }

    await ServiceInterest.findByIdAndDelete(id);

    // Create notification for user
    await createNotification({
      userId: interest.userId,
      type: "SERVICE_INTEREST_DELETED",
      title: "Service Interest Deleted",
      message: "Your service interest request has been deleted",
      recipients: [interest.userId],
      relatedData: {
        serviceId: interest.serviceId,
      },
    });

    res.status(200).json({
      success: true,
      message: "Service interest deleted successfully",
    });
  } catch (error) {
    console.error("Delete service interest error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete service interest",
      error: error.message,
    });
  }
};

module.exports = {
  createServiceInterest,
  getServiceInterests,
  deleteServiceInterest,
};