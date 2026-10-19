# Jira Backlog - Vehicle Rental System

Use this exact structure in the individual Jira project named **Vehicle Rental System PBL**.

## Project

- **Description:** A web application that lets customers search vehicle availability and create validated rental reservations. It uses a Flask REST API and SQLite database.
- **Sprint:** Sprint 1 - Vehicle Search and Booking (goal: deliver and test both modules)

## Epic: Vehicle Search and Availability

| Type | Summary | Status | Assignee |
|---|---|---|---|
| Story | As a customer, I want to view the available vehicle fleet so that I can choose a vehicle. | Done | Project owner |
| Task | Build the vehicle listing user interface. | Done | Project owner |
| Task | Implement type and maximum-price filters. | Done | Project owner |
| Task | Implement date-based availability checking. | Done | Project owner |
| Task | Write and execute search-module test cases. | Done | Project owner |

## Epic: Vehicle Booking and Reservation

| Type | Summary | Status | Assignee |
|---|---|---|---|
| Story | As a customer, I want to reserve an available vehicle for chosen dates so that my rental is confirmed. | Done | Project owner |
| Task | Build the booking form and cost estimate. | Done | Project owner |
| Task | Implement server-side validation and booking persistence. | Done | Project owner |
| Task | Prevent overlapping reservations using a transaction. | Done | Project owner |
| Task | Write and execute booking-module test cases. | Done | Project owner |

## Bug: Partial availability date filter accepted

- **Summary:** Availability search accepted a pickup or return date alone and ignored date-based availability checking.
- **Steps to reproduce:** Request `GET /api/vehicles?pickup_date=2026-10-25`.
- **Expected:** A validation error requires both pickup and return dates.
- **Actual before fix:** The fleet was returned without availability checking.
- **Severity/Priority:** Medium
- **Status:** Done
- **Resolution:** Fixed and retested with TC-05.
