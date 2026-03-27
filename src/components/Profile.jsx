import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { buildApiUrl } from '../utils/api';

const formatCurrency = (value) => `KSh ${Number(value || 0).toLocaleString()}`;

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileData, setProfileData] = useState({
    user: null,
    food_orders: [],
    event_bookings: [],
    room_bookings: [],
  });
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await axios.get(buildApiUrl('/api/profile/overview'), {
          withCredentials: true,
        });

        if (active) {
          setProfileData({
            user: response.data.user || null,
            food_orders: response.data.food_orders || [],
            event_bookings: response.data.event_bookings || [],
            room_bookings: response.data.room_bookings || [],
          });
          setUnauthorized(false);
        }
      } catch (requestError) {
        if (!active) {
          return;
        }

        if (requestError.response?.status === 401) {
          setUnauthorized(true);
          return;
        }

        setError(requestError.response?.data?.message || 'Unable to load your profile right now.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(
    () => [
      { label: 'Food Orders', value: profileData.food_orders.length },
      { label: 'Room Bookings', value: profileData.room_bookings.length },
      { label: 'Event Requests', value: profileData.event_bookings.length },
    ],
    [profileData.event_bookings.length, profileData.food_orders.length, profileData.room_bookings.length]
  );

  if (unauthorized) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <section className="profile-shell">
      <div className="profile-shell__hero">
        <div>
          <p className="profile-shell__eyebrow">Guest Profile</p>
          <h1>Track your hotel activity and stay updated on every order and booking.</h1>
          <p>
            Review your dining orders, room bookings, and event requests from one personal dashboard.
          </p>
        </div>

        <div className="profile-shell__card">
          <strong>{profileData.user?.username || 'Guest'}</strong>
          <span>{profileData.user?.email || 'Signed in user'}</span>
          <span>{profileData.user?.phone || 'No phone saved'}</span>
        </div>
      </div>

      {loading && <div className="auth-alert auth-alert--info">Loading your profile...</div>}
      {error && <div className="auth-alert auth-alert--error">{error}</div>}

      <div className="profile-stats">
        {stats.map((item) => (
          <article className="profile-stat" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="profile-grid">
        <article className="profile-panel">
          <div className="profile-panel__header">
            <p>Food Orders</p>
            <h2>Your order statuses</h2>
          </div>

          {profileData.food_orders.length === 0 ? (
            <p className="admin-data-card__empty">No food orders found yet.</p>
          ) : (
            <div className="profile-list">
              {profileData.food_orders.map((order) => (
                <div className="profile-item" key={`food-${order.id}`}>
                  <div>
                    <strong>{order.order_title || 'Food Order'}</strong>
                    <span>{order.preferred_date} at {order.preferred_time}</span>
                  </div>
                  <div className="profile-item__meta">
                    <span className={`profile-status profile-status--${order.status || 'pending'}`}>
                      {order.status || 'pending'}
                    </span>
                    <span>{formatCurrency(order.total_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="profile-panel">
          <div className="profile-panel__header">
            <p>Room Bookings</p>
            <h2>Your reserved stays</h2>
          </div>

          {profileData.room_bookings.length === 0 ? (
            <p className="admin-data-card__empty">No room bookings found yet.</p>
          ) : (
            <div className="profile-list">
              {profileData.room_bookings.map((booking) => (
                <div className="profile-item" key={`room-${booking.id}`}>
                  <div>
                    <strong>{booking.room_name || 'Hotel Room'}</strong>
                    <span>{booking.check_in} to {booking.check_out}</span>
                  </div>
                  <div className="profile-item__meta">
                    <span className="profile-status profile-status--confirmed">confirmed</span>
                    <span>{formatCurrency(booking.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="profile-panel profile-panel--wide">
          <div className="profile-panel__header">
            <p>Event Requests</p>
            <h2>Your submitted inquiries</h2>
          </div>

          {profileData.event_bookings.length === 0 ? (
            <p className="admin-data-card__empty">No event requests found yet.</p>
          ) : (
            <div className="profile-list">
              {profileData.event_bookings.map((booking) => (
                <div className="profile-item" key={`event-${booking.id}`}>
                  <div>
                    <strong>{booking.event_type || 'Event Request'}</strong>
                    <span>{booking.event_date} for {booking.guests || 0} guests</span>
                  </div>
                  <div className="profile-item__meta">
                    <span className="profile-status profile-status--received">received</span>
                    <span>{booking.phone || booking.email || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <div className="profile-actions">
        <Link to="/rooms" className="admin-link-pill">Book Another Room</Link>
        <Link to="/dining" className="admin-link-pill">Order Food</Link>
        <Link to="/events" className="admin-link-pill">Request An Event</Link>
      </div>
    </section>
  );
};

export default Profile;
