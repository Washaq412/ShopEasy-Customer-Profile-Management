
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = 5000;
const CUSTOMER_ID = 1;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// DATABASE CONNECTION
const db = new Database(
  path.join(__dirname, "database", "shopeasy.db")
);

db.pragma("foreign_keys = ON");

// CREATE TABLES
db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  profile_image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  address_type TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS customer_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER UNIQUE NOT NULL,
  email_notifications INTEGER DEFAULT 1,
  sms_notifications INTEGER DEFAULT 1,
  privacy_enabled INTEGER DEFAULT 1,
  language TEXT DEFAULT 'English',
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
`);

// DATABASE MIGRATION
const columns = db.prepare(
  "PRAGMA table_info(customer_settings)"
).all().map(column => column.name);

if (!columns.includes("privacy_enabled")) {
  db.exec(
    "ALTER TABLE customer_settings ADD COLUMN privacy_enabled INTEGER DEFAULT 1"
  );
}

if (!columns.includes("language")) {
  db.exec(
    "ALTER TABLE customer_settings ADD COLUMN language TEXT DEFAULT 'English'"
  );
}

// HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ShopEasy API is running!"
  });
});

// GET PROFILE
app.get("/api/profile", (req, res) => {
  const profile = db.prepare(`
    SELECT * FROM customers WHERE id = ?
  `).get(CUSTOMER_ID);

  res.json(profile || null);
});

// CREATE PROFILE
app.post("/api/profile", (req, res) => {
  try {
    const { full_name, email, phone } = req.body;

    if (!full_name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required"
      });
    }

    const existing = db.prepare(
      "SELECT id FROM customers WHERE id = ?"
    ).get(CUSTOMER_ID);

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Profile already exists"
      });
    }

    const result = db.prepare(`
      INSERT INTO customers (id, full_name, email, phone)
      VALUES (?, ?, ?, ?)
    `).run(CUSTOMER_ID, full_name, email, phone || "");

    res.status(201).json({
      success: true,
      id: result.lastInsertRowid,
      message: "Profile created successfully"
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// UPDATE PROFILE
app.put("/api/profile", (req, res) => {
  try {
    const { full_name, email, phone, profile_image } = req.body;

    if (!full_name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required"
      });
    }

    const result = db.prepare(`
      UPDATE customers
      SET full_name = ?,
          email = ?,
          phone = ?,
          profile_image = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      full_name,
      email,
      phone || "",
      profile_image ?? null,
      CUSTOMER_ID
    );

    if (!result.changes) {
      return res.status(404).json({
        success: false,
        message: "Profile not found"
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully"
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// GET ADDRESSES
app.get("/api/addresses", (req, res) => {
  const addresses = db.prepare(`
    SELECT * FROM addresses
    WHERE customer_id = ?
    ORDER BY is_default DESC, id DESC
  `).all(CUSTOMER_ID);

  res.json(addresses);
});

// CREATE ADDRESS
app.post("/api/addresses", (req, res) => {
  try {
    const {
      address_type,
      full_name,
      phone,
      address_line,
      city,
      state,
      postal_code,
      is_default
    } = req.body;

    if (
      !address_type || !full_name || !address_line ||
      !city || !state || !postal_code
    ) {
      return res.status(400).json({
        success: false,
        message: "All required address fields must be provided"
      });
    }

    const customer = db.prepare(
      "SELECT id FROM customers WHERE id = ?"
    ).get(CUSTOMER_ID);

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Create profile first"
      });
    }

    const create = db.transaction(() => {
      if (is_default) {
        db.prepare(`
          UPDATE addresses SET is_default = 0
          WHERE customer_id = ?
        `).run(CUSTOMER_ID);
      }

      return db.prepare(`
        INSERT INTO addresses (
          customer_id, address_type, full_name, phone,
          address_line, city, state, postal_code, is_default
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        CUSTOMER_ID,
        address_type,
        full_name,
        phone || "",
        address_line,
        city,
        state,
        postal_code,
        is_default ? 1 : 0
      );
    });

    const result = create();

    res.status(201).json({
      success: true,
      id: result.lastInsertRowid,
      message: "Address added successfully"
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// UPDATE ADDRESS
app.put("/api/addresses/:id", (req, res) => {
  try {
    const {
      address_type,
      full_name,
      phone,
      address_line,
      city,
      state,
      postal_code,
      is_default
    } = req.body;

    const update = db.transaction(() => {
      const existing = db.prepare(`
        SELECT id FROM addresses
        WHERE id = ? AND customer_id = ?
      `).get(req.params.id, CUSTOMER_ID);

      if (!existing) return false;

      if (is_default) {
        db.prepare(`
          UPDATE addresses SET is_default = 0
          WHERE customer_id = ?
        `).run(CUSTOMER_ID);
      }

      db.prepare(`
        UPDATE addresses
        SET address_type = ?,
            full_name = ?,
            phone = ?,
            address_line = ?,
            city = ?,
            state = ?,
            postal_code = ?,
            is_default = CASE WHEN ? THEN 1 ELSE is_default END
        WHERE id = ? AND customer_id = ?
      `).run(
        address_type,
        full_name,
        phone || "",
        address_line,
        city,
        state,
        postal_code,
        is_default ? 1 : 0,
        req.params.id,
        CUSTOMER_ID
      );

      return true;
    });

    if (!update()) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    res.json({
      success: true,
      message: "Address updated successfully"
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// SET DEFAULT ADDRESS
app.patch("/api/addresses/:id/default", (req, res) => {
  const address = db.prepare(`
    SELECT id FROM addresses
    WHERE id = ? AND customer_id = ?
  `).get(req.params.id, CUSTOMER_ID);

  if (!address) {
    return res.status(404).json({
      success: false,
      message: "Address not found"
    });
  }

  const update = db.transaction(() => {
    db.prepare(`
      UPDATE addresses SET is_default = 0
      WHERE customer_id = ?
    `).run(CUSTOMER_ID);

    db.prepare(`
      UPDATE addresses SET is_default = 1
      WHERE id = ?
    `).run(req.params.id);
  });

  update();

  res.json({
    success: true,
    message: "Default address updated"
  });
});

// DELETE ADDRESS
app.delete("/api/addresses/:id", (req, res) => {
  const result = db.prepare(`
    DELETE FROM addresses
    WHERE id = ? AND customer_id = ?
  `).run(req.params.id, CUSTOMER_ID);

  if (!result.changes) {
    return res.status(404).json({
      success: false,
      message: "Address not found"
    });
  }

  res.json({
    success: true,
    message: "Address deleted successfully"
  });
});

// GET SETTINGS
app.get("/api/settings", (req, res) => {
  let settings = db.prepare(`
    SELECT * FROM customer_settings
    WHERE customer_id = ?
  `).get(CUSTOMER_ID);

  if (!settings) {
    db.prepare(`
      INSERT INTO customer_settings (customer_id)
      VALUES (?)
    `).run(CUSTOMER_ID);

    settings = db.prepare(`
      SELECT * FROM customer_settings
      WHERE customer_id = ?
    `).get(CUSTOMER_ID);
  }

  res.json({
    notifications: Boolean(settings.email_notifications),
    privacy: Boolean(settings.privacy_enabled),
    language: settings.language || "English"
  });
});

// UPDATE SETTINGS
app.put("/api/settings", (req, res) => {
  try {
    const { notifications, privacy, language } = req.body;

    db.prepare(`
      INSERT INTO customer_settings (
        customer_id,
        email_notifications,
        privacy_enabled,
        language
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(customer_id) DO UPDATE SET
        email_notifications = excluded.email_notifications,
        privacy_enabled = excluded.privacy_enabled,
        language = excluded.language
    `).run(
      CUSTOMER_ID,
      notifications ? 1 : 0,
      privacy ? 1 : 0,
      language || "English"
    );

    res.json({
      success: true,
      message: "Settings updated successfully"
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// START SERVER
app.listen(PORT, () => {
  console.log(`ShopEasy API running at http://localhost:${PORT}`);
});
