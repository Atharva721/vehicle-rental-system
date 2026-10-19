# Vehicle Rental System - Test Cases

The implemented modules are **Vehicle Search and Availability** and **Vehicle Booking and Reservation**.

| Test Case ID | Module | Test Scenario | Test Data | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC-01 | Search | View fleet | No filters | Six seeded vehicles are returned | Six vehicles returned | Pass |
| TC-02 | Search | Filter by type | `type=SUV` | Only SUVs are returned | Two SUVs returned | Pass |
| TC-03 | Search | Filter by maximum daily rate | `max_price=2000` | Only rates at or below INR 2,000 are returned | Hyundai i20 returned | Pass |
| TC-04 | Search | Reject invalid date range | Pickup `2026-10-25`, return `2026-10-20` | HTTP 400 with date-range error | HTTP 400 returned | Pass |
| TC-05 | Search | Reject incomplete availability request | Pickup `2026-10-25` only | HTTP 400 requiring both dates | HTTP 400 returned | Pass |
| TC-06 | Search | Detect reserved vehicle | Vehicle 1 booked for `2026-11-10` to `2026-11-15`; search `2026-11-12` to `2026-11-14` | Vehicle 1 is unavailable | Vehicle 1 marked unavailable | Pass |
| TC-07 | Booking | Create valid reservation | Vehicle 2, valid customer and `2026-12-01` to `2026-12-03` | HTTP 201, unique reference, total INR 7,600 | Booking stored with total INR 7,600 | Pass |
| TC-08 | Booking | Validate required details | Missing vehicle, short name, invalid email | HTTP 400 validation error | HTTP 400 returned | Pass |
| TC-09 | Booking | Reject unknown vehicle | Vehicle ID `9999` | HTTP 404 | HTTP 404 returned | Pass |
| TC-10 | Booking | Prevent overlapping reservation | Second booking overlaps a confirmed booking | HTTP 409 conflict | HTTP 409 returned | Pass |
| TC-11 | Booking | Enforce database relation | Insert booking for unknown vehicle | SQLite foreign-key error | Foreign-key error raised | Pass |
| TC-12 | Integration | Frontend submits reservation | Valid form submission while Flask service is running | Backend validates and persists the booking; UI shows reference | Verified by API integration test | Pass |

Techniques used: functional testing, unit testing, integration testing, validation testing, boundary value analysis (same-day and reversed dates), and equivalence partitioning (valid and invalid names, emails, IDs, and dates).

