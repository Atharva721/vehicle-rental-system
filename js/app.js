/**
 * Vehicle Rental System - Application Controller
 * Handles Screen Navigation, Filtering, Cost Calculation, and Form Validation.
 * Connected to Python Flask Backend & SQLite Database.
 */

// Application State
const state = {
  currentScreen: "screen-listing",
  vehicles: [],
  selectedVehicle: null,
  filters: {
    type: "all",
    maxPrice: 8000,
    pickupDate: "",
    returnDate: ""
  },
  booking: null
};

// DOM Elements Cache
const elements = {
  // Screens
  screens: {
    listing: document.getElementById("screen-listing"),
    booking: document.getElementById("screen-booking"),
    confirmation: document.getElementById("screen-confirmation")
  },

  // Navigation step badges
  stepNavs: {
    1: document.getElementById("step-nav-1"),
    2: document.getElementById("step-nav-2"),
    3: document.getElementById("step-nav-3")
  },

  // Screen 1: Vehicle Listing
  filterPickupDate: document.getElementById("filter-pickup-date"),
  filterReturnDate: document.getElementById("filter-return-date"),
  filterType: document.getElementById("filter-type"),
  filterPrice: document.getElementById("filter-price"),
  priceDisplay: document.getElementById("price-display"),
  btnResetFilters: document.getElementById("btn-reset-filters"),
  resultsCount: document.getElementById("results-count"),
  vehicleGrid: document.getElementById("vehicle-grid"),

  // Screen 2: Booking Form
  btnBackToListing: document.getElementById("btn-back-to-listing"),
  summaryVehicleName: document.getElementById("summary-vehicle-name"),
  summaryVehicleType: document.getElementById("summary-vehicle-type"),
  summaryVehiclePrice: document.getElementById("summary-vehicle-price"),
  summaryVehicleSpecs: document.getElementById("summary-vehicle-specs"),

  estimateDailyRate: document.getElementById("estimate-daily-rate"),
  estimateDuration: document.getElementById("estimate-duration"),
  estimateTotalCost: document.getElementById("estimate-total-cost"),

  bookingForm: document.getElementById("booking-form"),
  btnConfirmBooking: document.getElementById("btn-confirm-booking"),
  custName: document.getElementById("cust-name"),
  custEmail: document.getElementById("cust-email"),
  bookingPickupDate: document.getElementById("booking-pickup-date"),
  bookingReturnDate: document.getElementById("booking-return-date"),
  bookingFormAlert: document.getElementById("booking-form-alert"),

  // Validation Error messages
  errCustName: document.getElementById("err-cust-name"),
  errCustEmail: document.getElementById("err-cust-email"),
  errPickupDate: document.getElementById("err-pickup-date"),
  errReturnDate: document.getElementById("err-return-date"),

  // Screen 3: Booking Confirmation
  confirmRefCode: document.getElementById("confirm-ref-code"),
  confirmStatus: document.getElementById("confirm-status"),
  confirmVehicleName: document.getElementById("confirm-vehicle-name"),
  confirmCustomerName: document.getElementById("confirm-customer-name"),
  confirmCustomerEmail: document.getElementById("confirm-customer-email"),
  confirmPickupDate: document.getElementById("confirm-pickup-date"),
  confirmReturnDate: document.getElementById("confirm-return-date"),
  confirmDuration: document.getElementById("confirm-duration"),
  confirmTotalCost: document.getElementById("confirm-total-cost"),
  btnReturnHome: document.getElementById("btn-return-home")
};

// =============================================================================
// Helper Utilities
// =============================================================================

/** Format Date as YYYY-MM-DD */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Add Days to a Date */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Calculate whole rental days between two YYYY-MM-DD dates */
function calculateRentalDays(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
  // If same day pickup and return, count as 1 rental day
  return diffDays < 0 ? -1 : (diffDays === 0 ? 1 : diffDays);
}

/** Format currency amount in Indian Rupees (INR) */
function formatINR(amount) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

// =============================================================================
// Navigation Controller (Screen Switching)
// =============================================================================

function showScreen(screenId) {
  state.currentScreen = screenId;

  // Toggle active CSS class on screens
  Object.values(elements.screens).forEach((el) => el.classList.remove("active"));
  elements.screens[screenId.replace("screen-", "")].classList.add("active");

  // Update Top Navigation Stepper
  elements.stepNavs[1].classList.remove("active", "completed");
  elements.stepNavs[2].classList.remove("active", "completed");
  elements.stepNavs[3].classList.remove("active", "completed");

  if (screenId === "screen-listing") {
    elements.stepNavs[1].classList.add("active");
  } else if (screenId === "screen-booking") {
    elements.stepNavs[1].classList.add("completed");
    elements.stepNavs[2].classList.add("active");
  } else if (screenId === "screen-confirmation") {
    elements.stepNavs[1].classList.add("completed");
    elements.stepNavs[2].classList.add("completed");
    elements.stepNavs[3].classList.add("active");
  }

  // Scroll to top on screen change
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =============================================================================
// Screen 1: Vehicle Listing & Dynamic Database Loading
// =============================================================================

/** Load vehicles from Flask backend according to active filters and dates */
async function loadVehiclesFromBackend() {
  // Check for reversed date input on client first
  if (state.filters.pickupDate && state.filters.returnDate && state.filters.returnDate < state.filters.pickupDate) {
    elements.resultsCount.textContent = "Error: Invalid date range";
    elements.vehicleGrid.innerHTML = `
      <div class="empty-state">
        <h3>Invalid Date Range</h3>
        <p>Return date cannot be earlier than pickup date. Please adjust your dates.</p>
      </div>
    `;
    return;
  }

  try {
    const data = await window.VehicleAPI.getVehicles(state.filters);
    state.vehicles = data;
    renderVehicleGrid();
  } catch (err) {
    console.error("Backend error loading vehicles:", err);
    elements.resultsCount.textContent = "Error loading vehicles";
    elements.vehicleGrid.innerHTML = `
      <div class="empty-state">
        <h3>Could Not Load Vehicles</h3>
        <p>${err.message || "An error occurred while communicating with the database."}</p>
      </div>
    `;
  }
}

/** Render vehicles into the grid */
function renderVehicleGrid() {
  // Safety filter in case local fallback data is being shown
  const filtered = state.vehicles.filter((v) => {
    if (state.filters.type !== "all" && v.type.toLowerCase() !== state.filters.type.toLowerCase()) {
      return false;
    }
    if (v.pricePerDay > state.filters.maxPrice) {
      return false;
    }
    return true;
  });

  elements.resultsCount.textContent = `Showing ${filtered.length} vehicle${filtered.length === 1 ? "" : "s"}`;
  elements.vehicleGrid.innerHTML = "";

  if (filtered.length === 0) {
    elements.vehicleGrid.innerHTML = `
      <div class="empty-state">
        <h3>No vehicles found</h3>
        <p>Try adjusting your price range or vehicle type filter.</p>
      </div>
    `;
    return;
  }

  filtered.forEach((vehicle) => {
    const card = document.createElement("article");
    card.className = "vehicle-card";

    const isAvailable = Boolean(vehicle.available);
    const availabilityBadge = isAvailable
      ? `<span class="badge badge-available"><span class="badge-dot"></span> Available</span>`
      : `<span class="badge badge-unavailable"><span class="badge-dot"></span> Unavailable</span>`;

    const bookButton = isAvailable
      ? `<button type="button" class="btn btn-primary btn-sm btn-book" data-vehicle-id="${vehicle.id}">Book Now</button>`
      : `<button type="button" class="btn btn-primary btn-sm" disabled title="This vehicle is unavailable or booked for selected dates">Unavailable</button>`;

    card.innerHTML = `
      <div class="vehicle-card-top">
        <div>
          <h3 class="vehicle-title">${vehicle.name || vehicle.model}</h3>
          <span class="type-pill">${vehicle.type}</span>
        </div>
        ${availabilityBadge}
      </div>

      <div class="vehicle-specs">
        <span>⚙ ${vehicle.transmission || "Automatic"}</span>
        <span>⛽ ${vehicle.fuelType || vehicle.fuel_type || "Petrol"}</span>
        <span>👥 ${vehicle.seats || 5} Seats</span>
      </div>

      <div class="vehicle-card-bottom">
        <div class="price-box">
          <span class="price-label">Daily Rate</span>
          <span class="price-amount">${formatINR(vehicle.pricePerDay || vehicle.daily_rate)} <span class="price-period">/ day</span></span>
        </div>
        ${bookButton}
      </div>
    `;

    elements.vehicleGrid.appendChild(card);
  });

  // Attach click handlers to Book Now buttons
  const bookBtns = elements.vehicleGrid.querySelectorAll(".btn-book");
  bookBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const vehicleId = parseInt(btn.getAttribute("data-vehicle-id"), 10);
      selectVehicleAndProceed(vehicleId);
    });
  });
}

/** Handle vehicle selection and navigate to Screen 2 */
function selectVehicleAndProceed(vehicleId) {
  const vehicle = state.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return;

  state.selectedVehicle = vehicle;

  const vehicleName = vehicle.name || vehicle.model;
  const dailyPrice = vehicle.pricePerDay || vehicle.daily_rate;

  // Populate selected vehicle summary card in Screen 2
  elements.summaryVehicleName.textContent = vehicleName;
  elements.summaryVehicleType.textContent = vehicle.type;
  elements.summaryVehiclePrice.textContent = `${formatINR(dailyPrice)} / day`;
  elements.summaryVehicleSpecs.textContent = `${vehicle.transmission || "Automatic"} • ${vehicle.fuelType || "Petrol"} • ${vehicle.seats || 5} seats`;

  // Pre-fill booking dates with listing filters if already chosen
  if (state.filters.pickupDate) {
    elements.bookingPickupDate.value = state.filters.pickupDate;
  }
  if (state.filters.returnDate) {
    elements.bookingReturnDate.value = state.filters.returnDate;
  }

  // Recalculate cost
  updateCostEstimation();

  // Clear previous form validation errors
  clearFormErrors();

  // Navigate to Screen 2
  showScreen("screen-booking");
}

// =============================================================================
// Screen 2: Cost Calculation & Form Validation
// =============================================================================

/** Update live rental cost estimate */
function updateCostEstimation() {
  if (!state.selectedVehicle) return;

  const pickupDate = elements.bookingPickupDate.value;
  const returnDate = elements.bookingReturnDate.value;
  const dailyPrice = state.selectedVehicle.pricePerDay || state.selectedVehicle.daily_rate;

  elements.estimateDailyRate.textContent = `${formatINR(dailyPrice)} / day`;

  const days = calculateRentalDays(pickupDate, returnDate);

  if (!pickupDate || !returnDate) {
    elements.estimateDuration.textContent = "Please select dates";
    elements.estimateTotalCost.textContent = "₹0";
    return;
  }

  if (days < 0) {
    elements.estimateDuration.textContent = "Invalid date range";
    elements.estimateTotalCost.textContent = "₹0";
    return;
  }

  const total = days * dailyPrice;
  elements.estimateDuration.textContent = `${days} day${days === 1 ? "" : "s"}`;
  elements.estimateTotalCost.textContent = formatINR(total);
}

/** Clear inline error states */
function clearFormErrors() {
  [elements.custName, elements.custEmail, elements.bookingPickupDate, elements.bookingReturnDate].forEach((input) => {
    input.classList.remove("is-invalid");
  });
  elements.errCustName.textContent = "";
  elements.errCustEmail.textContent = "";
  elements.errPickupDate.textContent = "";
  elements.errReturnDate.textContent = "";
  elements.bookingFormAlert.classList.add("hidden");
  elements.bookingFormAlert.textContent = "";
}

/** Basic form validation */
function validateBookingForm() {
  clearFormErrors();
  let isValid = true;

  const nameVal = elements.custName.value.trim();
  const emailVal = elements.custEmail.value.trim();
  const pickupVal = elements.bookingPickupDate.value;
  const returnVal = elements.bookingReturnDate.value;

  // Validate Name
  if (!nameVal) {
    elements.custName.classList.add("is-invalid");
    elements.errCustName.textContent = "Full name is required.";
    isValid = false;
  } else if (nameVal.length < 2) {
    elements.custName.classList.add("is-invalid");
    elements.errCustName.textContent = "Name must be at least 2 characters.";
    isValid = false;
  }

  // Validate Email
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailVal) {
    elements.custEmail.classList.add("is-invalid");
    elements.errCustEmail.textContent = "Email address is required.";
    isValid = false;
  } else if (!emailPattern.test(emailVal)) {
    elements.custEmail.classList.add("is-invalid");
    elements.errCustEmail.textContent = "Please enter a valid email address.";
    isValid = false;
  }

  // Validate Dates
  if (!pickupVal) {
    elements.bookingPickupDate.classList.add("is-invalid");
    elements.errPickupDate.textContent = "Pickup date is required.";
    isValid = false;
  }

  if (!returnVal) {
    elements.bookingReturnDate.classList.add("is-invalid");
    elements.errReturnDate.textContent = "Return date is required.";
    isValid = false;
  }

  if (pickupVal && returnVal) {
    const days = calculateRentalDays(pickupVal, returnVal);
    if (days < 0) {
      elements.bookingReturnDate.classList.add("is-invalid");
      elements.errReturnDate.textContent = "Return date cannot be earlier than pickup date.";
      isValid = false;
    }
  }

  if (!isValid) {
    elements.bookingFormAlert.textContent = "Please correct the errors highlighted above.";
    elements.bookingFormAlert.classList.remove("hidden");
  }

  return isValid;
}

/** Handle Booking Form Submission */
async function handleBookingSubmit(event) {
  event.preventDefault();

  if (!validateBookingForm()) {
    return;
  }

  // Prevent double submissions
  elements.btnConfirmBooking.disabled = true;
  elements.btnConfirmBooking.textContent = "Reserving Vehicle...";
  elements.bookingFormAlert.classList.add("hidden");

  const pickupDate = elements.bookingPickupDate.value;
  const returnDate = elements.bookingReturnDate.value;
  const dailyPrice = state.selectedVehicle.pricePerDay || state.selectedVehicle.daily_rate;
  const durationDays = calculateRentalDays(pickupDate, returnDate);
  const totalCost = durationDays * dailyPrice;

  // Prepare booking payload for Flask API
  const bookingData = {
    vehicleId: state.selectedVehicle.id,
    vehicleName: state.selectedVehicle.name || state.selectedVehicle.model,
    vehicleType: state.selectedVehicle.type,
    customerName: elements.custName.value.trim(),
    customerEmail: elements.custEmail.value.trim(),
    pickupDate: pickupDate,
    returnDate: returnDate,
    durationDays: durationDays,
    dailyRate: dailyPrice,
    totalCost: totalCost
  };

  try {
    const response = await window.VehicleAPI.createBooking(bookingData);

    if (!response || !response.success) {
      // Show backend rejection message (e.g. overlapping booking conflict)
      elements.bookingFormAlert.textContent = response?.error || "Booking could not be confirmed. Please check dates.";
      elements.bookingFormAlert.classList.remove("hidden");
      elements.btnConfirmBooking.disabled = false;
      elements.btnConfirmBooking.textContent = "Confirm Booking";
      return;
    }

    // Populate Screen 3: Booking Confirmation
    populateConfirmationScreen(response);

    // Navigate to Screen 3
    showScreen("screen-confirmation");

  } catch (err) {
    elements.bookingFormAlert.textContent = err.message || "An error occurred while saving the booking.";
    elements.bookingFormAlert.classList.remove("hidden");
  } finally {
    elements.btnConfirmBooking.disabled = false;
    elements.btnConfirmBooking.textContent = "Confirm Booking";
  }
}

// =============================================================================
// Screen 3: Confirmation Details
// =============================================================================

function populateConfirmationScreen(apiResult) {
  const b = apiResult.booking;
  elements.confirmRefCode.textContent = apiResult.bookingReference || b.bookingReference;
  elements.confirmStatus.textContent = apiResult.status || b.status;
  elements.confirmVehicleName.textContent = `${b.vehicleName} (${b.vehicleType})`;
  elements.confirmCustomerName.textContent = b.customerName;
  elements.confirmCustomerEmail.textContent = b.customerEmail;
  elements.confirmPickupDate.textContent = b.pickupDate;
  elements.confirmReturnDate.textContent = b.returnDate;
  elements.confirmDuration.textContent = `${b.durationDays} day${b.durationDays === 1 ? "" : "s"}`;
  elements.confirmTotalCost.textContent = formatINR(b.totalCost);
}

// =============================================================================
// Initialization & Event Listeners
// =============================================================================

async function init() {
  // Set default dates: Today and Tomorrow
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const todayStr = formatDate(today);
  const tomorrowStr = formatDate(tomorrow);

  // Set min constraints on date pickers so past dates cannot be selected
  elements.filterPickupDate.min = todayStr;
  elements.filterReturnDate.min = todayStr;
  elements.bookingPickupDate.min = todayStr;
  elements.bookingReturnDate.min = todayStr;

  // Set initial filter and form dates
  elements.filterPickupDate.value = todayStr;
  elements.filterReturnDate.value = tomorrowStr;
  state.filters.pickupDate = todayStr;
  state.filters.returnDate = tomorrowStr;

  // Fetch initial fleet data from database
  await loadVehiclesFromBackend();

  // Listeners for Filter Controls (Screen 1)
  elements.filterType.addEventListener("change", async (e) => {
    state.filters.type = e.target.value;
    await loadVehiclesFromBackend();
  });

  elements.filterPrice.addEventListener("input", async (e) => {
    state.filters.maxPrice = parseInt(e.target.value, 10);
    elements.priceDisplay.textContent = formatINR(state.filters.maxPrice);
    await loadVehiclesFromBackend();
  });

  elements.filterPickupDate.addEventListener("change", async (e) => {
    state.filters.pickupDate = e.target.value;
    elements.filterReturnDate.min = e.target.value;
    // Auto-adjust return date if it is earlier than pickup
    if (elements.filterReturnDate.value && elements.filterReturnDate.value < e.target.value) {
      elements.filterReturnDate.value = e.target.value;
      state.filters.returnDate = e.target.value;
    }
    await loadVehiclesFromBackend();
  });

  elements.filterReturnDate.addEventListener("change", async (e) => {
    state.filters.returnDate = e.target.value;
    await loadVehiclesFromBackend();
  });

  elements.btnResetFilters.addEventListener("click", async () => {
    elements.filterType.value = "all";
    elements.filterPrice.value = 8000;
    elements.priceDisplay.textContent = "₹8,000";
    elements.filterPickupDate.value = todayStr;
    elements.filterReturnDate.value = tomorrowStr;
    state.filters.type = "all";
    state.filters.maxPrice = 8000;
    state.filters.pickupDate = todayStr;
    state.filters.returnDate = tomorrowStr;
    await loadVehiclesFromBackend();
  });

  // Listeners for Screen 2 Navigation & Forms
  elements.btnBackToListing.addEventListener("click", () => {
    showScreen("screen-listing");
  });

  elements.bookingPickupDate.addEventListener("change", (e) => {
    elements.bookingReturnDate.min = e.target.value;
    updateCostEstimation();
    elements.errPickupDate.textContent = "";
    elements.bookingPickupDate.classList.remove("is-invalid");
  });

  elements.bookingReturnDate.addEventListener("change", () => {
    updateCostEstimation();
    elements.errReturnDate.textContent = "";
    elements.bookingReturnDate.classList.remove("is-invalid");
  });

  // Real-time clearance of text input errors
  elements.custName.addEventListener("input", () => {
    elements.errCustName.textContent = "";
    elements.custName.classList.remove("is-invalid");
  });

  elements.custEmail.addEventListener("input", () => {
    elements.errCustEmail.textContent = "";
    elements.custEmail.classList.remove("is-invalid");
  });

  elements.bookingForm.addEventListener("submit", handleBookingSubmit);

  // Listener for Screen 3: Return to home / browse more
  elements.btnReturnHome.addEventListener("click", async () => {
    elements.bookingForm.reset();
    clearFormErrors();
    showScreen("screen-listing");
    // Reload backend fleet so newly booked vehicle availability updates on the screen
    await loadVehiclesFromBackend();
  });
}

// Start application on DOM ready
document.addEventListener("DOMContentLoaded", init);
