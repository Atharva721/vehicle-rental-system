# PBL Compliance Review

## Completed in this project

| Guideline requirement | Evidence |
|---|---|
| Two functional modules | Vehicle Search and Availability; Vehicle Booking and Reservation |
| User interface | `index.html`, `css/style.css`, and `js/app.js` |
| Backend and database | Flask API in `app.py` and SQLite schema in `rental.db` |
| Input validation | Client and server validation for names, emails, vehicle IDs, and date ranges |
| Component integration | Frontend calls `GET /api/vehicles` and `POST /api/bookings` |
| Test cases and results | `TEST_CASES.md` and 16 passing automated tests in `test_app.py` |
| Bug identification, fixing, and retesting | Partial date-filter bug fixed in `app.py`; retested by TC-05 |

## Still required outside the source folder

1. Create the individual Jira project and enter the backlog from `JIRA_BACKLOG.md`.
2. Create Sprint 1, assign the issues to yourself, and show the issue statuses on the board.
3. Create the documented bug in Jira, attach the test evidence, and retain its resolved status.
4. Prepare the final project report and presentation, then demonstrate the two modules, Jira board, test cases, and bug fix.

The Jira project is the only implementation requirement that cannot be evidenced locally; it must exist in your Atlassian account.
