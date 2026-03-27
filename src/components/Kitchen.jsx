import axios from 'axios';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { buildApiUrl } from '../utils/api';
import {
  clearAdminSession,
  getAdminSession,
  isKitchenAuthenticated,
} from '../utils/adminSession';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from '../utils/dashboardNotifications';

const formatCurrency = (value) => `KSh ${Number(value || 0).toLocaleString()}`;
const ALERT_DISPLAY_MS = 60000;
const FOOD_ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const Kitchen = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [session, setSession] = useState(getAdminSession());
  const [notificationPermission, setNotificationPermission] = useState(
    getBrowserNotificationPermission()
  );
  const [notificationMessage, setNotificationMessage] = useState('');
  const [statusUpdateOrderId, setStatusUpdateOrderId] = useState(null);
  const hasLoadedRef = useRef(false);
  const knownOrderIdsRef = useRef(new Set());

  const loadOrders = async ({ notify = true, silent = false } = {}) => {
    if (!silent) {
      setStatus('Loading kitchen orders...');
    }
    setError('');

    try {
      const response = await axios.get(buildApiUrl('/api/kitchen/orders'), {
        withCredentials: true,
      });
      const nextOrders = response.data.food_orders || [];
      const newOrders = nextOrders.filter((order) => !knownOrderIdsRef.current.has(order.id));

      setOrders(nextOrders);
      knownOrderIdsRef.current = new Set(nextOrders.map((order) => order.id));
      setStatus('');

      if (hasLoadedRef.current && notify && newOrders.length > 0) {
        const newestOrder = newOrders[0];
        const message =
          newOrders.length === 1
            ? `New kitchen order: ${newestOrder.order_title || 'Food Order'} for ${newestOrder.preferred_time || 'scheduled service'}.`
            : `${newOrders.length} new kitchen orders have been received.`;

        setNotificationMessage(message);
        showBrowserNotification('EliteHotels Kitchen Alert', message);
      }

      hasLoadedRef.current = true;
    } catch (requestError) {
      setOrders([]);
      setStatus('');
      setError(requestError.response?.data?.message || 'Unable to load kitchen orders.');
    }
  };

  useEffect(() => {
    setSession(getAdminSession());
    loadOrders({ notify: false });
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      setError((currentMessage) =>
        currentMessage || 'Live kitchen updates are not supported in this browser.'
      );
      return undefined;
    }

    const eventSource = new window.EventSource(buildApiUrl('/api/kitchen/stream'), {
      withCredentials: true,
    });

    eventSource.addEventListener('dashboard_update', () => {
      loadOrders({ notify: true, silent: true });
    });

    eventSource.onerror = () => {
      setError((currentMessage) =>
        currentMessage || 'Live kitchen updates are temporarily unavailable. Refresh to reconnect.'
      );
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (!notificationMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotificationMessage('');
    }, ALERT_DISPLAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notificationMessage]);

  const totalItems = useMemo(
    () =>
      orders.reduce(
        (sum, order) =>
          sum +
          (Array.isArray(order.items)
            ? order.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0)
            : 0),
        0
      ),
    [orders]
  );

  const handleLogout = async () => {
    try {
      await axios.post(
        buildApiUrl('/api/signout'),
        {},
        {
          withCredentials: true,
        }
      );
    } catch (requestError) {
      // Ignore sign-out request errors and still clear local session.
    }

    clearAdminSession();
    navigate('/signin', { replace: true });
  };

  const handleEnableNotifications = async () => {
    const permission = await requestBrowserNotificationPermission();
    setNotificationPermission(permission);
  };

  const handleOrderStatusChange = async (orderId, nextStatus) => {
    setStatusUpdateOrderId(orderId);
    setError('');

    try {
      await axios.put(
        buildApiUrl(`/api/food_orders/${orderId}/status`),
        { status: nextStatus },
        { withCredentials: true }
      );
      setStatus(`Updated order #${orderId} to ${nextStatus}.`);
      await loadOrders({ notify: false, silent: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update food order status.');
    } finally {
      setStatusUpdateOrderId(null);
    }
  };

  if (!isKitchenAuthenticated()) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <section className="kitchen-shell">
      <div className="kitchen-shell__hero">
        <div>
          <p className="kitchen-shell__eyebrow">EliteHotels Kitchen Panel</p>
          <h1>Receive food orders with schedule, quantity, and pickup details in one place.</h1>
          <p>
            The kitchen team can use this page to monitor incoming orders and prepare meals on time.
          </p>
        </div>

        <div className="kitchen-shell__meta">
          <span>{session?.name || 'Kitchen Staff'}</span>
          <span>{session?.email || 'Kitchen access'}</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </div>

      <div className="kitchen-toolbar">
        <div className="kitchen-stat">
          <span>Orders</span>
          <strong>{orders.length}</strong>
        </div>
        <div className="kitchen-stat">
          <span>Total Items</span>
          <strong>{totalItems}</strong>
        </div>
        <button
          type="button"
          className="admin-board__refresh"
          onClick={() => loadOrders({ notify: false })}
        >
          Refresh Orders
        </button>
        {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
          <button
            type="button"
            className="admin-board__refresh"
            onClick={handleEnableNotifications}
          >
            Enable Notifications
          </button>
        )}
        <button
          type="button"
          className="admin-board__refresh admin-board__refresh--ghost"
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </div>

      {status && <div className="auth-alert auth-alert--info">{status}</div>}
      {error && <div className="auth-alert auth-alert--error">{error}</div>}
      {notificationPermission === 'unsupported' && (
        <div className="auth-alert auth-alert--info">
          Browser notifications are not supported here, but the panel will still auto-refresh.
        </div>
      )}
      {notificationMessage && <div className="auth-alert auth-alert--success">{notificationMessage}</div>}

      {orders.length === 0 ? (
        <div className="kitchen-empty">
          <h2>No food orders yet.</h2>
          <p>New dining checkout orders will appear here automatically.</p>
          <Link to="/dining" className="admin-link-pill">
            Open Dining Page
          </Link>
        </div>
      ) : (
        <div className="kitchen-orders">
          {orders.map((order) => (
            <article className="kitchen-order-card" key={order.id}>
              <div className="kitchen-order-card__header">
                <div>
                  <p className="kitchen-order-card__label">Order #{order.id}</p>
                  <h2>{order.order_title || 'Food Order'}</h2>
                </div>
                <strong>{formatCurrency(order.total_amount)}</strong>
              </div>

              <div className="kitchen-order-card__meta">
                <span>Preferred date: {order.preferred_date || '-'}</span>
                <span>Preferred time: {order.preferred_time || '-'}</span>
                <span>Phone: {order.phone || '-'}</span>
                <span>Received: {order.created_at || '-'}</span>
              </div>

              <div className="kitchen-order-card__status">
                <span>Order Status</span>
                <select
                  className="admin-input"
                  value={order.status || 'pending'}
                  onChange={(event) => handleOrderStatusChange(order.id, event.target.value)}
                  disabled={statusUpdateOrderId === order.id}
                >
                  {FOOD_ORDER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="kitchen-order-card__items">
                {Array.isArray(order.items) && order.items.length > 0 ? (
                  order.items.map((item, index) => (
                    <div className="kitchen-order-item" key={`${order.id}-${item.item_name}-${index}`}>
                      <div>
                        <strong>{item.item_name || 'Menu item'}</strong>
                        <span>{item.category || 'Food Order'}</span>
                      </div>
                      <div className="kitchen-order-item__summary">
                        <span>Qty {Number(item.quantity) || 0}</span>
                        <span>{formatCurrency(item.line_total)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="admin-data-card__empty">This order has no item breakdown.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default Kitchen;
