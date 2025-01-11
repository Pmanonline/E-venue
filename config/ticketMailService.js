const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
const crypto = require("crypto");

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
  const secret = process.env.QR_SECRET_KEY || "your-secret-key";
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(data))
    .digest("hex");
};

// Generate QR code for ticket with enhanced security
const generateQRCode = async (ticket, event) => {
  try {
    // Create a comprehensive data object for QR
    const qrData = {
      ticketId: ticket.ticketId,
      eventId: ticket.eventId.toString(),
      userId: ticket.userId.toString(),
      paymentRef: ticket.paymentReference,
      timestamp: new Date().getTime(),
    };

    // Add security hash to prevent tampering
    qrData.hash = generateSecureHash(qrData);

    // Generate QR code with enhanced settings
    const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 300,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    // Save QR code to ticket if it exists
    if (ticket.qrCode !== undefined) {
      ticket.qrCode = qrCodeDataUrl;
      await ticket.save();
    }

    return qrCodeDataUrl;
  } catch (error) {
    console.error("Error generating QR code:", error);
    return null;
  }
};

// Verify QR code data
const verifyQRCode = async (qrData) => {
  try {
    const data = JSON.parse(qrData);
    const originalHash = data.hash;
    delete data.hash;

    // Verify hash to ensure data hasn't been tampered with
    const newHash = generateSecureHash(data);
    if (newHash !== originalHash) {
      throw new Error("Invalid QR code - data integrity check failed");
    }

    return {
      isValid: true,
      data: data,
    };
  } catch (error) {
    console.error("QR verification error:", error);
    return {
      isValid: false,
      error: error.message,
    };
  }
};

// Enhanced email template generation with better QR display
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
          <h1 style="margin: 0; font-size: 24px;">Your Event Ticket</h1>
          <p style="margin: 10px 0 0 0;">Keep this ticket safe - you'll need it for entry</p>
        </div>

        <!-- Ticket Details -->
        <div style="padding: 30px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; border: 2px dashed #047481;">
            <!-- Event Info -->
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #047481; margin: 0 0 10px 0;">${
                event.title
              }</h2>
              <p style="color: #666; margin: 0;">${eventDate}</p>
            </div>

            <!-- QR Code -->
            <div style="text-align: center; margin: 20px 0;">
              <img src="${qrCodeDataUrl}" alt="Ticket QR Code" style="width: 200px; height: 200px;">
              <p style="color: #666; margin: 10px 0 0 0; font-family: monospace;">Ticket ID: ${
                ticket.ticketId
              }</p>
            </div>

            <!-- Attendee Details -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">
                  <strong>Attendee Name:</strong>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                  ${user.username}
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">
                  <strong>Venue:</strong>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                  ${event.location}
                </td>
              </tr>
              ${
                event.meetingLink
                  ? `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">
                  <strong>Meeting Link:</strong>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                  <a href="${event.meetingLink}" style="color: #047481;">${event.meetingLink}</a>
                </td>
              </tr>
              `
                  : ""
              }
            </table>
          </div>

          <!-- Important Notes -->
          <div style="margin-top: 30px;">
            <h3 style="color: #047481;">Important Information</h3>
            <ul style="color: #666; padding-left: 20px;">
              <li style="margin-bottom: 10px;">Please arrive 15 minutes before the event starts</li>
              <li style="margin-bottom: 10px;">Have your QR code ready for scanning</li>
              <li style="margin-bottom: 10px;">You will receive notifications 24 hours and 1 hour before the event starts</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #666; margin: 0;">© ${new Date().getFullYear()} Evenue. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Enhanced ticket email sending with retry logic
const sendTicketEmail = async (ticket, event, user, retryCount = 3) => {
  try {
    const qrCodeDataUrl = await generateQRCode(ticket, event);
    if (!qrCodeDataUrl) {
      throw new Error("Failed to generate QR code");
    }

    const emailTemplate = generateTicketTemplate(
      ticket,
      event,
      user,
      qrCodeDataUrl
    );

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `Your Ticket for ${event.title}`,
      html: emailTemplate,
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `Ticket email sent to ${user.email} for ticket ${ticket.ticketId}`
    );
    return true;
  } catch (error) {
    console.error("Error sending ticket email:", error);
    if (retryCount > 0) {
      console.log(`Retrying... ${retryCount} attempts remaining`);
      return sendTicketEmail(ticket, event, user, retryCount - 1);
    }
    throw new Error("Failed to send ticket email after multiple attempts");
  }
};

// Send multiple tickets with improved error handling
const sendTicketEmails = async (tickets, event, user) => {
  const results = {
    successful: [],
    failed: [],
  };

  for (const ticket of tickets) {
    try {
      await sendTicketEmail(ticket, event, user);
      results.successful.push(ticket.ticketId);
    } catch (error) {
      console.error(
        `Failed to send email for ticket ${ticket.ticketId}:`,
        error
      );
      results.failed.push({
        ticketId: ticket.ticketId,
        error: error.message,
      });
    }
  }

  if (results.failed.length > 0) {
    console.error(`Failed to send ${results.failed.length} ticket emails`);
  }

  return results;
};

module.exports = {
  sendTicketEmail,
  sendTicketEmails,
  generateQRCode,
  verifyQRCode,
};
