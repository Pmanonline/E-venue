// const nodemailer = require("nodemailer");
// const QRCode = require("qrcode");
// const crypto = require("crypto");

// // Email transporter configuration
// const transporter = nodemailer.createTransport({
//   service: "Gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
//   tls: {
//     rejectUnauthorized: false,
//   },
// });

// // Generate secure hash for QR data
// const generateSecureHash = (data) => {
//   const secret = process.env.QR_SECRET_KEY || "your-secret-key";
//   return crypto
//     .createHmac("sha256", secret)
//     .update(JSON.stringify(data))
//     .digest("hex");
// };

// // Generate QR code for ticket with enhanced security
// const generateQRCode = async (ticket, event) => {
//   try {
//     // Create a comprehensive data object for QR
//     const qrData = {
//       ticketId: ticket.ticketId,
//       eventId: ticket.eventId.toString(),
//       userId: ticket.userId.toString(),
//       paymentRef: ticket.paymentReference,
//       timestamp: new Date().getTime(),
//     };

//     // Add security hash to prevent tampering
//     qrData.hash = generateSecureHash(qrData);

//     // Generate QR code with enhanced settings
//     const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
//       errorCorrectionLevel: "H",
//       margin: 1,
//       width: 300,
//       color: {
//         dark: "#000000",
//         light: "#ffffff",
//       },
//     });

//     // Save QR code to ticket if it exists
//     if (ticket.qrCode !== undefined) {
//       ticket.qrCode = qrCodeDataUrl;
//       await ticket.save();
//     }

//     return qrCodeDataUrl;
//   } catch (error) {
//     console.error("Error generating QR code:", error);
//     return null;
//   }
// };

// // Verify QR code data
// const verifyQRCode = async (qrData) => {
//   try {
//     const data = JSON.parse(qrData);
//     const originalHash = data.hash;
//     delete data.hash;

//     // Verify hash to ensure data hasn't been tampered with
//     const newHash = generateSecureHash(data);
//     if (newHash !== originalHash) {
//       throw new Error("Invalid QR code - data integrity check failed");
//     }

//     return {
//       isValid: true,
//       data: data,
//     };
//   } catch (error) {
//     console.error("QR verification error:", error);
//     return {
//       isValid: false,
//       error: error.message,
//     };
//   }
// };

// // Enhanced email template generation with better QR display
// const generateTicketTemplate = (ticket, event, user, qrCodeDataUrl) => {
//   const eventDate = new Date(event.Date).toLocaleString("en-US", {
//     weekday: "long",
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//     hour: "2-digit",
//     minute: "2-digit",
//   });

//   return `
//     <!DOCTYPE html>
//     <html lang="en">
//     <head>
//       <meta charset="UTF-8">
//       <meta name="viewport" content="width=device-width, initial-scale=1.0">
//       <title>Your Event Ticket</title>
//     </head>
//     <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
//       <div style="max-width: 600px; margin: 0 auto; background-color: white;">
//         <!-- Header with Logo -->
//         <div style="background-color: #1e293b; padding: 20px; text-align: center;">
//           <img src="${process.env.LOGO_URL || ""}"
//                alt="Evenue Logo"
//                width="200" height="70"
//                style="display: block; margin: 0 auto;">
//         </div>

//         <!-- Ticket Header -->
//         <div style="background-color: #047481; padding: 30px; text-align: center; color: white;">
//           <h1 style="margin: 0; font-size: 24px;">Your Event Ticket</h1>
//           <p style="margin: 10px 0 0 0;">Keep this ticket safe - you'll need it for entry</p>
//         </div>

//         <!-- Ticket Details -->
//         <div style="padding: 30px;">
//           <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; border: 2px dashed #047481;">
//             <!-- Event Info -->
//             <div style="text-align: center; margin-bottom: 20px;">
//               <h2 style="color: #047481; margin: 0 0 10px 0;">${
//                 event.title
//               }</h2>
//               <p style="color: #666; margin: 0;">${eventDate}</p>
//             </div>

//             <!-- QR Code -->
//             <div style="text-align: center; margin: 20px 0;">
//               <img src="${qrCodeDataUrl}" alt="Ticket QR Code" style="width: 200px; height: 200px;">
//               <p style="color: #666; margin: 10px 0 0 0; font-family: monospace;">Ticket ID: ${
//                 ticket.ticketId
//               }</p>
//             </div>

//             <!-- Attendee Details -->
//             <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
//               <tr>
//                 <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">
//                   <strong>Attendee Name:</strong>
//                 </td>
//                 <td style="padding: 10px; border-bottom: 1px solid #eee;">
//                   ${user.username}
//                 </td>
//               </tr>
//               <tr>
//                 <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">
//                   <strong>Venue:</strong>
//                 </td>
//                 <td style="padding: 10px; border-bottom: 1px solid #eee;">
//                   ${event.location}
//                 </td>
//               </tr>
//               ${
//                 event.meetingLink
//                   ? `
//               <tr>
//                 <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">
//                   <strong>Meeting Link:</strong>
//                 </td>
//                 <td style="padding: 10px; border-bottom: 1px solid #eee;">
//                   <a href="${event.meetingLink}" style="color: #047481;">${event.meetingLink}</a>
//                 </td>
//               </tr>
//               `
//                   : ""
//               }
//             </table>
//           </div>

//           <!-- Important Notes -->
//           <div style="margin-top: 30px;">
//             <h3 style="color: #047481;">Important Information</h3>
//             <ul style="color: #666; padding-left: 20px;">
//               <li style="margin-bottom: 10px;">Please arrive 15 minutes before the event starts</li>
//               <li style="margin-bottom: 10px;">Have your QR code ready for scanning</li>
//               <li style="margin-bottom: 10px;">You will receive notifications 24 hours and 1 hour before the event starts</li>
//             </ul>
//           </div>
//         </div>

//         <!-- Footer -->
//         <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
//           <p style="color: #666; margin: 0;">© ${new Date().getFullYear()} Evenue. All rights reserved.</p>
//         </div>
//       </div>
//     </body>
//     </html>
//   `;
// };

// // Enhanced ticket email sending with retry logic
// const sendTicketEmail = async (ticket, event, user, retryCount = 3) => {
//   try {
//     const qrCodeDataUrl = await generateQRCode(ticket, event);
//     if (!qrCodeDataUrl) {
//       throw new Error("Failed to generate QR code");
//     }

//     const emailTemplate = generateTicketTemplate(
//       ticket,
//       event,
//       user,
//       qrCodeDataUrl
//     );

//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: user.email,
//       subject: `Your Ticket for ${event.title}`,
//       html: emailTemplate,
//     };

//     await transporter.sendMail(mailOptions);
//     console.log(
//       `Ticket email sent to ${user.email} for ticket ${ticket.ticketId}`
//     );
//     return true;
//   } catch (error) {
//     console.error("Error sending ticket email:", error);
//     if (retryCount > 0) {
//       console.log(`Retrying... ${retryCount} attempts remaining`);
//       return sendTicketEmail(ticket, event, user, retryCount - 1);
//     }
//     throw new Error("Failed to send ticket email after multiple attempts");
//   }
// };

// // Send multiple tickets with improved error handling
// const sendTicketEmails = async (tickets, event, user) => {
//   const results = {
//     successful: [],
//     failed: [],
//   };

//   for (const ticket of tickets) {
//     try {
//       await sendTicketEmail(ticket, event, user);
//       results.successful.push(ticket.ticketId);
//     } catch (error) {
//       console.error(
//         `Failed to send email for ticket ${ticket.ticketId}:`,
//         error
//       );
//       results.failed.push({
//         ticketId: ticket.ticketId,
//         error: error.message,
//       });
//     }
//   }

//   if (results.failed.length > 0) {
//     console.error(`Failed to send ${results.failed.length} ticket emails`);
//   }

//   return results;
// };

// module.exports = {
//   sendTicketEmail,
//   sendTicketEmails,
//   generateQRCode,
//   verifyQRCode,
// };

const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const logger = require("../config/logger");

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Generate secure hash for QR data
const generateSecureHash = (data) => {
  const secret = process.env.QR_SECRET_KEY || "your_access_token_secret_key";
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(data))
    .digest("hex");
};

// Generate QR code for ticket with enhanced security
// const generateQRCode = async (ticket, event) => {
//   try {
//     const qrData = {
//       ticketId: ticket.ticketId,
//       eventId: ticket.eventId.toString(),
//       userId: ticket.userId.toString(),
//       paymentRef: ticket.paymentReference,
//       timestamp: new Date().getTime(),
//     };

//     qrData.hash = generateSecureHash(qrData);

//     const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
//       errorCorrectionLevel: "H",
//       margin: 1,
//       width: 300,
//       color: {
//         dark: "#000000",
//         light: "#ffffff",
//       },
//     });

//     if (ticket.qrCode !== undefined) {
//       ticket.qrCode = qrCodeDataUrl;
//       await ticket.save();
//     }

//     return qrCodeDataUrl;
//   } catch (error) {
//     console.error("Error generating QR code:", error);
//     return null;
//   }
// };
const generateQRCode = async (ticket, event) => {
  try {
    const bookingDetailsUrl = `${process.env.FRONTEND_URL}/eventTicketQRcode/${ticket.ticketId}`;

    // Simple text-based format with clear call to action
    const qrMessage = `Ticket ID: ${ticket.ticketId}\n\n➜ Click below to view ticket:\n${bookingDetailsUrl}`;

    const qrCodeDataUrl = await QRCode.toDataURL(qrMessage, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 300,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    if (ticket.qrCode !== undefined) {
      ticket.qrCode = qrCodeDataUrl;
      await ticket.save();
    }

    logger.info(
      `QR code generated successfully for ticket: ${ticket.ticketId}`
    );
    return qrCodeDataUrl;
  } catch (error) {
    logger.error(
      `Error generating QR code for ticket ${ticket.ticketId}:`,
      error
    );
    return null;
  }
};

// Generate the email template with ticket and QR code
const generateTicketTemplate = (ticket, event, user, qrCodeDataUrl) => {
  const eventDate = new Date(event.Date).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Event Ticket</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white;">
        <!-- Header with Logo -->
        <div style="background-color: #1e293b; padding: 20px; text-align: center;">
          <img src="${process.env.LOGO_URL || ""}" 
               alt="Evenue Logo" 
               width="200" height="70"
               style="display: block; margin: 0 auto;">
        </div>

        <!-- Ticket Header -->
        <div style="background-color: #047481; padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">${event.title}</h1>
          <p style="margin: 10px 0 0 0;">Your ticket has been confirmed!</p>
        </div>

        <!-- Ticket Details -->
        <div style="padding: 30px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; border: 2px dashed #047481;">
            <div style="margin-bottom: 20px;">
              <h3 style="color: #047481; margin-bottom: 15px;">Event Details</h3>
              <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${eventDate}</p>
              <p style="margin: 5px 0;"><strong>Location:</strong> ${event.venue}</p>
              <p style="margin: 5px 0;"><strong>Address:</strong> ${event.location}</p>
              <p style="margin: 5px 0;"><strong>Category:</strong> ${event.category}</p>
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="color: #047481; margin-bottom: 15px;">Ticket Information</h3>
              <p style="margin: 5px 0;"><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p style="margin: 5px 0;"><strong>Ticket Holder:</strong> ${user.username || user.email}</p>
              <p style="margin: 5px 0;"><strong>Payment Reference:</strong> ${ticket.paymentReference}</p>
              <p style="margin: 5px 0;"><strong>Purchase Date:</strong> ${new Date(ticket.purchaseDate).toLocaleDateString()}</p>
            </div>

            <!-- QR Code Section -->
            <div style="text-align: center; margin-top: 30px;">
              <h3 style="color: #047481; margin-bottom: 15px;">Your Entry QR Code</h3>
              <img src="${qrCodeDataUrl}" alt="Ticket QR Code" style="max-width: 200px; margin: 0 auto;">
              <p style="margin-top: 10px; color: #666; font-size: 14px;">
                Present this QR code at the event entrance for quick check-in
              </p>
            </div>
          </div>

          <!-- Additional Information -->
          <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <h3 style="color: #047481; margin-bottom: 15px;">Important Information</h3>
            <ul style="padding-left: 20px; margin: 0;">
              <li style="margin-bottom: 10px;">Please arrive at least 30 minutes before the event starts</li>
              <li style="margin-bottom: 10px;">Keep this ticket safe and don't share it with others</li>
              <li style="margin-bottom: 10px;">Each QR code can only be used once</li>
              <li>For any questions, please contact our support team</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #1e293b; padding: 20px; text-align: center; color: white;">
          <p style="margin: 0;">Thank you for using Evenue</p>
          <p style="margin: 5px 0 0 0; font-size: 14px;">© ${new Date().getFullYear()} Evenue. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
// Send ticket emails to users

const sendTicketEmails = async (tickets, event, user) => {
  const results = {
    sent: [],
    failed: [],
  };

  for (const ticket of tickets) {
    try {
      const qrCodeDataUrl =
        ticket.qrCode || (await generateQRCode(ticket, event));
      if (!qrCodeDataUrl) {
        throw new Error("Failed to generate QR code");
      }

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: `Your Ticket for ${event.title}`,
        html: generateTicketTemplate(ticket, event, user, qrCodeDataUrl),
        attachments: [
          {
            filename: `ticket-${ticket.ticketId}.png`,
            content: qrCodeDataUrl.split(";base64,").pop(),
            encoding: "base64",
          },
        ],
      };

      // Log the email content for debugging
      logger.info("Email content:", {
        to: user.email,
        subject: mailOptions.subject,
        html: mailOptions.html,
        attachments: mailOptions.attachments,
      });

      // Send the email
      await transporter.sendMail(mailOptions);
      results.sent.push(ticket.ticketId);
      logger.info(
        `Ticket email sent successfully for ticket: ${ticket.ticketId}`
      );
    } catch (error) {
      logger.error(
        `Failed to send ticket email for ${ticket.ticketId}:`,
        error
      );
      results.failed.push({
        ticketId: ticket.ticketId,
        error: error.message,
      });
    }
  }

  return results;
};

// Verify QR code data
const verifyQRCode = async (qrData) => {
  try {
    const data = JSON.parse(qrData);
    const originalHash = data.hash;
    delete data.hash;

    const newHash = generateSecureHash(data);
    if (newHash !== originalHash) {
      throw new Error("Invalid QR code - data integrity check failed");
    }

    logger.info(`QR code verified successfully for ticket: ${data.ticketId}`);
    return {
      isValid: true,
      data: data,
    };
  } catch (error) {
    logger.error("QR verification error:", error);
    return {
      isValid: false,
      error: error.message,
    };
  }
};

module.exports = {
  generateQRCode,
  verifyQRCode,
  sendTicketEmails,
};
