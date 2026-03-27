
from flask import Flask, request, jsonify, session
from datetime import timedelta, datetime, date
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

    cur.execute("""
    CREATE TABLE IF NOT EXISTS event_bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(160),
        email VARCHAR(160),
        phone VARCHAR(30),
        event_type VARCHAR(120),
        event_date DATE,
        guests INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    cur.close()
    conn.close()

create_tables()

def get_food_items_column():
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("SHOW COLUMNS FROM food_orders LIKE 'items'")
        has_items = cur.fetchone()

        if has_items:
            return "items"

        cur.execute("SHOW COLUMNS FROM food_orders LIKE 'items_json'")
        has_items_json = cur.fetchone()

        if has_items_json:
            return "items_json"

        return "items"
    finally:
        cur.close()
        conn.close()

def serialize_value(value):
    if isinstance(value, timedelta):
        total_seconds = int(value.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")

    return value

def serialize_rows(rows):
    return [
        {key: serialize_value(value) for key, value in row.items()}
        for row in rows
    ]

@app.route("/api/debug/version", methods=["GET"])
def debug_version():
    return jsonify({
        "app": "elitehotel-backend",
        "version": "2026-03-27-admin-overview-v1",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })

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

    #=========================================

@app.route("/api/admin/foods", methods=["GET"])
def get_foods():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM foods")
    data = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(data)

@app.route("/api/admin/foods", methods=["POST"])
def add_food():
    data = request.get_json()
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO foods(name, price, image)
        VALUES (%s,%s,%s)
    """, (data["name"], data["price"], data["image"]))

    conn.commit()
    cur.close(); conn.close()
    return jsonify({"message": "Food added"})
#=============================
@app.route("/api/admin/rooms", methods=["GET"])
def get_rooms():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM rooms")
    data = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(data)

@app.route("/api/admin/rooms", methods=["POST"])
def add_room():
    data = request.get_json()
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO rooms(name, price)
        VALUES (%s,%s)
    """, (data["name"], data["price"]))

    conn.commit()
    cur.close(); conn.close()
    return jsonify({"message": "Room added"})
#=============================================
@app.route("/api/admin/bookings", methods=["GET"])
def get_bookings():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM room_bookings")
    rooms = cur.fetchall()

    cur.execute("SELECT * FROM food_orders")
    foods = cur.fetchall()

    cur.close(); conn.close()

    return jsonify({
        "room_bookings": rooms,
        "food_orders": foods
    })
#====================================
@app.route("/api/admin/users", methods=["GET"])
def get_users():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT user_id, username, email, phone FROM users")
    users = cur.fetchall()

    cur.close(); conn.close()
    return jsonify(users)

@app.route("/api/admin/overview", methods=["GET"])
def admin_overview():
    conn = get_connection()
    cur = conn.cursor()
    food_items_column = get_food_items_column()

    cur.execute("""
        SELECT user_id, username, email, phone
        FROM users
        ORDER BY user_id DESC
    """)
    users = cur.fetchall()

    cur.execute(f"""
        SELECT id, order_title, preferred_date, preferred_time, total_amount, phone, {food_items_column} AS items, created_at
        FROM food_orders
        ORDER BY created_at DESC
    """)
    food_orders = cur.fetchall()

    cur.execute("""
        SELECT id, name, email, phone, event_type, event_date, guests, created_at
        FROM event_bookings
        ORDER BY created_at DESC
    """)
    event_bookings = cur.fetchall()

    cur.execute("""
        SELECT id, room_name, check_in, check_out, amount, payment_phone, created_at
        FROM room_bookings
        ORDER BY created_at DESC
    """)
    room_bookings = cur.fetchall()

    cur.close(); conn.close()

    return jsonify({
        "users": serialize_rows(users),
        "food_orders": serialize_rows(food_orders),
        "event_bookings": serialize_rows(event_bookings),
        "room_bookings": serialize_rows(room_bookings)
    })
#===========================
@app.route("/api/admin/payments", methods=["GET"])
def get_payments():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM payments")
    data = cur.fetchall()

    cur.close(); conn.close()
    return jsonify(data)
#=================================

#-----------Admin pro---------------

@app.route("/api/admin/check", methods=["GET"])
def admin_check():
    user = session.get("user")

    if not user or not user.get("is_admin"):
        return jsonify({"message": "Unauthorized"}), 403

    return jsonify({"message": "Welcome admin"})
# ---------------- FOOD ORDER ----------------
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
        food_items_column = get_food_items_column()

        conn = get_connection()
        cur = conn.cursor()

        cur.execute(f"""
            INSERT INTO food_orders
            (order_title, preferred_date, preferred_time, total_amount, phone, {food_items_column})
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
            data.get("payment_phone") or data.get("phone") or "0700000000"
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
# ---------------- M-PESA ----------------
# ---------------- M-PESA (SANDBOX) ----------------
CONSUMER_KEY = "2d4bHfA7WhY123XfrBAZt7KAjksXAfApUGS2AseRAlJkG9k2"
CONSUMER_SECRET = "ShRXc0X80vbBMEeWIjoAu4iQ16hdAcvXppsGJq7dOkgzOUu9O4s5WjhYyJaRvaIk"
SHORTCODE = "174379"
PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
CALLBACK_URL = "https://calebtonny.alwaysdata.net/api/callback"


# ---------------- FORMAT PHONE ----------------
def format_phone(phone):
    phone = str(phone).strip()

    if phone.startswith("+"):
        phone = phone[1:]

    if phone.startswith("0"):
        phone = "254" + phone[1:]

    if not phone.startswith("254"):
        raise ValueError("Invalid phone format. Use 07XXXXXXXX")

    return phone


# ---------------- GET ACCESS TOKEN ----------------
def get_access_token():
    url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"

    res = requests.get(url, auth=(CONSUMER_KEY, CONSUMER_SECRET))

    print("TOKEN STATUS:", res.status_code)
    print("TOKEN BODY:", res.text)

    if res.status_code != 200:
        raise Exception("Failed to get access token")

    token = res.json().get("access_token")

    if not token:
        raise Exception("No access token received")

    return token


# ---------------- STK PUSH ----------------
@app.route("/api/mpesa_payment", methods=["POST", "OPTIONS"])
def mpesa():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    try:
        data = request.get_json() or {}

        phone = format_phone(data.get("phone"))
        amount = int(data.get("amount"))

        print("PHONE:", phone)
        print("AMOUNT:", amount)

        # ⚠️ SANDBOX ONLY NUMBER
        if phone != "254708374149":
            return jsonify({
                "error": "Use sandbox number 254708374149 for testing"
            }), 400

        token = get_access_token()

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(
            (SHORTCODE + PASSKEY + timestamp).encode()
        ).decode()

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
            "AccountReference": "SokoGarden",
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

        print("STK STATUS:", res.status_code)
        print("STK BODY:", res.text)

        response_data = res.json()

        if response_data.get("ResponseCode") == "0":
            return jsonify({
                "success": True,
                "message": "STK push sent ✅",
                "data": response_data
            })
        else:
            return jsonify({
                "success": False,
                "error": response_data
            }), 400

    except Exception as e:
        import traceback
        print("MPESA ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ---------------- CALLBACK ----------------
@app.route("/api/callback", methods=["POST"])
def callback():
    data = request.get_json()
    print("CALLBACK RECEIVED:", data)
    return jsonify({"status": "ok"})
