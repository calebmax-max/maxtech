import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { allFoodCheckoutItems } from '../data/diningMenu';
import { submitFoodOrder, submitRoomBooking, submitStayBooking } from '../utils/checkoutApi';
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

const Makepayment = () => {
  const location = useLocation();
  const { product, checkoutItem, paymentNotice } = location.state || {};
  const today = formatDate(new Date());

  const paymentItem = useMemo(() => {
    if (checkoutItem) {
      return checkoutItem;
    }

    if (product) {
      return {
        title: product.product_name,
        description: product.product_description,
        image: product.product_photo,
        amount: Number(product.product_cost) || 0,
        type: 'Food Order',
      };
    }

    return null;
  }, [checkoutItem, product]);
  const isFoodOrder = isFoodPaymentItem(paymentItem);

  const navigate = useNavigate();
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState(paymentItem ? String(paymentItem.amount) : '');
  const [preferredDate, setPreferredDate] = useState(today);
  const [preferredTime, setPreferredTime] = useState('12:30');
  const [cartItems, setCartItems] = useState([]);
  const [selectedFoodId, setSelectedFoodId] = useState(allFoodCheckoutItems[0]?.id || '');
  const [selectedFoodQuantity, setSelectedFoodQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isFoodOrder && paymentItem) {
      setCartItems([normalizeCartItem(paymentItem)]);
      setSelectedFoodId(paymentItem.id || allFoodCheckoutItems[0]?.id || '');
      return;
    }

    setCartItems([]);
    setSelectedFoodId(allFoodCheckoutItems[0]?.id || '');
  }, [isFoodOrder, paymentItem]);

  const foodTotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.amount * item.quantity, 0),
    [cartItems]
  );

  useEffect(() => {
    if (isFoodOrder) {
      setAmount(foodTotal ? String(foodTotal) : '');
      return;
    }

    setAmount(paymentItem ? String(paymentItem.amount) : '');
  }, [foodTotal, isFoodOrder, paymentItem]);

  const expectedAmount = isFoodOrder ? foodTotal : paymentItem?.amount || 0;
  const selectedFood = allFoodCheckoutItems.find((item) => item.id === selectedFoodId) || null;

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
          item.id === selectedFood.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...currentItems, normalizeCartItem(selectedFood, quantity)];
    });

    setSelectedFoodQuantity('1');
  };

  const handlesubmit = async (e) => {
    e.preventDefault();
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

      const enteredAmount = Number(amount);

      if (!enteredAmount || enteredAmount !== expectedAmount) {
        throw new Error(`Enter the exact required amount: Kes ${expectedAmount.toLocaleString()}`);
      }

      const formdata = new FormData();
      formdata.append('phone', number);
      formdata.append('amount', enteredAmount);

      const response = await axios.post(
        'https://calebtonny.alwaysdata.net/api/mpesa_payment',
        formdata
      );

      if (paymentItem.type === 'Room Booking' && paymentItem.bookingDetails) {
        await submitRoomBooking({
          room_name: paymentItem.bookingDetails.roomName,
          description: paymentItem.description,
          check_in: paymentItem.bookingDetails.checkIn,
          check_out: paymentItem.bookingDetails.checkOut,
          nights: paymentItem.bookingDetails.nights || 1,
          amount: enteredAmount,
          payment_phone: number,
        });

        saveRoomBooking({
          roomName: paymentItem.bookingDetails.roomName,
          checkIn: paymentItem.bookingDetails.checkIn,
          checkOut: paymentItem.bookingDetails.checkOut,
          bookedAt: new Date().toISOString(),
        });
      }

      if (isFoodOrder) {
        await submitFoodOrder({
          order_title: paymentItem.title,
          preferred_date: preferredDate,
          preferred_time: preferredTime,
          total_amount: enteredAmount,
          payment_phone: number,
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
          phone_number: paymentItem.bookingPageDetails.phoneNumber || number,
          room_type: paymentItem.bookingPageDetails.roomType || '',
          guests: paymentItem.bookingPageDetails.guests || 0,
          meal_plan: paymentItem.bookingPageDetails.mealPlan || '',
          special_request: paymentItem.bookingPageDetails.specialRequest || '',
          check_in: paymentItem.bookingPageDetails.checkIn || null,
          check_out: paymentItem.bookingPageDetails.checkOut || null,
          nights: paymentItem.bookingPageDetails.nights || 0,
          amount: enteredAmount,
        });
      }

      setLoading(false);
      setSuccess(response.data.message || `STK push sent for ${paymentItem.title}. Check your phone and enter your M-Pesa PIN.`);
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (paymentError) {
      setLoading(false);
      setError(paymentError.message || 'Payment failed. Try again.');
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
            <img src={paymentItem.image} alt={paymentItem.title} className="payment-summary-card__image" />
          )}

          <div className="payment-summary-card__body">
            <p className="payment-summary-card__label">{paymentItem.type}</p>
            <h3>{paymentItem.title}</h3>
            <p>{paymentItem.description}</p>

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
                      <button type="button" className="payment-cart__remove" onClick={() => removeCartItem(item.id)}>
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
            <p>Enter the exact total shown and your phone number to receive an STK push on your phone.</p>
          </div>

          {paymentNotice && <div className="payment-message payment-message--success">{paymentNotice}</div>}
          {loading && <Loader />}
          {success && <div className="payment-message payment-message--success">{success}</div>}
          {error && <div className="payment-message payment-message--error">{error}</div>}

          <form className="payment-form" onSubmit={handlesubmit}>
            <label className="payment-field">
              <span>Phone Number</span>
              <input
                type="number"
                placeholder="Enter phone number 254XXXXXXX"
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
              <span>Required Amount</span>
              <input
                type="number"
                placeholder={`Enter exact amount ${expectedAmount}`}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>

            <button type="submit" className="payment-submit">
              Make Payment
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Makepayment;
