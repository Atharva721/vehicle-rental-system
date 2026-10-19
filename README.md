# Vehicle Rental System (College PBL Project)

A complete, responsive Vehicle Rental System built with an **HTML5/CSS3/JavaScript frontend** and a **Python Flask backend with an SQLite database**.

Tailored for academic Project-Based Learning (PBL), this project adheres to clean architecture, parameterised SQL queries, transactional writes, and strict database integrity.

---

## 📁 Project Structure

```text
Vehicle Rental System/
├── app.py              # Python Flask REST API, SQLite queries, validation & static server
├── test_app.py         # Automated unit test suite (15 tests: dates, prices, overlap, FKs)
├── rental.db           # SQLite database (auto-created & auto-seeded on startup)
├── requirements.txt    # Python dependencies (Flask, Flask-Cors)
├── index.html          # Semantic HTML5 UI containing the 3 screens
├── css/
│   └── style.css       # Clean minimal styling (white background, dark slate, indigo accent)
├── js/
│   ├── app.js          # UI controller (screen navigation, form validation, dynamic price calculation)
│   └── mockData.js     # API adapter communicating with Flask endpoints
└── README.md           # Documentation, Windows setup, and run instructions
```

---

## 🛠️ Technology Stack

- **Frontend:**
  - HTML5 (Semantic elements, accessible form controls)
  - CSS3 (Vanilla CSS design system, responsive grid/flexbox, custom status badges)
  - JavaScript ES6+ (Native Fetch API, DOM manipulation, real-time date calculation)
- **Backend:**
  - Python 3.13+
  - Flask (Lightweight REST API framework)
  - Flask-Cors (Cross-Origin Resource Sharing support)
- **Database:**
  - SQLite3 with parameterised queries and foreign key constraints enabled (`PRAGMA foreign_keys = ON;`)

---

## 🚀 Two Integrated Modules

### Module 1: Vehicle Search and Availability
- **Database Table:** `vehicles` (`id`, `model`, `type`, `daily_rate`, `status`, `transmission`, `fuel_type`, `seats`).
- **Automatic Fleet Seeding:** If the `vehicles` table is empty on startup, 6 sample vehicles are seeded automatically.
- **REST Endpoint:** `GET /api/vehicles`
  - Query parameters: `type`, `max_price`, `pickup_date`, `return_date`.
  - Date Validation: Validates ISO format (`YYYY-MM-DD`). Rejects reversed dates (`return_date < pickup_date`) with `HTTP 400`.
  - Overlap Prevention: Calculates availability by cross-referencing active bookings in the requested date range:
    ```sql
    b.pickup_date <= requested_return AND b.return_date >= requested_pickup
    ```
    If an overlapping reservation exists, the vehicle is marked as `available: false` with the "Unavailable" badge.

### Module 2: Vehicle Booking and Reservation
- **Database Table:** `bookings` (`id`, `booking_reference`, `vehicle_id`, `customer_name`, `customer_email`, `pickup_date`, `return_date`, `duration_days`, `daily_rate`, `total_cost`, `status`, `created_at`).
- **REST Endpoint:** `POST /api/bookings`
  - Server-Side Validation: Validates non-empty customer name (min 2 chars), RFC-compliant email address, valid date formats, and vehicle existence.
  - Cost Calculation: Total rental cost is computed on the server using database daily rates: `duration_days * daily_rate`.
  - Atomic Overlap Recheck: Rechecks availability within a database transaction before inserting. If overlapping dates are submitted simultaneously, returns `HTTP 409 Conflict`.
  - Unique Reference Generation: Automatically generates a unique booking code (e.g. `VR-2026-A1B2C`).
  - Foreign Key Constraint: Strictly enforces `FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT`.

---

## 💻 Setup and Run Instructions on Windows

### Step 1: Open PowerShell in the Project Directory
Open **Windows PowerShell** or **Command Prompt** and navigate to this folder:
```powershell
cd "c:\Users\Dell\OneDrive\Documents\Vehicle Rental System"
```

### Step 2: Create and Activate Virtual Environment
```powershell
# Create virtual environment
python -m venv .venv

# Activate virtual environment (PowerShell)
.venv\Scripts\Activate.ps1

# (If running standard Command Prompt / cmd.exe instead):
# .venv\Scripts\activate.bat
```

> *Tip: If PowerShell displays a script execution policy restriction, run:*
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Step 3: Install Required Dependencies
```powershell
.venv\Scripts\pip install -r requirements.txt
```

### Step 4: Run the Flask Application
```powershell
.venv\Scripts\python app.py
```
Output:
```text
Vehicle Rental Database initialized.
Server running on http://127.0.0.1:5000
```

### Step 5: Open the Application in your Browser
Open your browser and navigate to:
```text
http://127.0.0.1:5000
```
*(You can also double-click `index.html` directly from File Explorer; CORS is enabled so it connects to the Flask API on port 5000 seamlessly!)*

---

## 🧪 Running the Automated Unit Test Suite

An automated test suite (`test_app.py`) verifies all backend functionality:
- Date parsing and rejection of reversed/invalid date ranges.
- Rental duration and total price calculation.
- Vehicle database queries and filtering (by type and price).
- Overlapping booking detection and conflict rejection (HTTP 409).
- Successful booking creation and database record persistence.
- SQLite foreign key integrity constraints.

Run the tests using Python's built-in `unittest` runner:
```powershell
.venv\Scripts\python -m unittest test_app.py -v
```

Expected output:
```text
test_booking_validation_errors ... ok
test_database_initialization_and_seeding ... ok
test_foreign_key_enforcement ... ok
test_get_vehicles_all ... ok
test_get_vehicles_filter_by_max_price ... ok
test_get_vehicles_filter_by_type ... ok
test_get_vehicles_reversed_dates_rejected ... ok
test_overlapping_booking_availability ... ok
test_successful_booking_creation ... ok
test_parse_iso_date_invalid ... ok
test_parse_iso_date_valid ... ok
test_price_calculation ... ok
test_validate_date_range_reversed ... ok
test_validate_date_range_same_day ... ok
test_validate_date_range_valid ... ok

----------------------------------------------------------------------
Ran 15 tests in 0.257s

OK
```

---

## 💾 Database Schema Reference

```sql
PRAGMA foreign_keys = ON;

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
```
