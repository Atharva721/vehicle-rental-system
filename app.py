import os
import re
import sqlite3
import uuid
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# Application Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, "rental.db")

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)  # Allow cross-origin requests from frontend UI

# =============================================================================
# Database Helpers & Initialization
# =============================================================================

def get_db(db_path=None):
    """
    Establish SQLite database connection with row factory and foreign keys enabled.
    """
    path = db_path or DATABASE_PATH
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    # Enforce SQLite foreign key constraints
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path=None):
    """
    Initialize SQLite schema for vehicles and bookings.
    Seeds sample vehicle data automatically if vehicle table is empty.
    """
    conn = get_db(db_path)
    with conn:
        # 1. Vehicles Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS vehicles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model TEXT NOT NULL,
                type TEXT NOT NULL,
                daily_rate REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'available',
                transmission TEXT DEFAULT 'Automatic',
                fuel_type TEXT DEFAULT 'Petrol',
                seats INTEGER DEFAULT 5
            );
        """)

        # 2. Bookings Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_reference TEXT UNIQUE NOT NULL,
                vehicle_id INTEGER NOT NULL,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                pickup_date TEXT NOT NULL,
                return_date TEXT NOT NULL,
                duration_days INTEGER NOT NULL,
                daily_rate REAL NOT NULL,
                total_cost REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'Confirmed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT
            );
        """)

        # Check if vehicles table is empty; if so, seed sample fleet
        cursor = conn.execute("SELECT COUNT(*) FROM vehicles")
        count = cursor.fetchone()[0]

        if count == 0:
            sample_vehicles = [
                ("Toyota Corolla", "Sedan", 2500.0, "available", "Automatic", "Petrol", 5),
                ("Honda CR-V", "SUV", 3800.0, "available", "Automatic", "Hybrid", 5),
                ("Hyundai i20", "Hatchback", 1600.0, "available", "Manual", "Petrol", 5),
                ("Tesla Model 3", "Electric", 6000.0, "available", "Automatic", "Electric", 5),
                ("Ford Explorer", "SUV", 4800.0, "maintenance", "Automatic", "Petrol", 7),
                ("Volkswagen Golf", "Hatchback", 2200.0, "available", "Manual", "Diesel", 5)
            ]
            conn.executemany("""
                INSERT INTO vehicles (model, type, daily_rate, status, transmission, fuel_type, seats)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, sample_vehicles)

    conn.close()


# =============================================================================
# Validation and Business Logic Helpers
# =============================================================================

def parse_iso_date(date_str):
    """
    Parse a YYYY-MM-DD string into a date object.
    Returns datetime.date or raises ValueError.
    """
    if not date_str or not isinstance(date_str, str):
        raise ValueError("Date string is required.")
    return datetime.strptime(date_str.strip(), "%Y-%m-%d").date()


def validate_date_range(pickup_date_str, return_date_str):
    """
    Validates pickup and return dates.
    Ensures correct format and rejects reversed date ranges.
    Returns (pickup_date, return_date, duration_days).
    """
    try:
        p_date = parse_iso_date(pickup_date_str)
    except ValueError:
        raise ValueError("Invalid pickup date format. Expected YYYY-MM-DD.")

    try:
        r_date = parse_iso_date(return_date_str)
    except ValueError:
        raise ValueError("Invalid return date format. Expected YYYY-MM-DD.")

    if r_date < p_date:
        raise ValueError("Return date cannot be earlier than pickup date.")

    diff = (r_date - p_date).days
    duration_days = 1 if diff == 0 else diff
    return p_date, r_date, duration_days


def is_vehicle_available_for_dates(conn, vehicle_id, pickup_date_str, return_date_str):
    """
    Checks if a vehicle is available for the given date range.
    Returns (is_available: bool, reason: str).
    """
    # 1. Check vehicle base status
    cursor = conn.execute("SELECT status FROM vehicles WHERE id = ?", (vehicle_id,))
    v_row = cursor.fetchone()
    if not v_row:
        return False, "Vehicle not found."
    if v_row["status"] != "available":
        return False, f"Vehicle is marked as {v_row['status']}."

    # 2. Check for overlapping, not-yet-completed bookings. A booking remains
    # active through its return date and stops blocking availability the next day.
    query = """
        SELECT COUNT(*) FROM bookings
        WHERE vehicle_id = ?
          AND status != 'Cancelled'
          AND pickup_date <= ?
          AND return_date >= ?
    """
    overlap_cursor = conn.execute(query, (vehicle_id, return_date_str, pickup_date_str))
    overlap_count = overlap_cursor.fetchone()[0]

    if overlap_count > 0:
        return False, "Vehicle has an existing booking that overlaps with the requested dates."

    return True, "Available"


def generate_unique_booking_reference(conn):
    """
    Generates a unique booking reference in the format VR-YYYY-XXXX.
    """
    year = datetime.now().year
    while True:
        suffix = uuid.uuid4().hex[:5].upper()
        ref = f"VR-{year}-{suffix}"
        cur = conn.execute("SELECT 1 FROM bookings WHERE booking_reference = ?", (ref,))
        if not cur.fetchone():
            return ref


# =============================================================================
# API Endpoints (Module 1: Vehicle Search and Availability)
# =============================================================================

@app.route("/api/vehicles", methods=["GET"])
def get_vehicles():
    """
    Retrieve vehicles from SQLite database.
    Supports filters:
      - type: vehicle type (e.g. 'Sedan', 'SUV') or 'all'
      - max_price: maximum daily rate (float)
      - pickup_date & return_date: checks date availability & prevents overlapping bookings
    """
    v_type = request.args.get("type", "all").strip()
    max_price = request.args.get("max_price") or request.args.get("maxPrice")
    pickup_date = request.args.get("pickup_date") or request.args.get("pickupDate")
    return_date = request.args.get("return_date") or request.args.get("returnDate")

    # Availability can only be calculated from a complete rental period.
    # Reject partial date filters instead of silently returning the base fleet.
    has_any_date = bool(pickup_date or return_date)
    has_dates = bool(pickup_date and return_date)
    if has_any_date and not has_dates:
        return jsonify({"error": "Both pickup_date and return_date are required for availability checking."}), 400

    if has_dates:
        try:
            _, _, _ = validate_date_range(pickup_date, return_date)
        except ValueError as err:
            return jsonify({"error": str(err)}), 400

    conn = get_db()
    try:
        # Base query with dynamic parameterized filters
        params = []
        if has_dates:
            # Check availability including overlapping bookings
            sql = """
                SELECT v.id, v.model, v.type, v.daily_rate, v.status,
                       v.transmission, v.fuel_type, v.seats,
                       CASE
                           WHEN v.status != 'available' THEN 0
                           WHEN EXISTS (
                               SELECT 1 FROM bookings b
                               WHERE b.vehicle_id = v.id
                                 AND b.status != 'Cancelled'
                                 AND b.pickup_date <= ?
                                 AND b.return_date >= ?
                           ) THEN 0
                           ELSE 1
                       END AS is_available
                FROM vehicles v
                WHERE 1=1
            """
            params.extend([return_date, pickup_date])
        else:
            # Base availability without date range
            sql = """
                SELECT v.id, v.model, v.type, v.daily_rate, v.status,
                       v.transmission, v.fuel_type, v.seats,
                       CASE WHEN v.status = 'available' THEN 1 ELSE 0 END AS is_available
                FROM vehicles v
                WHERE 1=1
            """

        # Apply vehicle type filter
        if v_type and v_type.lower() != "all":
            sql += " AND LOWER(v.type) = LOWER(?)"
            params.append(v_type)

        # Apply max price filter
        if max_price:
            try:
                max_price_val = float(max_price)
                sql += " AND v.daily_rate <= ?"
                params.append(max_price_val)
            except ValueError:
                return jsonify({"error": "Invalid max_price filter value."}), 400

        sql += " ORDER BY v.daily_rate ASC"

        cursor = conn.execute(sql, params)
        rows = cursor.fetchall()

        vehicles = []
        for row in rows:
            vehicles.append({
                "id": row["id"],
                "name": row["model"],
                "model": row["model"],
                "type": row["type"],
                "pricePerDay": row["daily_rate"],
                "daily_rate": row["daily_rate"],
                "available": bool(row["is_available"]),
                "status": row["status"],
                "transmission": row["transmission"],
                "fuelType": row["fuel_type"],
                "seats": row["seats"]
            })

        return jsonify(vehicles), 200

    finally:
        conn.close()


# =============================================================================
# API Endpoints (Module 2: Vehicle Booking and Reservation)
# =============================================================================

@app.route("/api/bookings", methods=["POST"])
def create_booking():
    """
    Reserve a vehicle and persist the booking to SQLite.
    Validates input fields, rechecks availability, calculates cost, and writes safely.
    """
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Request body must be a valid JSON object."}), 400

    # Extract parameters (supports both camelCase and snake_case)
    vehicle_id = data.get("vehicle_id") or data.get("vehicleId")
    customer_name = (data.get("customer_name") or data.get("customerName") or "").strip()
    customer_email = (data.get("customer_email") or data.get("customerEmail") or "").strip()
    pickup_date = data.get("pickup_date") or data.get("pickupDate")
    return_date = data.get("return_date") or data.get("returnDate")

    # 1. Validate required fields
    if not vehicle_id:
        return jsonify({"error": "Vehicle ID is required."}), 400

    if not customer_name or len(customer_name) < 2:
        return jsonify({"error": "Customer full name is required (minimum 2 characters)."}), 400

    email_regex = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    if not customer_email or not re.match(email_regex, customer_email):
        return jsonify({"error": "A valid customer email address is required."}), 400

    # 2. Validate dates
    try:
        _, _, duration_days = validate_date_range(pickup_date, return_date)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    conn = get_db()
    try:
        with conn:
            # 3. Verify vehicle exists
            cursor = conn.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,))
            vehicle = cursor.fetchone()
            if not vehicle:
                return jsonify({"error": f"Vehicle with ID {vehicle_id} does not exist."}), 404

            # 4. Recheck vehicle availability inside transaction
            available, reason = is_vehicle_available_for_dates(conn, vehicle_id, pickup_date, return_date)
            if not available:
                return jsonify({
                    "error": f"Vehicle is not available for the requested dates: {reason}"
                }), 409  # 409 Conflict

            # 5. Calculate cost based on database daily_rate
            daily_rate = vehicle["daily_rate"]
            total_cost = duration_days * daily_rate

            # 6. Generate unique booking reference
            booking_ref = generate_unique_booking_reference(conn)

            # 7. Insert booking record safely
            insert_sql = """
                INSERT INTO bookings (
                    booking_reference, vehicle_id, customer_name, customer_email,
                    pickup_date, return_date, duration_days, daily_rate, total_cost, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed')
            """
            conn.execute(insert_sql, (
                booking_ref,
                vehicle_id,
                customer_name,
                customer_email,
                pickup_date,
                return_date,
                duration_days,
                daily_rate,
                total_cost
            ))

        # 8. Return response matching UI confirmation expectations
        response_payload = {
            "success": True,
            "bookingReference": booking_ref,
            "status": "Confirmed (Saved in SQLite)",
            "booking": {
                "bookingReference": booking_ref,
                "vehicleId": vehicle["id"],
                "vehicleName": vehicle["model"],
                "vehicleType": vehicle["type"],
                "customerName": customer_name,
                "customerEmail": customer_email,
                "pickupDate": pickup_date,
                "returnDate": return_date,
                "durationDays": duration_days,
                "dailyRate": daily_rate,
                "totalCost": total_cost,
                "status": "Confirmed (Saved in SQLite)"
            }
        }
        return jsonify(response_payload), 201

    except sqlite3.IntegrityError as err:
        return jsonify({"error": f"Database integrity error: {str(err)}"}), 409
    finally:
        conn.close()


# =============================================================================
# Static UI Serving (Allows running full app from Flask)
# =============================================================================

@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(BASE_DIR, path)


# =============================================================================
# Server Entrypoint
# =============================================================================

if __name__ == "__main__":
    init_db()
    print("Vehicle Rental Database initialized.")
    print("Server running on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
