from flask import Flask, request, jsonify, session
from datetime import timedelta, datetime
from flask_cors import CORS
import pymysql
from werkzeug.security import generate_password_hash, check_password_hash
import requests
import base64
import json

# ---------------- APP SETUP ----------------
app = Flask(__name__)

app.config["SECRET_KEY"] = "super-secret-key"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)

# ✅ Cookies (only works on HTTPS)
app.config["SESSION_COOKIE_SAMESITE"] = "None"
app.config["SESSION_COOKIE_SECURE"] = True

# ✅ CORS
CORS(app, supports_credentials=True, origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000"
])

@app.after_request
def handle_options(response):
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    return response

# ---------------- DATABASE ----------------
DB_HOST = "mysql-calebtonny.alwaysdata.net"
DB_USER = "calebtonny"
DB_PASSWORD = "modcom1234"
DB_NAME = "calebtonny_sokogarden"

def get_connection():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor,
    )

# ---------------- TABLES ----------------
def create_tables():
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

    cur.execute("""
    CREATE TABLE IF NOT EXISTS room_bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        room_name VARCHAR(255),
        check_in DATE,
        check_out DATE,
        amount INT,
        payment_phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS food_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_title VARCHAR(255),
        preferred_date DATE,
        preferred_time VARCHAR(20),
        total_amount INT,
        phone VARCHAR(20),
        items JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    cur.close()
    conn.close()

create_tables()

# ---------------- AUTH ----------------
# ---------------- SIGNUP ----------------
@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json()

    email = data["email"].lower().strip()
    password = data["password"].strip()

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT user_id FROM users WHERE email=%s", (email,))
    if cur.fetchone():
        return jsonify({"message": "Email exists"}), 409

    # ❌ NO HASHING (TEMP ONLY)
    cur.execute("""
        INSERT INTO users(username,email,phone,password)
        VALUES(%s,%s,%s,%s)
    """, (
        data["username"],
        email,
        data["phone"],
        password   # 👈 plain password
    ))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Signup successful"})


# ---------------- SIGNIN ----------------
@app.route("/api/signin", methods=["POST"])
def signin():
    data = request.get_json()

    email = data["email"].lower().strip()
    password = data["password"].strip()

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM users WHERE email=%s", (email,))
    user = cur.fetchone()

    # ❌ PLAIN TEXT CHECK
    if not user or user["password"] != password:
        return jsonify({"message": "Invalid credentials"}), 401

    session["user"] = user

    return jsonify({"message": "Login successful", "user": user})
# ---------------- ROOM BOOKING ----------------
@app.route("/api/room_bookings", methods=["POST", "OPTIONS"])
def room_booking():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json()

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO room_bookings 
            (user_id, room_name, check_in, check_out, amount, payment_phone)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            session.get("user", {}).get("user_id"),
            data.get("room_name"),
            data.get("check_in"),
            data.get("check_out"),
            data.get("amount"),
            data.get("payment_phone")
        ))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Room booking saved ✅"})

    except Exception as e:
        print("ROOM ERROR:", str(e))
        return jsonify({"error": str(e)}), 500

# ---------------- FOOD ORDER ----
import json
@app.route("/api/food_orders", methods=["POST", "OPTIONS"])
def food_order():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json() or {}

        # ✅ Ensure items is valid JSON (list or dict)
        items = data.get("items")

        if not isinstance(items, (list, dict)):
            items = []

        items_json = json.dumps(items)

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO food_orders
            (order_title, preferred_date, preferred_time, total_amount, phone, items_json)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            data.get("order_title"),
            data.get("preferred_date"),
            data.get("preferred_time"),
            data.get("total_amount"),
            data.get("payment_phone"),
            items_json
        ))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Food order saved ✅"})

    except Exception as e:
        print("FOOD ERROR:", str(e))
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/event_bookings", methods=["POST", "OPTIONS"])
def event_booking():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json() or {}

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO event_bookings
            (name, email, phone, event_type, event_date, guests)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            data.get("name"),
            data.get("email"),
            data.get("phone"),
            data.get("event_type"),
            data.get("event_date"),
            data.get("guests"),

        ))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Event booking saved ✅"})

    except Exception as e:
        print("EVENT ERROR:", str(e))
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/stay_bookings", methods=["POST", "OPTIONS"])
def stay_booking():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json() or {}

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO room_bookings
            (user_id, room_name, check_in, check_out, amount, payment_phone)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            session.get("user", {}).get("user_id"),
            data.get("room_name"),
            data.get("check_in"),
            data.get("check_out"),
            data.get("amount"),
            data.get("phone")
        ))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Stay booking saved ✅"})

    except Exception as e:
        import traceback
        print("STAY BOOKING ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ---------------- M-PESA ----------------
CONSUMER_KEY = "2d4bHfA7WhY123XfrBAZt7KAjksXAfApUGS2AseRAlJkG9k2"
CONSUMER_SECRET = "ShRXc0X80vbBMEeWIjoAu4iQ16hdAcvXppsGJq7dOkgzOUu9O4s5WjhYyJaRvaIk"
SHORTCODE = "174379"
PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
CALLBACK_URL = "https://calebtonny.alwaysdata.net/api/callback"

def get_access_token():
    url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    res = requests.get(url, auth=(CONSUMER_KEY, CONSUMER_SECRET))

    print("TOKEN:", res.status_code, res.text)

    if res.status_code != 200:
        return None

    return res.json().get("access_token")

@app.route("/api/mpesa_payment", methods=["POST", "OPTIONS"])
def mpesa():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json()

        phone = str(data.get("phone"))
        amount = int(data.get("amount"))

        if phone.startswith("0"):
            phone = "254" + phone[1:]

        token = get_access_token()
        if not token:
            return jsonify({"error": "Token failed"}), 500

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode((SHORTCODE + PASSKEY + timestamp).encode()).decode()

        payload = {
            "BusinessShortCode": SHORTCODE,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount,
            "PartyA": phone,
            "PartyB": SHORTCODE,
            "PhoneNumber": phone,
            "CallBackURL": CALLBACK_URL,
            "AccountReference": "Hotel",
            "TransactionDesc": "Payment"
        }

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        res = requests.post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers=headers
        )

        print("MPESA:", res.text)

        return jsonify(res.json())

    except Exception as e:
        print("MPESA ERROR:", str(e))
        return jsonify({"error": str(e)}), 500

# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(debug=True)