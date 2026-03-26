import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { buildApiUrl } from '../utils/api';

const Admin = () => {
  const [foods, setFoods] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const foodRes = await axios.get(buildApiUrl('/api/admin/foods'));
      const roomRes = await axios.get(buildApiUrl('/api/admin/rooms'));
      const bookingRes = await axios.get(buildApiUrl('/api/admin/bookings'));
      const userRes = await axios.get(buildApiUrl('/api/admin/users'));

      setFoods(foodRes.data);
      setRooms(roomRes.data);
      setBookings(bookingRes.data.room_bookings);
      setUsers(userRes.data);

    } catch (err) {
      console.error("ADMIN LOAD ERROR:", err);
    }
  };

  // ---------------- ACTIONS ----------------
  const addFood = async () => {
    await axios.post(buildApiUrl('/api/admin/foods'), {
      name: "New Food",
      price: 1000,
      image: ""
    });
    loadData();
  };

  const deleteFood = async (id) => {
    await axios.delete(buildApiUrl(`/api/admin/foods/${id}`));
    loadData();
  };

  const addRoom = async () => {
    await axios.post(buildApiUrl('/api/admin/rooms'), {
      name: "New Room",
      price: 5000
    });
    loadData();
  };

  const deleteRoom = async (id) => {
    await axios.delete(buildApiUrl(`/api/admin/rooms/${id}`));
    loadData();
  };

  // ---------------- UI ----------------
  return (
    <div className="admin-container">

      {/* SIDEBAR */}
      <div className="sidebar">
        <h2>Admin</h2>
        <button onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button onClick={() => setActiveTab('foods')}>Food</button>
        <button onClick={() => setActiveTab('rooms')}>Rooms</button>
        <button onClick={() => setActiveTab('bookings')}>Bookings</button>
        <button onClick={() => setActiveTab('users')}>Users</button>
      </div>

      {/* MAIN */}
      <div className="main">

        {activeTab === 'dashboard' && (
          <div className="fade-in">
            <h1>Dashboard</h1>
            <div className="cards">
              <div className="card">🍔 Foods: {foods.length}</div>
              <div className="card">🏨 Rooms: {rooms.length}</div>
              <div className="card">📦 Bookings: {bookings.length}</div>
              <div className="card">👤 Users: {users.length}</div>
            </div>
          </div>
        )}

        {activeTab === 'foods' && (
          <div className="fade-in">
            <h2>Food Management</h2>
            <button className="btn" onClick={addFood}>+ Add Food</button>

            {foods.map(f => (
              <div className="list-item" key={f.id}>
                {f.name} - Ksh {f.price}
                <button onClick={() => deleteFood(f.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'rooms' && (
          <div className="fade-in">
            <h2>Room Management</h2>
            <button className="btn" onClick={addRoom}>+ Add Room</button>

            {rooms.map(r => (
              <div className="list-item" key={r.id}>
                {r.name} - Ksh {r.price}
                <button onClick={() => deleteRoom(r.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="fade-in">
            <h2>Bookings</h2>
            {bookings.map(b => (
              <div className="list-item" key={b.id}>
                {b.room_name} | {b.check_in} → {b.check_out}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="fade-in">
            <h2>Users</h2>
            {users.map(u => (
              <div className="list-item" key={u.user_id}>
                {u.username} - {u.email}
              </div>
            ))}
          </div>
        )}

      </div>

      {/* STYLES */}
      <style>{`
        .admin-container {
          display: flex;
          height: 100vh;
          font-family: Arial;
        }

        .sidebar {
          width: 220px;
          background: #111;
          color: white;
          padding: 20px;
          display: flex;
          flex-direction: column;
        }

        .sidebar button {
          margin: 10px 0;
          padding: 10px;
          border: none;
          background: #222;
          color: white;
          cursor: pointer;
          transition: 0.3s;
        }

        .sidebar button:hover {
          background: #444;
        }

        .main {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 20px;
        }

        .card {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          font-weight: bold;
          transition: transform 0.3s;
        }

        .card:hover {
          transform: scale(1.05);
        }

        .btn {
          margin: 10px 0;
          padding: 10px 15px;
          background: #007bff;
          color: white;
          border: none;
          cursor: pointer;
          border-radius: 5px;
        }

        .list-item {
          background: #fafafa;
          margin: 10px 0;
          padding: 10px;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .fade-in {
          animation: fadeIn 0.5s ease-in;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

    </div>
  );
};

export default Admin;