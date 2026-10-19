"""
Unit Tests for Vehicle Rental System Flask Backend & SQLite Database
Tests cover:
1. Date validation (valid, same-day, reversed, malformed)
2. Rental duration and price calculation
3. Vehicle search, filtering, and availability checking
4. Overlapping booking detection and conflict rejection
5. Booking creation and database persistence
6. SQLite foreign key enforcement
"""

import os
import sqlite3
import tempfile
import unittest
from datetime import date

import app as flask_app
from app import (
    app,
    get_db,
    init_db,
    validate_date_range,
    parse_iso_date,
    is_vehicle_available_for_dates
)


class TestDateValidationAndPrice(unittest.TestCase):
    """Unit tests for date validation and price calculation logic"""

    def test_parse_iso_date_valid(self):
        d = parse_iso_date("2026-10-20")
        self.assertEqual(d, date(2026, 10, 20))

    def test_parse_iso_date_invalid(self):
        with self.assertRaises(ValueError):
            parse_iso_date("invalid-date")
        with self.assertRaises(ValueError):
            parse_iso_date("20-10-2026")
        with self.assertRaises(ValueError):
            parse_iso_date("")

    def test_validate_date_range_valid(self):
        p, r, duration = validate_date_range("2026-10-20", "2026-10-23")
        self.assertEqual(duration, 3)
        self.assertEqual(p, date(2026, 10, 20))
        self.assertEqual(r, date(2026, 10, 23))

    def test_validate_date_range_same_day(self):
        # Same day rental is counted as 1 day duration
        p, r, duration = validate_date_range("2026-10-20", "2026-10-20")
        self.assertEqual(duration, 1)

    def test_validate_date_range_reversed(self):
        # Return date earlier than pickup date must be rejected
        with self.assertRaises(ValueError) as ctx:
            validate_date_range("2026-10-25", "2026-10-20")
        self.assertIn("earlier than pickup date", str(ctx.exception))

    def test_price_calculation(self):
        daily_rate = 2500.0
        _, _, duration = validate_date_range("2026-10-10", "2026-10-14")
        self.assertEqual(duration, 4)
        total_cost = duration * daily_rate
        self.assertEqual(total_cost, 10000.0)


class TestBackendAPIAndDatabase(unittest.TestCase):
    """Integration and API unit tests using isolated SQLite database"""

    def setUp(self):
        # Create a temporary database file for isolated testing
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".db")
        flask_app.DATABASE_PATH = self.db_path
        init_db(self.db_path)

        app.config["TESTING"] = True
        self.client = app.test_client()

    def tearDown(self):
        os.close(self.db_fd)
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_database_initialization_and_seeding(self):
        conn = get_db(self.db_path)
        cur = conn.execute("SELECT COUNT(*) FROM vehicles")
        count = cur.fetchone()[0]
        conn.close()
        # Initial seed must contain 6 sample vehicles
        self.assertEqual(count, 6)

    def test_foreign_key_enforcement(self):
        conn = get_db(self.db_path)
        # Attempting to insert a booking for non-existent vehicle ID 99999 should violate FK
        with self.assertRaises(sqlite3.IntegrityError):
            with conn:
                conn.execute("""
                    INSERT INTO bookings (
                        booking_reference, vehicle_id, customer_name, customer_email,
                        pickup_date, return_date, duration_days, daily_rate, total_cost
                    ) VALUES ('VR-TEST-FAIL', 99999, 'Test', 'test@example.com', '2026-10-20', '2026-10-22', 2, 2500, 5000)
                """)
        conn.close()

    def test_get_vehicles_all(self):
        res = self.client.get("/api/vehicles")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 6)

    def test_get_vehicles_filter_by_type(self):
        res = self.client.get("/api/vehicles?type=SUV")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(all(v["type"] == "SUV" for v in data))
        self.assertEqual(len(data), 2)  # Honda CR-V and Ford Explorer

    def test_get_vehicles_filter_by_max_price(self):
        res = self.client.get("/api/vehicles?max_price=2000")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(all(v["pricePerDay"] <= 2000 for v in data))
        # Hyundai i20 (1600)
        self.assertEqual(len(data), 1)

    def test_get_vehicles_reversed_dates_rejected(self):
        res = self.client.get("/api/vehicles?pickup_date=2026-10-25&return_date=2026-10-20")
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("error", data)
        self.assertIn("earlier than pickup date", data["error"])

    def test_get_vehicles_partial_date_filter_rejected(self):
        res = self.client.get("/api/vehicles?pickup_date=2026-10-25")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Both pickup_date and return_date", res.get_json()["error"])

    def test_overlapping_booking_availability(self):
        # 1. Create a confirmed booking for vehicle 1 (Toyota Corolla) from 2026-11-10 to 2026-11-15
        booking_payload = {
            "vehicle_id": 1,
            "customer_name": "John Doe",
            "customer_email": "john@example.com",
            "pickup_date": "2026-11-10",
            "return_date": "2026-11-15"
        }
        create_res = self.client.post("/api/bookings", json=booking_payload)
        self.assertEqual(create_res.status_code, 201)

        # 2. Query vehicles for an overlapping date range (2026-11-12 to 2026-11-14)
        # Vehicle 1 must appear as available = False
        res = self.client.get("/api/vehicles?pickup_date=2026-11-12&return_date=2026-11-14")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        v1 = next(v for v in data if v["id"] == 1)
        self.assertFalse(v1["available"], "Vehicle 1 should be unavailable due to overlapping booking.")

        # 3. Query vehicles for a non-overlapping future date range (2026-11-16 to 2026-11-20)
        # Vehicle 1 must appear as available = True
        res_future = self.client.get("/api/vehicles?pickup_date=2026-11-16&return_date=2026-11-20")
        self.assertEqual(res_future.status_code, 200)
        data_future = res_future.get_json()
        v1_future = next(v for v in data_future if v["id"] == 1)
        self.assertTrue(v1_future["available"], "Vehicle 1 should be available for non-overlapping dates.")

        # 4. Attempt to book vehicle 1 again during overlapping dates (2026-11-13 to 2026-11-17)
        # Must return 409 Conflict
        overlap_booking = {
            "vehicle_id": 1,
            "customer_name": "Jane Smith",
            "customer_email": "jane@example.com",
            "pickup_date": "2026-11-13",
            "return_date": "2026-11-17"
        }
        overlap_res = self.client.post("/api/bookings", json=overlap_booking)
        self.assertEqual(overlap_res.status_code, 409)
        overlap_data = overlap_res.get_json()
        self.assertIn("error", overlap_data)
        self.assertIn("overlaps", overlap_data["error"])

    def test_booking_validation_errors(self):
        # Missing vehicle_id
        res = self.client.post("/api/bookings", json={
            "customer_name": "Alice",
            "customer_email": "alice@example.com",
            "pickup_date": "2026-10-20",
            "return_date": "2026-10-22"
        })
        self.assertEqual(res.status_code, 400)

        # Name too short
        res = self.client.post("/api/bookings", json={
            "vehicle_id": 1,
            "customer_name": "A",
            "customer_email": "alice@example.com",
            "pickup_date": "2026-10-20",
            "return_date": "2026-10-22"
        })
        self.assertEqual(res.status_code, 400)

        # Invalid email
        res = self.client.post("/api/bookings", json={
            "vehicle_id": 1,
            "customer_name": "Alice Smith",
            "customer_email": "not-an-email",
            "pickup_date": "2026-10-20",
            "return_date": "2026-10-22"
        })
        self.assertEqual(res.status_code, 400)

        # Non-existent vehicle
        res = self.client.post("/api/bookings", json={
            "vehicle_id": 9999,
            "customer_name": "Alice Smith",
            "customer_email": "alice@example.com",
            "pickup_date": "2026-10-20",
            "return_date": "2026-10-22"
        })
        self.assertEqual(res.status_code, 404)

    def test_successful_booking_creation(self):
        payload = {
            "vehicle_id": 2,  # Honda CR-V (₹3,800/day)
            "customer_name": "Bob Martin",
            "customer_email": "bob@example.com",
            "pickup_date": "2026-12-01",
            "return_date": "2026-12-03"  # 2 days duration
        }
        res = self.client.post("/api/bookings", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()

        self.assertTrue(data["success"])
        self.assertTrue(data["bookingReference"].startswith("VR-"))
        b = data["booking"]
        self.assertEqual(b["durationDays"], 2)
        self.assertEqual(b["dailyRate"], 3800.0)
        self.assertEqual(b["totalCost"], 7600.0)
        self.assertEqual(b["customerName"], "Bob Martin")

        # Verify saved in SQLite database
        conn = get_db(self.db_path)
        cur = conn.execute("SELECT * FROM bookings WHERE booking_reference = ?", (data["bookingReference"],))
        row = cur.fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertEqual(row["customer_name"], "Bob Martin")
        self.assertEqual(row["total_cost"], 7600.0)


if __name__ == "__main__":
    unittest.main()
