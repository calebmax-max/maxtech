from flask import Flask, request, jsonify, session
import os
from datetime import timedelta
from flask_cors import CORS
import pymysql
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)

# ✅ IMPORTANT: change this to a strong secret in production
app.config["SECRET_KEY"] = "super-secret-key"

app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "None"   # ✅ for cross-origin
app.config["SESSION_COOKIE_SECURE"] = True       # ✅ required for HTTPS (AlwaysData)

# ✅ CORS (important for React frontend)
CORS(app, supports_credentials=True)

# DATABASE CONFIG (AlwaysData)
DB_HOST = "mysql-calebtonny.alwaysdata.net"
DB_USER = "calebtonny"
DB_PASSWORD = "modcom1234"
DB_NAME = "calebtonny_sokogarden"

# DEFAULT ADMIN
ADMIN_EMAIL = "caleb@gmail.com"
ADMIN_PASSWORD = "Caleb123"

# ---------------- DATABASE ----------------
def get_connection():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor,
    )

# ---------------- HELPERS ----------------
def normalize_email(email):
    return str(email or "").strip().lower()

def get_payload():
    return request.get_json(silent=True) or request.form

def is_password_strong(password):
    password = str(password or "")
    return len(password) >= 8 and any(c.isalpha() for c in password) and any(c.isdigit() for c in password)

def build_user(user):
    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "email": user["email"],
        "phone": user["phone"],
    }

# ---------------- SETUP ----------------
def ensure_users_table():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(120),
            email VARCHAR(160) UNIQUE,
            phone VARCHAR(30),
            password VARCHAR(255)
        )
    """)

    conn.commit()
    cur.close()
    conn.close()

def ensure_admin():
    ensure_users_table()

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM users WHERE email=%s", (ADMIN_EMAIL,))
    user = cur.fetchone()

    hashed = generate_password_hash(ADMIN_PASSWORD)

    if user:
        cur.execute("UPDATE users SET password=%s WHERE email=%s", (hashed, ADMIN_EMAIL))
    else:
        cur.execute("""
            INSERT INTO users(username,email,phone,password)
            VALUES(%s,%s,%s,%s)
        """, ("Admin", ADMIN_EMAIL, "+254700000000", hashed))

    conn.commit()
    cur.close()
    conn.close()

ensure_admin()

# ---------------- ROUTES ----------------

@app.route("/")
def home():
    return jsonify({"message": "API is running 🚀"})

# SIGNUP
@app.route("/api/signup", methods=["POST"])
def signup():
    data = get_payload()

    username = data.get("username")
    email = normalize_email(data.get("email"))
    password = data.get("password")
    phone = data.get("phone")

    if not username or not email or not password or not phone:
        return jsonify({"message": "All fields required"}), 400

    if not is_password_strong(password):
        return jsonify({"message": "Weak password"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT user_id FROM users WHERE email=%s", (email,))
    if cur.fetchone():
        return jsonify({"message": "Email exists"}), 409

    hashed = generate_password_hash(password)

    cur.execute("""
        INSERT INTO users(username,email,phone,password)
        VALUES(%s,%s,%s,%s)
    """, (username, email, phone, hashed))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Signup successful"})

# SIGNIN
@app.route("/api/signin", methods=["POST"])
def signin():
    data = get_payload()

    email = normalize_email(data.get("email"))
    password = str(data.get("password", "")).strip()

    if not email or not password:
        return jsonify({"message": "Email & password required"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM users WHERE email=%s", (email,))
    user = cur.fetchone()

    if not user or not check_password_hash(user["password"], password):
        return jsonify({"message": "Invalid credentials"}), 401

    session["user"] = build_user(user)

    cur.close()
    conn.close()

    return jsonify({"message": "Login successful", "user": session["user"]})

# SESSION CHECK
@app.route("/api/auth/session", methods=["GET"])
def check_session():
    if "user" not in session:
        return jsonify({"message": "No session"}), 401

    return jsonify({"user": session["user"]})

# SIGNOUT
@app.route("/api/signout", methods=["POST"])
def signout():
    session.pop("user", None)
    return jsonify({"message": "Logged out"})