// ===================================
// CONFIGURATION
// ===================================

// TODO: Replace this with your actual API Gateway URL after Terraform deployment
// You'll get this URL from: terraform output api_endpoint
const API_GATEWAY_URL = "YOUR_API_GATEWAY_URL_HERE";

// Example: const API_GATEWAY_URL = 'https://abc123.execute-api.us-east-1.amazonaws.com/prod/submit';

// ===================================
// DOM ELEMENTS
// ===================================
const form = document.getElementById("contactForm");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.querySelector(".btn-text");
const btnLoader = document.querySelector(".btn-loader");
const successMessage = document.getElementById("successMessage");
const errorMessage = document.getElementById("errorMessage");
const errorText = document.getElementById("errorText");
const refNumber = document.getElementById("refNumber");
const charCount = document.getElementById("charCount");
const messageTextarea = document.getElementById("message");

// ===================================
// CHARACTER COUNTER
// ===================================
messageTextarea.addEventListener("input", () => {
  const count = messageTextarea.value.length;
  charCount.textContent = count;

  // Change color based on length
  if (count < 20) {
    charCount.style.color = "#f44336"; // Red - too short
  } else if (count < 50) {
    charCount.style.color = "#ff9800"; // Orange - getting there
  } else {
    charCount.style.color = "#4caf50"; // Green - good length
  }
});

// ===================================
// FORM VALIDATION
// ===================================
function validateForm(name, email, message) {
  const errors = [];

  // Name validation
  if (!name || name.trim().length < 2) {
    errors.push("Please enter your full name (at least 2 characters)");
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push("Please enter a valid email address");
  }

  // Message validation
  if (!message || message.trim().length < 20) {
    errors.push(
      "Please provide more details about your trip (at least 20 characters)",
    );
  }

  if (message && message.trim().length > 1000) {
    errors.push("Message is too long (maximum 1000 characters)");
  }

  return errors;
}

// ===================================
// LOADING STATE
// ===================================
function setLoading(isLoading) {
  if (isLoading) {
    submitBtn.disabled = true;
    btnText.style.display = "none";
    btnLoader.style.display = "inline-flex";
  } else {
    submitBtn.disabled = false;
    btnText.style.display = "inline-flex";
    btnLoader.style.display = "none";
  }
}

// ===================================
// SHOW SUCCESS MESSAGE
// ===================================
function showSuccess(referenceNumber) {
  // Hide form with animation
  form.classList.add("fade-out");

  setTimeout(() => {
    form.style.display = "none";
    errorMessage.style.display = "none";

    // Show success message
    refNumber.textContent = referenceNumber;
    successMessage.style.display = "block";

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 300);
}

// ===================================
// SHOW ERROR MESSAGE
// ===================================
function showError(message) {
  errorText.textContent =
    message || "We couldn't send your message. Please try again.";
  errorMessage.style.display = "block";
  successMessage.style.display = "none";

  // Scroll to error message
  errorMessage.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ===================================
// HIDE ERROR MESSAGE
// ===================================
function hideError() {
  errorMessage.style.display = "none";
}

// ===================================
// RESET FORM
// ===================================
function resetForm() {
  form.reset();
  form.style.display = "block";
  form.classList.remove("fade-out");
  successMessage.style.display = "none";
  errorMessage.style.display = "none";
  charCount.textContent = "0";
  charCount.style.color = "#999";

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Make resetForm available globally for onclick handler
window.resetForm = resetForm;
window.hideError = hideError;

// ===================================
// FORM SUBMISSION HANDLER
// ===================================
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Hide any existing error messages
  hideError();

  // Get form values
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const message = document.getElementById("message").value.trim();

  // Validate form
  const validationErrors = validateForm(name, email, message);
  if (validationErrors.length > 0) {
    showError(validationErrors.join(". "));
    return;
  }

  // Check if API URL is configured
  if (API_GATEWAY_URL === "YOUR_API_GATEWAY_URL_HERE") {
    showError(
      "API Gateway URL is not configured. Please update script.js with your API endpoint.",
    );
    return;
  }

  // Set loading state
  setLoading(true);

  try {
    // Send data to API Gateway
    const response = await fetch(API_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name,
        email: email,
        message: message,
      }),
    });

    // Parse response
    const data = await response.json();

    // Handle response
    if (response.ok && data.success) {
      // Success!
      showSuccess(data.referenceNumber);

      // Optional: Track successful submission
      console.log("Form submitted successfully:", data);
    } else {
      // API returned an error
      const errorMsg =
        data.message || data.error || "Failed to submit your inquiry";
      showError(errorMsg);
      console.error("API Error:", data);
    }
  } catch (error) {
    // Network error or other issue
    console.error("Submission error:", error);

    if (error.name === "TypeError" && error.message.includes("fetch")) {
      showError(
        "Unable to connect to the server. Please check your internet connection and try again.",
      );
    } else {
      showError("An unexpected error occurred. Please try again later.");
    }
  } finally {
    // Reset loading state
    setLoading(false);
  }
});

// ===================================
// PREVENT ACCIDENTAL FORM LOSS
// ===================================
let formHasContent = false;

form.addEventListener("input", () => {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const message = document.getElementById("message").value;

  formHasContent = name || email || message;
});

window.addEventListener("beforeunload", (event) => {
  if (formHasContent && successMessage.style.display === "none") {
    event.preventDefault();
    event.returnValue = ""; // Chrome requires returnValue to be set
  }
});

// ===================================
// SMOOTH SCROLL POLYFILL FOR OLDER BROWSERS
// ===================================
if (!("scrollBehavior" in document.documentElement.style)) {
  const scrollToElement = (element) => {
    element.scrollIntoView({ behavior: "smooth" });
  };
}

// ===================================
// INITIALIZE
// ===================================
console.log("✅ Contact form initialized");
console.log("🔗 API Gateway URL:", API_GATEWAY_URL);

if (API_GATEWAY_URL === "YOUR_API_GATEWAY_URL_HERE") {
  console.warn("⚠️ WARNING: API Gateway URL not configured!");
  console.warn(
    "📝 Update API_GATEWAY_URL in script.js with your Terraform output",
  );
}

// ===================================
// ACCESSIBILITY: ESCAPE KEY TO CLOSE MESSAGES
// ===================================
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (errorMessage.style.display === "block") {
      hideError();
    }
  }
});
