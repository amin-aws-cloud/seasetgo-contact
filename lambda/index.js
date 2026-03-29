const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES();

// Get environment variables
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE;
const BUSINESS_EMAIL = process.env.BUSINESS_EMAIL;
const SENDER_EMAIL = process.env.SENDER_EMAIL;

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // 1. Parse form data from API Gateway event
    const body = JSON.parse(event.body);
    const { name, email, message } = body;

    // 2. Validate required fields
    if (!name || !email || !message) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Missing required fields",
          message: "Please provide name, email, and message",
        }),
      };
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Invalid email address",
          message: "Please provide a valid email address",
        }),
      };
    }

    // 3. Generate unique reference number
    const referenceNumber = `REF-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    // 4. Save to DynamoDB
    const dynamoParams = {
      TableName: DYNAMODB_TABLE,
      Item: {
        id: uuidv4(),
        Name: name,
        Email: email,
        Message: message,
        Timestamp: timestamp,
        ReferenceNumber: referenceNumber,
      },
    };

    await dynamodb.put(dynamoParams).promise();
    console.log("Successfully saved to DynamoDB");

    // 5. Send confirmation email to customer
    const customerEmailParams = {
      Source: SENDER_EMAIL,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: `Thank you for contacting SeaSetGo! [${referenceNumber}]`,
        },
        Body: {
          Html: {
            Data: getCustomerEmailTemplate(name, referenceNumber),
          },
        },
      },
    };

    await ses.sendEmail(customerEmailParams).promise();
    console.log("Successfully sent customer confirmation email");

    // 6. Send notification email to business
    const businessEmailParams = {
      Source: SENDER_EMAIL,
      Destination: {
        ToAddresses: [BUSINESS_EMAIL],
      },
      Message: {
        Subject: {
          Data: `New Travel Inquiry from ${name} [${referenceNumber}]`,
        },
        Body: {
          Html: {
            Data: getBusinessEmailTemplate(
              name,
              email,
              message,
              referenceNumber,
              timestamp,
            ),
          },
        },
      },
    };

    await ses.sendEmail(businessEmailParams).promise();
    console.log("Successfully sent business notification email");

    // 7. Return success response
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        message: "Your inquiry has been submitted successfully!",
        referenceNumber: referenceNumber,
      }),
    };
  } catch (error) {
    console.error("Error processing contact form:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: "Failed to process your inquiry. Please try again later.",
      }),
    };
  }
};

// Customer confirmation email template
function getCustomerEmailTemplate(name, referenceNumber) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #0066cc;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .content {
          background-color: #f9f9f9;
          padding: 30px;
          border: 1px solid #ddd;
          border-radius: 0 0 5px 5px;
        }
        .reference-box {
          background-color: #e8f4f8;
          border-left: 4px solid #0066cc;
          padding: 15px;
          margin: 20px 0;
        }
        .reference-number {
          font-size: 18px;
          font-weight: bold;
          color: #0066cc;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SeaSetGo</h1>
      </div>
      <div class="content">
        <h2>Thank you for contacting us, ${name}!</h2>
        <p>We've received your travel inquiry and our team will get back to you within 24 hours.</p>
        
        <div class="reference-box">
          <p style="margin: 0;">Your Reference Number:</p>
          <p class="reference-number">${referenceNumber}</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
            Please keep this reference number for your records.
          </p>
        </div>

        <p><strong>What happens next?</strong></p>
        <ul>
          <li>Our travel specialists will review your inquiry</li>
          <li>We'll prepare personalized recommendations for your trip</li>
          <li>You'll receive a detailed response within 24 hours</li>
        </ul>

        <p>If you have any urgent questions, please don't hesitate to reach out to us at <a href="mailto:${BUSINESS_EMAIL}">${BUSINESS_EMAIL}</a>.</p>

        <p>We're excited to help you plan your perfect getaway!</p>
        
        <p style="margin-top: 30px;">
          Best regards,<br>
          <strong>The SeaSetGo Team</strong>
        </p>
      </div>
      <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>&copy; ${new Date().getFullYear()} SeaSetGo. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

// Business notification email template
function getBusinessEmailTemplate(
  name,
  email,
  message,
  referenceNumber,
  timestamp,
) {
  const formattedDate = new Date(timestamp).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 700px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #ff6600;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .content {
          background-color: white;
          padding: 30px;
          border: 1px solid #ddd;
          border-radius: 0 0 5px 5px;
        }
        .info-section {
          background-color: #f5f5f5;
          padding: 15px;
          margin: 15px 0;
          border-radius: 5px;
        }
        .info-row {
          display: flex;
          margin: 10px 0;
        }
        .info-label {
          font-weight: bold;
          min-width: 150px;
          color: #555;
        }
        .info-value {
          flex: 1;
        }
        .message-box {
          background-color: #fff9e6;
          border-left: 4px solid #ff6600;
          padding: 15px;
          margin: 20px 0;
        }
        .urgent {
          background-color: #ffebee;
          border: 2px solid #ff6600;
          padding: 15px;
          margin: 20px 0;
          border-radius: 5px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔔 New Travel Inquiry</h1>
      </div>
      <div class="content">
        <div class="urgent">
          <h2 style="margin: 0; color: #ff6600;">⏰ Action Required</h2>
          <p style="margin: 10px 0 0 0;">A new customer is waiting for your response!</p>
        </div>

        <div class="info-section">
          <h3 style="margin-top: 0; color: #ff6600;">Customer Details</h3>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value"><a href="mailto:${email}">${email}</a></span>
          </div>
          <div class="info-row">
            <span class="info-label">Reference Number:</span>
            <span class="info-value"><strong>${referenceNumber}</strong></span>
          </div>
          <div class="info-row">
            <span class="info-label">Submitted:</span>
            <span class="info-value">${formattedDate}</span>
          </div>
        </div>

        <div class="message-box">
          <h3 style="margin-top: 0; color: #ff6600;">Customer Message</h3>
          <p style="white-space: pre-wrap; margin: 0;">${message}</p>
        </div>

        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #2e7d32;">📋 Next Steps</h4>
          <ol style="margin: 0; padding-left: 20px;">
            <li>Review the customer's inquiry</li>
            <li>Prepare personalized travel recommendations</li>
            <li>Respond within 24 hours to ${email}</li>
            <li>Reference: ${referenceNumber}</li>
          </ol>
        </div>

        <p style="margin-top: 30px; text-align: center; color: #666;">
          <small>This inquiry was automatically logged in your DynamoDB database.</small>
        </p>
      </div>
    </body>
    </html>
  `;
}
