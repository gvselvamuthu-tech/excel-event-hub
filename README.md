# Excel Event Hub

A professional, responsive event registration website for Excel Engineering College (Autonomous), Komarapalayam, Namakkal, Tamil Nadu, India.

## Step 02: Project structure and data organization

This stage keeps the working Step 01 homepage and reorganizes the project into a cleaner structure for future event pages, registration pages, and admin flows.

## Folder structure

- `index.html`
- `pages/`
- `css/`
- `js/`
- `data/`
- `assets/images/`
- `assets/logo/`

## Important image notes

- The official college building image should be placed at:
  `assets/images/college-building.jpg`
- The event placeholder image is available at:
  `assets/images/event-placeholder.svg`
- The logo placeholder is available at:
  `assets/logo/college-logo-text.svg`

## Run locally

From the project folder, install the dependency and start the local server:

```powershell
npm install
npm start
```

Configure `MONGODB_URI` in `.env` before starting the server. Set `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` there as well for the Admin Dashboard; when these are unset, the existing demo credentials remain available for local development only. Then open http://127.0.0.1:8000 in the browser. The server creates missing registration and payment workbook files in `data/` on first start and leaves existing workbooks unchanged.

## Notes

- College information is centralized in `data/college.js`.
- `data/events.xlsx` is the migration source for the current event records; `data/events.js` remains the initial seed for a new local workbook.
- MongoDB stores events in the `events` collection through the `Event` model in `models/Event.js`. The existing event `id` is unique and remains the event identifier.
- `data/registrations.xlsx` and `data/payments.xlsx` start with headers only and receive records submitted through the site.
- The Node.js server reads and updates events in MongoDB. Registration and payment records continue to use their existing workbook storage. The server listens on `127.0.0.1` by default.
- The Admin Dashboard's Clear Payment Records action requires server-verified credentials and a separate confirmation. Before clearing payment rows, the server backs up `data/payments.xlsx` under `data/backups/` and retains the Payments sheet and its 15 headers.

## Event migration

Run `npm run migrate:events` to safely migrate the current `data/events.xlsx` event records into MongoDB. The migration upserts by the existing event `id`, verifies event fields plus `status`, `qrCode`, and `scannerEnabled`, checks for duplicates, and retains the workbook as the source backup. It can be run again to update MongoDB from the workbook without creating duplicate event IDs.

## Local API

The dashboard reads and updates events through `/api/events`; registration and payment submissions use `/api/registrations` and `/api/payments`.
