/**
 * Vehicle Rental System - API Adapter & Fleet Data
 * 
 * Connected to Python Flask REST API & SQLite database:
 * - GET  /api/vehicles?type=...&max_price=...&pickup_date=...&return_date=...
 * - POST /api/bookings
 */

/**
 * Vehicle API Service Adapter
 * Connects the frontend to the Flask REST endpoints.
 */
const VehicleAPI = {
  USE_FLASK_BACKEND: true,

  /**
   * Determine API base URL dynamically
   * Works whether served from Flask (http://localhost:5000) or opened via file:///
   */
  get baseUrl() {
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      return "/api";
    }
    return "http://127.0.0.1:5000/api";
  },

  /**
   * Fetch vehicles from Flask with optional filters and date availability checks
   * @param {Object} filters - { type, maxPrice, pickupDate, returnDate }
   * @returns {Promise<Array>}
   */
  async getVehicles(filters = {}) {
    if (this.USE_FLASK_BACKEND) {
      try {
        const params = new URLSearchParams();
        if (filters.type && filters.type !== "all") params.append("type", filters.type);
        if (filters.maxPrice) params.append("max_price", filters.maxPrice);
        if (filters.pickupDate) params.append("pickup_date", filters.pickupDate);
        if (filters.returnDate) params.append("return_date", filters.returnDate);

        const url = `${this.baseUrl}/vehicles${params.toString() ? "?" + params.toString() : ""}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Server returned error (${response.status})`);
        }
        return data;
      } catch (err) {
        console.warn("Flask backend not connected or returned error:", err.message);
        throw err;
      }
    }
    throw new Error("The booking service is unavailable.");
  },

  /**
   * Submit a new booking to Flask & SQLite
   * @param {Object} bookingData - Customer and rental details
   * @returns {Promise<Object>}
   */
  async createBooking(bookingData) {
    if (this.USE_FLASK_BACKEND) {
      try {
        const response = await fetch(`${this.baseUrl}/bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicle_id: bookingData.vehicleId,
            customer_name: bookingData.customerName,
            customer_email: bookingData.customerEmail,
            pickup_date: bookingData.pickupDate,
            return_date: bookingData.returnDate
          })
        });

        const result = await response.json();
        if (!response.ok) {
          return {
            success: false,
            error: result.error || "Failed to create booking on server."
          };
        }
        return result;
    } catch (err) {
      console.warn("Flask backend unreachable:", err.message);
      return {
        success: false,
        error: "The booking service is unavailable. Start the Flask server and try again."
      };
    }
    }
    return Promise.resolve({ success: false, error: "The booking service is unavailable." });
  }
};
window.VehicleAPI = VehicleAPI;
