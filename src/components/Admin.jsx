import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  getManagedDiningCatalog,
  getManagedRooms,
  saveManagedDiningCatalog,
  saveManagedRooms,
} from '../utils/adminCatalog';
import { getStoredRoomBookings } from '../utils/roomBookingStorage';
import { buildApiUrl } from '../utils/api';
import {
  clearAdminSession,
  getAdminSession,
  isAdminAuthenticated,
} from '../utils/adminSession';

const defaultRoomForm = {
  name: '',
  price: '',
  image: '',
  description: '',
};

const defaultDishForm = {
  title: '',
  price: '',
  image: '',
  tag: '',
  description: '',
};

const formatCurrency = (value) => {
  const numericValue = Number(String(value).replace(/[^0-9]/g, '')) || 0;
  return `KSh ${numericValue.toLocaleString()}`;
};

const Admin = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [catalog, setCatalog] = useState({ categories: [], featuredPlates: [] });
  const [localBookings, setLocalBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [foodOrders, setFoodOrders] = useState([]);
  const [eventBookings, setEventBookings] = useState([]);
  const [roomBookings, setRoomBookings] = useState([]);
  const [backendVersion, setBackendVersion] = useState(null);
  const [roomForm, setRoomForm] = useState(defaultRoomForm);
  const [dishForm, setDishForm] = useState(defaultDishForm);
  const [status, setStatus] = useState('');
  const [remoteDataError, setRemoteDataError] = useState('');
  const [adminSession, setAdminSessionState] = useState(getAdminSession());

  const refreshData = async () => {
    setRooms(getManagedRooms());
    setCatalog(getManagedDiningCatalog());
    setLocalBookings(getStoredRoomBookings());
    setAdminSessionState(getAdminSession());

    try {
      const versionResponse = await axios.get(buildApiUrl('/api/debug/version'), {
        withCredentials: true,
      });
      setBackendVersion(versionResponse.data);
    } catch (error) {
      setBackendVersion(null);
    }

    try {
      const response = await axios.get(buildApiUrl('/api/admin/overview'), {
        withCredentials: true,
      });

      setUsers(response.data.users || []);
      setFoodOrders(response.data.food_orders || []);
      setEventBookings(response.data.event_bookings || []);
      setRoomBookings(response.data.room_bookings || []);
      setRemoteDataError('');
    } catch (error) {
      setUsers([]);
      setFoodOrders([]);
      setEventBookings([]);
      setRoomBookings([]);
      if (error.response?.status === 404) {
        setRemoteDataError(
          'The live server does not have /api/admin/overview yet. Restart or redeploy the Flask backend, then refresh this page. Check /api/debug/version too.'
        );
      } else if (error.response?.status >= 500) {
        setRemoteDataError(
          error.response?.data?.error ||
            'The admin API returned a server error. Check the Flask logs, then restart the backend and refresh this page.'
        );
      } else {
        setRemoteDataError(
          error.response?.data?.error ||
            'Admin server data is currently unavailable. Local room and dining controls still work.'
        );
      }
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const stats = useMemo(() => {
    const totalDiningItems = catalog.categories.reduce(
      (sum, category) => sum + category.items.length,
      0
    );

    return [
      {
        label: 'Rooms',
        value: rooms.length,
        note: 'Visible across the Rooms pages',
        tone: 'amber',
      },
      {
        label: 'Users',
        value: users.length,
        note: 'Registered guest accounts',
        tone: 'teal',
      },
      {
        label: 'Food Orders',
        value: foodOrders.length,
        note: 'Orders saved from checkout',
        tone: 'blue',
      },
      {
        label: 'Event Bookings',
        value: eventBookings.length,
        note: 'Event inquiries received',
        tone: 'rose',
      },
      {
        label: 'Room Bookings',
        value: roomBookings.length,
        note: 'Database stay records',
        tone: 'slate',
      },
      {
        label: 'Menu Items',
        value: totalDiningItems,
        note: 'Local dining catalog entries',
        tone: 'olive',
      },
    ];
  }, [catalog.categories, eventBookings.length, foodOrders.length, roomBookings.length, rooms.length, users.length]);

  if (!isAdminAuthenticated()) {
    return <Navigate to="/signin" replace />;
  }

  const handleRoomFormChange = (event) => {
    const { name, value } = event.target;
    setRoomForm((current) => ({ ...current, [name]: value }));
  };

  const handleDishFormChange = (event) => {
    const { name, value } = event.target;
    setDishForm((current) => ({ ...current, [name]: value }));
  };

  const handleAddRoom = async (event) => {
    event.preventDefault();

    const newRoom = {
      name: roomForm.name.trim(),
      price: formatCurrency(roomForm.price),
      image:
        roomForm.image.trim() ||
        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      description: roomForm.description.trim(),
      overview:
        roomForm.description.trim() ||
        'A newly added room ready to be customized from the admin panel.',
      guests: '2 Guests',
      size: '40 m2',
      bed: '1 King Bed',
      idealFor: 'Premium hotel stays',
      features: ['Free Wi-Fi', 'Breakfast', 'Room Service', 'Air Conditioning'],
    };

    const updatedRooms = [newRoom, ...rooms];
    await saveManagedRooms(updatedRooms);
    setRooms(updatedRooms);
    setRoomForm(defaultRoomForm);
    setStatus(`Added room: ${newRoom.name}`);
  };

  const handleDeleteRoom = async (roomName) => {
    const updatedRooms = rooms.filter((room) => room.name !== roomName);
    await saveManagedRooms(updatedRooms);
    setRooms(updatedRooms);
    setStatus(`Removed room: ${roomName}`);
  };

  const handleAddFeaturedDish = async (event) => {
    event.preventDefault();

    const newFeaturedDish = {
      title: dishForm.title.trim(),
      price: formatCurrency(dishForm.price),
      image:
        dishForm.image.trim() ||
        'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1200&q=80',
      tag: dishForm.tag.trim() || 'Chef Pick',
      description:
        dishForm.description.trim() ||
        'A newly added signature plate prepared for the EliteHotels dining experience.',
    };

    const updatedCatalog = {
      ...catalog,
      featuredPlates: [newFeaturedDish, ...catalog.featuredPlates],
    };

    await saveManagedDiningCatalog(updatedCatalog);
    setCatalog(updatedCatalog);
    setDishForm(defaultDishForm);
    setStatus(`Added featured dish: ${newFeaturedDish.title}`);
  };

  const handleDeleteFeaturedDish = async (title) => {
    const updatedCatalog = {
      ...catalog,
      featuredPlates: catalog.featuredPlates.filter((plate) => plate.title !== title),
    };

    await saveManagedDiningCatalog(updatedCatalog);
    setCatalog(updatedCatalog);
    setStatus(`Removed featured dish: ${title}`);
  };

  const handleLogout = () => {
    clearAdminSession();
    navigate('/signin', { replace: true });
  };

  return (
    <section className="admin-shell">
      <div className="admin-shell__hero">
        <div>
          <p className="admin-shell__eyebrow">EliteHotels Admin Panel</p>
          <h1>Manage rooms, dining, users, bookings, and orders from one dashboard.</h1>
          <p>
            This panel now shows live admin data for users, food orders, event bookings,
            and room bookings while still letting you manage the local website catalog.
          </p>
        </div>

        <div className="admin-shell__hero-meta">
          <span>{adminSession?.name || 'Admin'}</span>
          <span>{adminSession?.email || 'Signed in'}</span>
          <span>{new Date().toLocaleDateString()}</span>
          <span>{backendVersion?.version || 'Backend version unavailable'}</span>
        </div>
      </div>

      <div className="admin-shell__stack">
        <div
          className={`admin-session-banner ${
            adminSession ? 'admin-session-banner--active' : 'admin-session-banner--inactive'
          }`}
        >
          <div>
            <span className="admin-session-banner__label">Access Status</span>
            <strong>{adminSession ? 'Authenticated admin session' : 'Session unavailable'}</strong>
            <p>
              Sign in with <strong>caleb@gmail.com</strong> and <strong>Caleb123</strong> to
              open this panel directly.
            </p>
          </div>

          <div className="admin-session-banner__meta">
            <span>Users: {users.length}</span>
            <span>Food orders: {foodOrders.length}</span>
            <span>Event bookings: {eventBookings.length}</span>
          </div>
        </div>

        {status && <div className="auth-alert auth-alert--success">{status}</div>}
        {remoteDataError && <div className="auth-alert auth-alert--error">{remoteDataError}</div>}
        {backendVersion && (
          <div className="auth-alert auth-alert--info">
            Live backend version: {backendVersion.version}
          </div>
        )}

        <div className="admin-board">
          <div className="admin-board__hero">
            <div>
              <p className="admin-board__eyebrow">Overview</p>
              <h2>Content and operations summary</h2>
              <p>Refresh to sync the latest database records and local catalog changes.</p>
            </div>

            <div className="admin-actions">
              <button type="button" className="admin-board__refresh" onClick={refreshData}>
                Refresh Data
              </button>
              <button
                type="button"
                className="admin-board__refresh admin-board__refresh--ghost"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          </div>

          <div className="admin-stats-grid">
            {stats.map((item) => (
              <article className={`admin-stat-card admin-stat-card--${item.tone}`} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.note}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="admin-shell__tools">
          <div className="admin-shell__tools-main">
            <div className="admin-board__grid">
              <article className="admin-data-card">
                <div className="admin-data-card__header">
                  <p>Room Catalog</p>
                  <h3>Add a room shown on the Rooms page</h3>
                </div>

                <form className="admin-form-grid" onSubmit={handleAddRoom}>
                  <input
                    className="admin-input"
                    name="name"
                    placeholder="Room name"
                    value={roomForm.name}
                    onChange={handleRoomFormChange}
                    required
                  />
                  <input
                    className="admin-input"
                    name="price"
                    placeholder="Price e.g. 18500"
                    value={roomForm.price}
                    onChange={handleRoomFormChange}
                    required
                  />
                  <input
                    className="admin-input admin-input--wide"
                    name="image"
                    placeholder="Image URL"
                    value={roomForm.image}
                    onChange={handleRoomFormChange}
                  />
                  <textarea
                    className="admin-input admin-input--wide admin-textarea"
                    name="description"
                    placeholder="Short room description"
                    value={roomForm.description}
                    onChange={handleRoomFormChange}
                    required
                  />
                  <button type="submit" className="admin-button">
                    Add Room
                  </button>
                </form>
              </article>

              <article className="admin-data-card">
                <div className="admin-data-card__header">
                  <p>Dining Highlights</p>
                  <h3>Add a featured plate shown on the dining experience</h3>
                </div>

                <form className="admin-form-grid" onSubmit={handleAddFeaturedDish}>
                  <input
                    className="admin-input"
                    name="title"
                    placeholder="Dish title"
                    value={dishForm.title}
                    onChange={handleDishFormChange}
                    required
                  />
                  <input
                    className="admin-input"
                    name="price"
                    placeholder="Price e.g. 2450"
                    value={dishForm.price}
                    onChange={handleDishFormChange}
                    required
                  />
                  <input
                    className="admin-input"
                    name="tag"
                    placeholder="Tag e.g. Chef Pick"
                    value={dishForm.tag}
                    onChange={handleDishFormChange}
                  />
                  <input
                    className="admin-input admin-input--wide"
                    name="image"
                    placeholder="Image URL"
                    value={dishForm.image}
                    onChange={handleDishFormChange}
                  />
                  <textarea
                    className="admin-input admin-input--wide admin-textarea"
                    name="description"
                    placeholder="Featured dish description"
                    value={dishForm.description}
                    onChange={handleDishFormChange}
                    required
                  />
                  <button type="submit" className="admin-button">
                    Add Featured Dish
                  </button>
                </form>
              </article>

              <article className="admin-data-card">
                <div className="admin-data-card__header">
                  <p>Registered Users</p>
                  <h3>Guest accounts from the backend</h3>
                </div>

                {users.length === 0 ? (
                  <p className="admin-data-card__empty">No user accounts found yet.</p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.user_id}>
                            <td>{user.username || 'Guest'}</td>
                            <td>{user.email}</td>
                            <td>{user.phone || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="admin-data-card">
                <div className="admin-data-card__header">
                  <p>Food Orders</p>
                  <h3>Recent dining checkouts</h3>
                </div>

                {foodOrders.length === 0 ? (
                  <p className="admin-data-card__empty">No food orders found yet.</p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>When</th>
                          <th>Phone</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {foodOrders.map((order) => (
                          <tr key={order.id}>
                            <td>{order.order_title}</td>
                            <td>{order.preferred_date} {order.preferred_time}</td>
                            <td>{order.phone || '-'}</td>
                            <td>KSh {Number(order.total_amount || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="admin-data-card">
                <div className="admin-data-card__header">
                  <p>Event Bookings</p>
                  <h3>Submitted event inquiries</h3>
                </div>

                {eventBookings.length === 0 ? (
                  <p className="admin-data-card__empty">No event bookings found yet.</p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Guest</th>
                          <th>Event Type</th>
                          <th>Date</th>
                          <th>Guests</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventBookings.map((eventItem) => (
                          <tr key={eventItem.id}>
                            <td>{eventItem.name}</td>
                            <td>{eventItem.event_type}</td>
                            <td>{eventItem.event_date}</td>
                            <td>{eventItem.guests}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="admin-data-card">
                <div className="admin-data-card__header">
                  <p>Saved Rooms</p>
                  <h3>Current room catalog</h3>
                </div>

                {rooms.length === 0 ? (
                  <p className="admin-data-card__empty">No rooms available yet.</p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Room</th>
                          <th>Price</th>
                          <th>Guests</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rooms.map((room) => (
                          <tr key={room.name}>
                            <td>{room.name}</td>
                            <td>{room.price}</td>
                            <td>{room.guests}</td>
                            <td>
                              <button
                                type="button"
                                className="admin-table__button"
                                onClick={() => handleDeleteRoom(room.name)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="admin-data-card">
                <div className="admin-data-card__header">
                  <p>Featured Dishes</p>
                  <h3>Current dining highlights</h3>
                </div>

                {catalog.featuredPlates.length === 0 ? (
                  <p className="admin-data-card__empty">No featured dishes available yet.</p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Dish</th>
                          <th>Tag</th>
                          <th>Price</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catalog.featuredPlates.map((plate) => (
                          <tr key={plate.title}>
                            <td>{plate.title}</td>
                            <td>{plate.tag}</td>
                            <td>{plate.price}</td>
                            <td>
                              <button
                                type="button"
                                className="admin-table__button"
                                onClick={() => handleDeleteFeaturedDish(plate.title)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </div>
          </div>

          <aside className="admin-shell__tools-side">
            <div className="admin-board">
              <article className="admin-data-card">
                <div className="admin-data-card__header">
                  <p>Latest Room Bookings</p>
                  <h3>Database stay records</h3>
                </div>

                {roomBookings.length === 0 ? (
                  <p className="admin-data-card__empty">
                    No room bookings found in the backend yet.
                  </p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Room</th>
                          <th>Stay</th>
                          <th>Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roomBookings.slice(0, 8).map((booking) => (
                          <tr key={booking.id}>
                            <td>{booking.room_name}</td>
                            <td>{booking.check_in} to {booking.check_out}</td>
                            <td>{booking.payment_phone || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="admin-data-card">
                <div className="admin-data-card__header">
                  <p>Local Booking Cache</p>
                  <h3>Payments captured inside this browser</h3>
                </div>

                {localBookings.length === 0 ? (
                  <p className="admin-data-card__empty">
                    No saved local bookings yet. Completed room payments will appear here.
                  </p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Guest</th>
                          <th>Room</th>
                          <th>Stay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {localBookings.slice(0, 8).map((booking, index) => (
                          <tr key={`${booking.roomName}-${booking.checkIn}-${index}`}>
                            <td>{booking.customerName || 'Guest'}</td>
                            <td>{booking.roomName}</td>
                            <td>{booking.checkIn} to {booking.checkOut}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="admin-data-card">
                <div className="admin-data-card__header">
                  <p>Website Shortcuts</p>
                  <h3>Quick navigation</h3>
                </div>

                <div className="admin-link-list">
                  <Link to="/rooms" className="admin-link-pill">Open Rooms Page</Link>
                  <Link to="/dining" className="admin-link-pill">Open Dining Page</Link>
                  <Link to="/bookings" className="admin-link-pill">Open Booking Flow</Link>
                  <Link to="/events" className="admin-link-pill">Open Events Page</Link>
                  <Link to="/" className="admin-link-pill">Return to Homepage</Link>
                </div>
              </article>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default Admin;
