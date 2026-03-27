import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { submitFoodOrder, submitRoomBooking, submitStayBooking } from '../utils/checkoutApi';
import { buildApiUrl } from '../utils/api';
import { fetchManagedDiningCatalog, getManagedFoodCheckoutItems } from '../utils/adminCatalog';
import { saveRoomBooking } from '../utils/roomBookingStorage';
import Loader from './Loader';

const FOOD_PAYMENT_TYPES = new Set(['Food Order', 'Featured Dish']);
const isFoodPaymentItem = (item) => FOOD_PAYMENT_TYPES.has(item?.type);

const normalizeCartItem = (item, quantity = 1) => ({
  id: item.id || `${item.type}-${item.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  title: item.title,
  description: item.description,
  image: item.image,
  amount: Number(item.amount) || 0,
  type: item.type || 'Food Order',
  category: item.category || 'Menu Item',
  quantity,
});

const formatDate = (date) => date.toISOString().split('T')[0];

const toDisplayMessage = (value, fallback) => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (value && typeof value === 'object') {
    if (typeof value.errorMessage === 'string' && value.errorMessage.trim()) {
      return value.errorMessage;
    }
    if (typeof value.message === 'string' && value.message.trim()) {
      return value.message;
    }

    const pieces = Object.entries(value)
      .filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item))
      .map(([key, item]) => `${key}: ${item}`);

    if (pieces.length > 0) {
      return pieces.join(' | ');
    }
  }

  return fallback;
};

const Makepayment = () => {
  const [allFoodCheckoutItems, setAllFoodCheckoutItems] = useState(() => getManagedFoodCheckoutItems());
  const location = useLocation();
  const navigate = useNavigate();
  const { checkoutItem, paymentNotice } = location.state || {};
  const today = formatDate(new Date());

  const paymentItem = useMemo(() => checkoutItem || null, [checkoutItem]);

  const isFoodOrder = isFoodPaymentItem(paymentItem);
  const [number, setNumber] = useState('');
  const [preferredDate, setPreferredDate] = useState(today);
  const [preferredTime, setPreferredTime] = useState('12:30');
  const [cartItems, setCartItems] = useState([]);
  const [selectedFoodId, setSelectedFoodId] = useState(allFoodCheckoutItems[0]?.id || '');
  const [selectedFoodQuantity, setSelectedFoodQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetchManagedDiningCatalog()
      .then(() => {
        if (active) {
          setAllFoodCheckoutItems(getManagedFoodCheckoutItems());
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isFoodOrder && paymentItem) {
      setCartItems([normalizeCartItem(paymentItem)]);
      setSelectedFoodId(paymentItem.id || allFoodCheckoutItems[0]?.id || '');
      return;
    }

    setCartItems([]);
    setSelectedFoodId(allFoodCheckoutItems[0]?.id || '');
  }, [allFoodCheckoutItems, isFoodOrder, paymentItem]);

  const foodTotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.amount * item.quantity, 0),
    [cartItems]
  );

  const expectedAmount = isFoodOrder ? foodTotal : Number(paymentItem?.amount) || 0;
  const selectedFood = allFoodCheckoutItems.find((item) => item.id === selectedFoodId) || null;

  const bookingDetails = paymentItem?.bookingPageDetails || paymentItem?.bookingDetails || null;
  const bookingNights = bookingDetails?.nights || 0;
  const bookingRoomName = bookingDetails?.roomName || bookingDetails?.roomType || paymentItem?.title || '';

  const updateCartQuantity = (itemId, nextQuantity) => {
    const quantity = Math.max(1, Number(nextQuantity) || 1);
    setCartItems((currentItems) =>
      currentItems.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    );
  };

  const removeCartItem = (itemId) => {
    setCartItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
  };

  const addFoodToCart = () => {
    if (!selectedFood) {
      return;
    }

    const quantity = Math.max(1, Number(selectedFoodQuantity) || 1);

    setCartItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.id === selectedFood.id);

      if (existingItem) {
        return currentItems.map((item) =>
          item.id === selectedFood.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }

      return [...currentItems, normalizeCartItem(selectedFood, quantity)];
    });

    setSelectedFoodQuantity('1');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      if (!paymentItem) {
        throw new Error('No item selected for payment.');
      }

      if (isFoodOrder && cartItems.length === 0) {
        throw new Error('Add at least one food item before checkout.');
      }

      if (!number.trim()) {
        throw new Error('Enter the phone number that should receive the M-Pesa prompt.');
      }

      const response = await axios.post(
        buildApiUrl('/api/mpesa_payment'),
        {
          phone: number.trim(),
          amount: expectedAmount,
        },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (paymentItem.type === 'Room Booking' && paymentItem.bookingDetails) {
        await submitRoomBooking({
          room_name: bookingRoomName,
          description: paymentItem.description,
          check_in: paymentItem.bookingDetails.checkIn,
          check_out: paymentItem.bookingDetails.checkOut,
          nights: paymentItem.bookingDetails.nights || 1,
          amount: expectedAmount,
          payment_phone: number.trim(),
        });

        saveRoomBooking({
          roomName: bookingRoomName,
          checkIn: paymentItem.bookingDetails.checkIn,
          checkOut: paymentItem.bookingDetails.checkOut,
          customerName: paymentItem.bookingDetails.customerName || '',
          bookedAt: new Date().toISOString(),
        });
      }

      if (isFoodOrder) {
        await submitFoodOrder({
          order_title: paymentItem.title,
          preferred_date: preferredDate,
          preferred_time: preferredTime,
          total_amount: expectedAmount,
          payment_phone: number.trim(),
          items: cartItems.map((item) => ({
            item_name: item.title,
            category: item.category,
            quantity: item.quantity,
            unit_price: item.amount,
            line_total: item.amount * item.quantity,
          })),
        });
      }

      if (paymentItem.type === 'Booking Estimate' && paymentItem.bookingPageDetails) {
        await submitStayBooking({
          customer_name: paymentItem.bookingPageDetails.customerName || '',
          phone_number: paymentItem.bookingPageDetails.phoneNumber || number.trim(),
          payment_phone: paymentItem.bookingPageDetails.phoneNumber || number.trim(),
          room_name: bookingRoomName,
          room_type: bookingRoomName,
          guests: paymentItem.bookingPageDetails.guests || 0,
          meal_plan: paymentItem.bookingPageDetails.mealPlan || '',
          special_request: paymentItem.bookingPageDetails.specialRequest || '',
          check_in: paymentItem.bookingPageDetails.checkIn || null,
          check_out: paymentItem.bookingPageDetails.checkOut || null,
          nights: paymentItem.bookingPageDetails.nights || 0,
          amount: expectedAmount,
        });

        saveRoomBooking({
          roomName: bookingRoomName,
          checkIn: paymentItem.bookingPageDetails.checkIn,
          checkOut: paymentItem.bookingPageDetails.checkOut,
          customerName: paymentItem.bookingPageDetails.customerName || '',
          bookedAt: new Date().toISOString(),
        });
      }

      setSuccess(
        toDisplayMessage(response.data.message, '') ||
          `STK push sent for ${paymentItem.title}. Check your phone and enter your M-Pesa PIN.`
      );
    } catch (paymentError) {
      setError(
        toDisplayMessage(
          paymentError.response?.data?.error,
          toDisplayMessage(
            paymentError.response?.data?.message,
            paymentError.message || 'Payment failed. Try again.'
          )
        )
      );
    } finally {
      setLoading(false);
    }
  };

  if (!paymentItem) {
    return (
      <section className="payment-page">
        <div className="payment-shell payment-shell--empty">
          <p className="bookings-page__eyebrow">Payment</p>
          <h2>No item selected for payment.</h2>
          <p>Please choose a room, food order, or booking package first.</p>
          <button className="payment-back" type="button" onClick={() => navigate('/')}>
            Back To Home
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="payment-page">
      <div className="payment-page__hero">
        <p className="bookings-page__eyebrow">Lipa na M-Pesa</p>
        <h2>Confirm your booking total and complete payment with confidence.</h2>
        <p className="payment-page__intro">
          Review the selected item, enter your phone number, and pay the exact amount shown below.
        </p>
      </div>

      <div className="payment-shell">
        <div className="payment-summary-card">
          {paymentItem.image && (
            <img
              src={paymentItem.image}
              alt={paymentItem.title}
              className="payment-summary-card__image"
            />
          )}

          <div className="payment-summary-card__body">
            <p className="payment-summary-card__label">{paymentItem.type}</p>
            <h3>{paymentItem.title}</h3>
            <p>{paymentItem.description}</p>

            {!isFoodOrder && bookingNights > 0 && (
              <div className="payment-cart">
                <div className="payment-cart__date">
                  <span>Length of Stay</span>
                  <strong>
                    {bookingNights} night{bookingNights > 1 ? 's' : ''}
                  </strong>
                </div>
                {bookingDetails?.checkIn && (
                  <div className="payment-cart__date">
                    <span>Check-In</span>
                    <strong>{bookingDetails.checkIn}</strong>
                  </div>
                )}
                {bookingDetails?.checkOut && (
                  <div className="payment-cart__date">
                    <span>Check-Out</span>
                    <strong>{bookingDetails.checkOut}</strong>
                  </div>
                )}
              </div>
            )}

            {isFoodOrder && (
              <div className="payment-cart">
                <div className="payment-cart__header">
                  <h4>Your Food Order</h4>
                  <span>{cartItems.reduce((count, item) => count + item.quantity, 0)} item(s)</span>
                </div>

                <div className="payment-cart__date">
                  <span>Preferred Date</span>
                  <strong>{preferredDate}</strong>
                </div>

                <div className="payment-cart__date">
                  <span>Preferred Time</span>
                  <strong>{preferredTime}</strong>
                </div>

                {cartItems.map((item) => (
                  <div className="payment-cart__row" key={item.id}>
                    <div className="payment-cart__details">
                      <strong>{item.title}</strong>
                      <span>{item.category}</span>
                    </div>

                    <div className="payment-cart__actions">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateCartQuantity(item.id, e.target.value)}
                      />
                      <strong>KSh {(item.amount * item.quantity).toLocaleString()}</strong>
                      <button
                        type="button"
                        className="payment-cart__remove"
                        onClick={() => removeCartItem(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                <div className="payment-cart__add">
                  <label className="payment-field">
                    <span>Add Another Food</span>
                    <select value={selectedFoodId} onChange={(e) => setSelectedFoodId(e.target.value)}>
                      {allFoodCheckoutItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title} - KSh {item.amount.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="payment-field">
                    <span>Quantity</span>
                    <input
                      type="number"
                      min="1"
                      value={selectedFoodQuantity}
                      onChange={(e) => setSelectedFoodQuantity(e.target.value)}
                    />
                  </label>

                  <button type="button" className="payment-cart__button" onClick={addFoodToCart}>
                    Add To Order
                  </button>
                </div>
              </div>
            )}

            <div className="payment-summary-card__total">
              <span>{isFoodOrder ? 'Food Order Total' : 'Total Before Payment'}</span>
              <strong>KSh {expectedAmount.toLocaleString()}</strong>
            </div>

            <button className="payment-back" type="button" onClick={() => navigate(-1)}>
              Back
            </button>
          </div>
        </div>

        <div className="payment-form-card">
          <div className="payment-form-card__header">
            <p className="payment-form-card__eyebrow">Payment Details</p>
            <h3>Complete Payment</h3>
            <p>Enter your phone number and you will receive a message to complete the payment.</p>
          </div>

          {paymentNotice && <div className="payment-message payment-message--success">{paymentNotice}</div>}
          {loading && <Loader />}
          {success && <div className="payment-message payment-message--success">{success}</div>}
          {error && <div className="payment-message payment-message--error">{error}</div>}

          <form className="payment-form" onSubmit={handleSubmit}>
            <label className="payment-field">
              <span>Phone Number</span>
              <input
                type="tel"
                placeholder="Enter phone number 2547XXXXXXXX"
                required
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </label>

            {isFoodOrder && (
              <>
                <label className="payment-field">
                  <span>Preferred Date</span>
                  <input
                    type="date"
                    min={today}
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                  />
                </label>

                <label className="payment-field">
                  <span>Preferred Time</span>
                  <input
                    type="time"
                    required
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                  />
                </label>
              </>
            )}

            <label className="payment-field">
              <span>Amount To Pay</span>
              <input type="text" readOnly value={`KSh ${expectedAmount.toLocaleString()}`} />
            </label>

            <button type="submit" className="payment-submit" disabled={loading}>
              Make Payment
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Makepayment;
