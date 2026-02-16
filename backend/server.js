const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ---------- helpers ----------
function toCents(rawAmount) {
  const n = Number(rawAmount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Amount must be a positive number");
  }
  return Math.round(n * 100);
}

function rowToExpense(row) {
  return {
    id: row.id,
    amount: Number((row.amount_cents / 100).toFixed(2)),
    category: row.category,
    description: row.description,
    date: row.date,
    created_at: row.created_at
  };
}

// ---------- API routes ----------

// Create expense
app.post("/expenses", (req, res) => {
  const { amount, category, description, date } = req.body || {};

  if (!amount || !category || !date) {
    return res
      .status(400)
      .json({ error: "amount, category and date are required" });
  }

  let cents;
  try {
    cents = toCents(amount);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const createdAt = new Date().toISOString();
  const sql = `
    INSERT INTO expenses (amount_cents, category, description, date, created_at)
    VALUES (?, ?, ?, ?, ?)
  `;
  const params = [
    cents,
    String(category).trim(),
    (description || "").trim(),
    String(date).slice(0, 10),
    createdAt
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error("Insert failed:", err);
      return res.status(500).json({ error: "Failed to save expense" });
    }

    db.get(
      `SELECT id, amount_cents, category, description, date, created_at
       FROM expenses WHERE id = ?`,
      [this.lastID],
      (err2, row) => {
        if (err2 || !row) {
          console.error("Fetch after insert failed:", err2);
          return res
            .status(500)
            .json({ error: "Expense created but could not be read back" });
        }
        res.status(201).json(rowToExpense(row));
      }
    );
  });
});

// List expenses
app.get("/expenses", (req, res) => {
  const { category, sort_date_desc } = req.query;

  const where = [];
  const params = [];

  if (category) {
    where.push("category = ?");
    params.push(category);
  }

  let sql = `
    SELECT id, amount_cents, category, description, date, created_at
    FROM expenses
  `;
  if (where.length) {
    sql += " WHERE " + where.join(" AND ");
  }

  if (String(sort_date_desc).toLowerCase() === "true") {
    sql += " ORDER BY date DESC, id DESC";
  } else {
    sql += " ORDER BY date ASC, id ASC";
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("List query failed:", err);
      return res.status(500).json({ error: "Failed to load expenses" });
    }
    res.json(rows.map(rowToExpense));
  });
});

// ---------- serve frontend ----------

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// ---------- 404 fallback ----------
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Expense Tracker API + UI on http://localhost:${PORT}`);
});