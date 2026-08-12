# Apartment Renovation Expense Tracker

## Purpose

Track all expenses related to an apartment renovation using a local JSON file as the single source of truth.

The system must be simple, deterministic, human-readable, and easy to extend later with n8n, Telegram, a web UI, or a database.

## Core principles

- JSON is the source of truth.
- Keep the data human-readable.
- Do not store calculated totals permanently.
- Calculate totals from transactions.
- Every expense must have a unique ID.
- Never silently delete or modify an existing expense.
- Prefer appending new transactions.
- Dates use ISO 8601 format: `YYYY-MM-DD`.
- Monetary values are stored as numbers.
- Currency is EURO.
- Avoid unnecessary dependencies.
- Keep the schema backward-compatible when possible.

---

# Data model

The main file is:

`renovation.json`

Example:

```json
{
  "version": 1,
  "project": {
    "name": "Apartment Renovation",
    "currency": "EUR",
    "budget": 25000
  },
  "rooms": [
    {
      "id": "living_room",
      "name": "Living Room"
    },
    {
      "id": "kitchen",
      "name": "Kitchen"
    },
    {
      "id": "bedroom",
      "name": "Bedroom"
    },
    {
      "id": "kids_room",
      "name": "Kids Room"
    },
    {
      "id": "bathroom",
      "name": "Bathroom"
    },
    {
      "id": "hallway",
      "name": "Hallway"
    },
    {
      "id": "terrace",
      "name": "Terrace"
    }
  ],
  "categories": [
    {
      "id": "materials",
      "name": "Materials"
    },
    {
      "id": "labor",
      "name": "Labor"
    },
    {
      "id": "furniture",
      "name": "Furniture"
    },
    {
      "id": "appliances",
      "name": "Appliances"
    },
    {
      "id": "tools",
      "name": "Tools"
    },
    {
      "id": "transport",
      "name": "Transport"
    },
    {
      "id": "other",
      "name": "Other"
    }
  ],
  "expenses": []
}