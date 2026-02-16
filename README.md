# FlowTrack – Expense Tracker

FlowTrack is a small full‑stack web app for tracking personal expenses.

It supports:

- Adding expenses with amount, category, description and date
- Viewing a list of all expenses
- Filtering by category
- Sorting by date (newest first)
- Showing the total of all currently visible expenses
- A hero section that shows a live snapshot of spending by top categories

The UI is intentionally simple but tries to behave like a real app under
refreshes and repeated clicks.

---

## Stack

**Backend**

- Node.js
- Express
- SQLite (file‑based DB using `sqlite3`)

**Frontend**

- Plain HTML, CSS, and vanilla JavaScript
- Served directly by Express from the `public/` folder

---

## Project structure

```text
.
├── backend
│   ├── db.js            # SQLite setup and table creation
│   ├── server.js        # Express API + static file serving
│   ├── package.json     # Node dependencies and scripts
│   └── public
│       ├── index.html   # UI markup
│       ├── styles.css   # Styling / layout
│       └── app.js       # Browser-side logic
├── .gitignore
└── README.md
```

## Live demo

The app is deployed on Render:

https://expense-tracker-abdi.onrender.com
