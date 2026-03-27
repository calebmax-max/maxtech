import axios from 'axios';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from '../utils/dashboardNotifications';

const defaultRoomForm = {
  name: '',
  price: '',
  image: '',
  imageFile: '',
  imageFileName: '',
  description: '',
};

const defaultDishForm = {
  title: '',
  price: '',
  image: '',
  imageFile: '',
  imageFileName: '',
  tag: '',
  description: '',
};

const defaultMenuItemForm = {
  name: '',
  price: '',
  categoryTitle: '',
  categoryDescription: '',
  description: '',
  image: '',
  imageFile: '',
  imageFileName: '',
};

const formatCurrency = (value) => {
  const numericValue = Number(String(value).replace(/[^0-9]/g, '')) || 0;
  return `KSh ${numericValue.toLocaleString()}`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Unable to read selected image file.'));
    reader.readAsDataURL(file);
  });

const adminQuickLinks = [
  { label: 'Rooms', target: 'admin-room-catalog' },
  { label: 'Dining Highlights', target: 'admin-dining-highlights' },
  { label: 'Food Menu', target: 'admin-food-menu' },
  { label: 'All Foods', target: 'admin-all-foods' },
  { label: 'Users', target: 'admin-users' },
  { label: 'Orders', target: 'admin-food-orders' },
  { label: 'Bookings', target: 'admin-room-bookings' },
  { label: 'Shortcuts', target: 'admin-shortcuts' },
];

const ALERT_DISPLAY_MS = 60000;
const FOOD_ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

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
  const [menuItemForm, setMenuItemForm] = useState(defaultMenuItemForm);
  const [status, setStatus] = useState('');
  const [remoteDataError, setRemoteDataError] = useState('');
  const [adminSession, setAdminSessionState] = useState(getAdminSession());
  const [notificationPermission, setNotificationPermission] = useState(
    getBrowserNotificationPermission()
  );
  const [notificationMessage, setNotificationMessage] = useState('');
  const [statusUpdateOrderId, setStatusUpdateOrderId] = useState(null);
  const hasLoadedRef = useRef(false);
  const knownIdsRef = useRef({
    foodOrders: new Set(),
    eventBookings: new Set(),
    roomBookings: new Set(),
  });

  const refreshData = async ({ notify = true, silent = false } = {}) => {
    setRooms(getManagedRooms());
    setCatalog(getManagedDiningCatalog());
    setLocalBookings(getStoredRoomBookings());
    setAdminSessionState(getAdminSession());
    if (!silent) {
      setStatus('Refreshing admin data...');
    }

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

      const nextUsers = response.data.users || [];
      const nextFoodOrders = response.data.food_orders || [];
      const nextEventBookings = response.data.event_bookings || [];
      const nextRoomBookings = response.data.room_bookings || [];

      const newFoodOrders = nextFoodOrders.filter(
        (order) => !knownIdsRef.current.foodOrders.has(order.id)
      );
      const newEventBookings = nextEventBookings.filter(
        (booking) => !knownIdsRef.current.eventBookings.has(booking.id)
      );
      const newRoomBookings = nextRoomBookings.filter(
        (booking) => !knownIdsRef.current.roomBookings.has(booking.id)
      );

      setUsers(nextUsers);
      setFoodOrders(nextFoodOrders);
      setEventBookings(nextEventBookings);
      setRoomBookings(nextRoomBookings);
      knownIdsRef.current = {
        foodOrders: new Set(nextFoodOrders.map((order) => order.id)),
        eventBookings: new Set(nextEventBookings.map((booking) => booking.id)),
        roomBookings: new Set(nextRoomBookings.map((booking) => booking.id)),
      };
      setStatus('');
      setRemoteDataError('');

      if (hasLoadedRef.current && notify) {
        const parts = [];

        if (newFoodOrders.length > 0) {
          parts.push(
            newFoodOrders.length === 1
              ? `New food order: ${newFoodOrders[0].order_title || 'Food Order'}`
              : `${newFoodOrders.length} new food orders`
          );
        }

        if (newEventBookings.length > 0) {
          parts.push(
            newEventBookings.length === 1
              ? `New event booking: ${newEventBookings[0].event_type || 'Event'}`
              : `${newEventBookings.length} new event bookings`
          );
        }

        if (newRoomBookings.length > 0) {
          parts.push(
            newRoomBookings.length === 1
              ? `New room booking: ${newRoomBookings[0].room_name || 'Room'}`
              : `${newRoomBookings.length} new room bookings`
          );
        }

        if (parts.length > 0) {
          const message = parts.join(' | ');
          setNotificationMessage(message);
          showBrowserNotification('EliteHotels Admin Alert', message);
        }
      }

      hasLoadedRef.current = true;
    } catch (error) {
      setStatus('');
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
    refreshData({ notify: false });
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      setRemoteDataError((currentMessage) =>
        currentMessage || 'Live admin updates are not supported in this browser.'
      );
      return undefined;
    }

    const eventSource = new window.EventSource(buildApiUrl('/api/admin/stream'), {
      withCredentials: true,
    });

    eventSource.addEventListener('dashboard_update', () => {
      refreshData({ notify: true, silent: true });
    });

    eventSource.onerror = () => {
      setRemoteDataError((currentMessage) =>
        currentMessage || 'Live admin updates are temporarily unavailable. Refresh to reconnect.'
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

  const foodMenuItems = useMemo(() => {
    const featuredItems = catalog.featuredPlates.map((plate) => ({
      name: plate.title,
      price: plate.price,
      image: plate.image,
      description: plate.description,
      categoryTitle: plate.tag || 'Featured Dish',
      source: 'featured',
    }));

    const categoryItems = catalog.categories.flatMap((category) =>
      category.items.map((item) => ({
        ...item,
        categoryTitle: category.title,
        source: 'menu',
      }))
    );

    return [...featuredItems, ...categoryItems];
  }, [catalog.categories, catalog.featuredPlates]);

  const stats = useMemo(() => {
    const totalDiningItems =
      catalog.featuredPlates.length +
      catalog.categories.reduce((sum, category) => sum + category.items.length, 0);

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
  }, [catalog.categories, catalog.featuredPlates.length, eventBookings.length, foodOrders.length, roomBookings.length, rooms.length, users.length]);

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

  const handleMenuItemFormChange = (event) => {
    const { name, value } = event.target;
    setMenuItemForm((current) => ({ ...current, [name]: value }));
  };

  const handleRoomImageFileChange = async (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      setRoomForm((current) => ({ ...current, imageFile: '', imageFileName: '' }));
      return;
    }

    try {
      const imageFile = await readFileAsDataUrl(selectedFile);
      setRoomForm((current) => ({
        ...current,
        imageFile,
        imageFileName: selectedFile.name,
      }));
      setStatus('');
      setRemoteDataError('');
    } catch (error) {
      setRemoteDataError(error.message || 'Unable to read the selected room image.');
    }
  };

  const handleDishImageFileChange = async (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      setDishForm((current) => ({ ...current, imageFile: '', imageFileName: '' }));
      return;
    }

    try {
      const imageFile = await readFileAsDataUrl(selectedFile);
      setDishForm((current) => ({
        ...current,
        imageFile,
        imageFileName: selectedFile.name,
      }));
      setStatus('');
      setRemoteDataError('');
    } catch (error) {
      setRemoteDataError(error.message || 'Unable to read the selected dish image.');
    }
  };

  const handleMenuItemImageFileChange = async (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      setMenuItemForm((current) => ({ ...current, imageFile: '', imageFileName: '' }));
      return;
    }

    try {
      const imageFile = await readFileAsDataUrl(selectedFile);
      setMenuItemForm((current) => ({
        ...current,
        imageFile,
        imageFileName: selectedFile.name,
      }));
      setStatus('');
      setRemoteDataError('');
    } catch (error) {
      setRemoteDataError(error.message || 'Unable to read the selected menu item image.');
    }
  };

  const handleAddRoom = async (event) => {
    event.preventDefault();

    const newRoom = {
      name: roomForm.name.trim(),
      price: formatCurrency(roomForm.price),
      image:
        roomForm.imageFile ||
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
        dishForm.imageFile ||
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

  const handleDeleteMenuItem = async (item) => {
    if (item.source === 'featured') {
      await handleDeleteFeaturedDish(item.name);
      return;
    }

    const updatedCategories = catalog.categories
      .map((category) =>
        category.title !== item.categoryTitle
          ? category
          : {
              ...category,
              items: category.items.filter((categoryItem) => categoryItem.name !== item.name),
            }
      )
      .filter((category) => category.items.length > 0);

    const updatedCatalog = {
      ...catalog,
      categories: updatedCategories,
    };

    await saveManagedDiningCatalog(updatedCatalog);
    setCatalog(updatedCatalog);
    setStatus(`Removed menu item: ${item.name}`);
  };

  const handleAddMenuItem = async (event) => {
    event.preventDefault();

    const categoryTitle = menuItemForm.categoryTitle.trim();
    const categoryDescription =
      menuItemForm.categoryDescription.trim() ||
      'Freshly prepared selections from the EliteHotels kitchen.';

    const newMenuItem = {
      name: menuItemForm.name.trim(),
      price: formatCurrency(menuItemForm.price),
      image:
        menuItemForm.imageFile ||
        menuItemForm.image.trim() ||
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
      description:
        menuItemForm.description.trim() ||
        `${categoryTitle} selection prepared for the EliteHotels dining menu.`,
    };

    const existingCategoryIndex = catalog.categories.findIndex(
      (category) => category.title.trim().toLowerCase() === categoryTitle.toLowerCase()
    );

    const nextCategories =
      existingCategoryIndex >= 0
        ? catalog.categories.map((category, index) =>
            index === existingCategoryIndex
              ? {
                  ...category,
                  description: menuItemForm.categoryDescription.trim() || category.description,
                  items: [
                    {
                      name: newMenuItem.name,
                      price: newMenuItem.price,
                      image: newMenuItem.image,
                      description: newMenuItem.description,
                    },
                    ...category.items,
                  ],
                }
              : category
          )
        : [
            {
              title: categoryTitle,
              description: categoryDescription,
              items: [
                {
                  name: newMenuItem.name,
                  price: newMenuItem.price,
                  image: newMenuItem.image,
                  description: newMenuItem.description,
                },
              ],
            },
            ...catalog.categories,
          ];

    const updatedCatalog = {
      ...catalog,
      categories: nextCategories,
    };

    await saveManagedDiningCatalog(updatedCatalog);
    setCatalog(updatedCatalog);
    setMenuItemForm(defaultMenuItemForm);
    setStatus(`Added menu item: ${newMenuItem.name} in ${categoryTitle}`);
  };

  const handleLogout = () => {
    clearAdminSession();
    navigate('/signin', { replace: true });
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await axios.put(
        buildApiUrl(`/api/admin/users/${userId}/role`),
        { role },
        { withCredentials: true }
      );
      setStatus(`Updated user role to ${role}`);
      refreshData();
    } catch (error) {
      setRemoteDataError(error.response?.data?.message || 'Unable to update user role.');
    }
  };

  const handleFoodOrderStatusChange = async (orderId, nextStatus) => {
    setStatusUpdateOrderId(orderId);
    setRemoteDataError('');

    try {
      await axios.put(
        buildApiUrl(`/api/food_orders/${orderId}/status`),
        { status: nextStatus },
        { withCredentials: true }
      );
      setStatus(`Updated food order #${orderId} to ${nextStatus}.`);
      await refreshData({ notify: false, silent: true });
    } catch (error) {
      setRemoteDataError(error.response?.data?.message || 'Unable to update food order status.');
    } finally {
      setStatusUpdateOrderId(null);
    }
  };

  const handleEnableNotifications = async () => {
    const permission = await requestBrowserNotificationPermission();
    setNotificationPermission(permission);
  };

  return (
    <section className="admin-shell">
      <div className="admin-shell__hero">
        <div>
          <p className="admin-shell__eyebrow">EliteHotels Admin Panel</p>
          <h1>Manage rooms, dining, users, bookings, and orders from one dashboard.</h1>
          <p>
            This panel shows the hotel's live admin data and lets you manage the room and
            dining catalog without the extra workspace layer.
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
              You are signed in as an administrator and can manage website content and records.
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
        {notificationPermission === 'unsupported' && (
          <div className="auth-alert auth-alert--info">
            Browser notifications are not supported here, but the dashboard will still auto-refresh.
          </div>
        )}
        {notificationMessage && <div className="auth-alert auth-alert--success">{notificationMessage}</div>}
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
              <button type="button" className="admin-board__refresh" onClick={() => refreshData()}>
                Refresh Data
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

        <nav className="admin-quick-nav" aria-label="Admin section navigation">
          {adminQuickLinks.map((link) => (
            <a key={link.target} className="admin-quick-nav__link" href={`#${link.target}`}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="admin-shell__tools">
          <div className="admin-shell__tools-main">
            <div className="admin-board__grid">
              <article className="admin-data-card" id="admin-room-catalog">
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
                  <label className="admin-input admin-input--wide">
                    <span>Select local image</span>
                    <input type="file" accept="image/*" onChange={handleRoomImageFileChange} />
                    {roomForm.imageFileName && <small>Selected file: {roomForm.imageFileName}</small>}
                  </label>
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

              <article className="admin-data-card" id="admin-dining-highlights">
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
                  <label className="admin-input admin-input--wide">
                    <span>Select local image</span>
                    <input type="file" accept="image/*" onChange={handleDishImageFileChange} />
                    {dishForm.imageFileName && <small>Selected file: {dishForm.imageFileName}</small>}
                  </label>
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

              <article className="admin-data-card" id="admin-food-menu">
                <div className="admin-data-card__header">
                  <p>Food Menu</p>
                  <h3>Add a dish to the food menu with its category and details</h3>
                </div>

                <form className="admin-form-grid" onSubmit={handleAddMenuItem}>
                  <input
                    className="admin-input"
                    name="name"
                    placeholder="Dish name"
                    value={menuItemForm.name}
                    onChange={handleMenuItemFormChange}
                    required
                  />
                  <input
                    className="admin-input"
                    name="price"
                    placeholder="Price e.g. 1850"
                    value={menuItemForm.price}
                    onChange={handleMenuItemFormChange}
                    required
                  />
                  <input
                    className="admin-input"
                    name="categoryTitle"
                    placeholder="Category e.g. Main Courses"
                    value={menuItemForm.categoryTitle}
                    onChange={handleMenuItemFormChange}
                    required
                  />
                  <input
                    className="admin-input admin-input--wide"
                    name="categoryDescription"
                    placeholder="Category description"
                    value={menuItemForm.categoryDescription}
                    onChange={handleMenuItemFormChange}
                  />
                  <input
                    className="admin-input admin-input--wide"
                    name="image"
                    placeholder="Image URL"
                    value={menuItemForm.image}
                    onChange={handleMenuItemFormChange}
                  />
                  <label className="admin-input admin-input--wide">
                    <span>Select local image</span>
                    <input type="file" accept="image/*" onChange={handleMenuItemImageFileChange} />
                    {menuItemForm.imageFileName && <small>Selected file: {menuItemForm.imageFileName}</small>}
                  </label>
                  <textarea
                    className="admin-input admin-input--wide admin-textarea"
                    name="description"
                    placeholder="Dish description"
                    value={menuItemForm.description}
                    onChange={handleMenuItemFormChange}
                    required
                  />
                  <button type="submit" className="admin-button">
                    Add Menu Item
                  </button>
                </form>
              </article>

              <article className="admin-data-card" id="admin-all-foods">
                <div className="admin-data-card__header">
                  <p>All Food Menu Items</p>
                  <h3>Every food item currently available in the dining menu</h3>
                </div>

                {foodMenuItems.length === 0 ? (
                  <p className="admin-data-card__empty">No food menu items available yet.</p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Dish</th>
                          <th>Category</th>
                          <th>Price</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {foodMenuItems.map((item) => (
                          <tr key={`${item.source}-${item.categoryTitle}-${item.name}`}>
                            <td>{item.name}</td>
                            <td>{item.categoryTitle}</td>
                            <td>{item.price}</td>
                            <td>
                              <button
                                type="button"
                                className="admin-table__button"
                                onClick={() => handleDeleteMenuItem(item)}
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

              <article className="admin-data-card" id="admin-users">
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
                          <th>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.user_id}>
                            <td>{user.username || 'Guest'}</td>
                            <td>{user.email}</td>
                            <td>{user.phone || '-'}</td>
                            <td>
                              <select
                                className="admin-input"
                                value={user.role || 'guest'}
                                onChange={(event) => handleRoleChange(user.user_id, event.target.value)}
                                disabled={adminSession?.role !== 'owner'}
                              >
                                <option value="owner">Owner</option>
                                <option value="admin">Admin</option>
                                <option value="staff">Staff</option>
                                <option value="viewer">Viewer</option>
                                <option value="guest">Guest</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="admin-data-card" id="admin-food-orders">
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
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {foodOrders.map((order) => (
                          <tr key={order.id}>
                            <td>{order.order_title}</td>
                            <td>{order.preferred_date} {order.preferred_time}</td>
                            <td>{order.phone || '-'}</td>
                            <td>KSh {Number(order.total_amount || 0).toLocaleString()}</td>
                            <td>
                              <select
                                className="admin-input"
                                value={order.status || 'pending'}
                                onChange={(event) =>
                                  handleFoodOrderStatusChange(order.id, event.target.value)
                                }
                                disabled={statusUpdateOrderId === order.id}
                              >
                                {FOOD_ORDER_STATUS_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="admin-data-card" id="admin-event-bookings">
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

              <article className="admin-data-card" id="admin-saved-rooms">
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

            </div>
          </div>

          <aside className="admin-shell__tools-side">
            <div className="admin-board">
              <article className="admin-data-card" id="admin-room-bookings">
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

              <article className="admin-data-card" id="admin-local-cache">
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

              <article className="admin-data-card" id="admin-shortcuts">
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
