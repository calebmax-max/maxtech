import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Loader from './Loader';
import { submitStayBooking } from '../utils/checkoutApi';

const bookingOffers = [
  {
    title: 'Weekend Escape',
    price: 'KSh 18,500',
    text: '2 nights in a deluxe room with breakfast and late checkout included.',
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Business Comfort',
    price: 'KSh 22,000',
    text: 'Executive room stay with airport pickup, Wi-Fi, and meeting lounge access.',
    image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Family Holiday',
    price: 'KSh 27,400',
    text: 'Family suite package with breakfast, dinner, and children activity access.',
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
  },
];

const bookingPerks = [
  'Instant reservation support',
  'Flexible room choices',
  'Breakfast and dining options',
  'Secure payment process',
];

const roomRates = {
  deluxe: 12500,
  executive: 19800,
  family: 16200,
  presidential: 32000,
};

const mealPlanRates = {
  breakfast: 0,
  'half-board': 2500,
  'full-board': 4500,
};

const requestRates = {
  none: 0,
  airport: 3000,
  decor: 2200,
  'late-checkout': 1800,
};

const formatDate = (date) => date.toISOString().split('T')[0];

const getTomorrow = (dateString) => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 1);
  return formatDate(date);
};

const Bookings = () => {
  const today = formatDate(new Date());
  const location = useLocation();
  const navigate = useNavigate();
  const bookingState = location.state || {};

  const [checkIn, setCheckIn] = useState(bookingState.checkIn || today);
  const [checkOut, setCheckOut] = useState(bookingState.checkOut || getTomorrow(bookingState.checkIn || today));
  const [guests, setGuests] = useState(bookingState.guests || '2');
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [roomType, setRoomType] = useState('deluxe');
  const [mealPlan, setMealPlan] = useState('breakfast');
  const [specialRequest, setSpecialRequest] = useState('none');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const nights = useMemo(() => {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const difference = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    return difference > 0 ? difference : 1;
  }, [checkIn, checkOut]);

  const estimatedTotal = useMemo(() => {
    return (roomRates[roomType] + mealPlanRates[mealPlan]) * nights + requestRates[specialRequest];
  }, [roomType, mealPlan, specialRequest, nights]);

  const checkoutItem = {
    title: 'Custom Stay Booking',
    description: `Name: ${customerName || 'Not provided'}, Phone: ${phoneNumber || 'Not provided'}, Room: ${roomType}, Guests: ${guests}, Meal Plan: ${mealPlan}, Request: ${specialRequest}, Check-In: ${checkIn}, Check-Out: ${checkOut}, Nights: ${nights}`,
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    amount: estimatedTotal,
    type: 'Booking Estimate',
    bookingPageDetails: {
      customerName,
      phoneNumber,
      roomType,
      guests: Number(guests),
      mealPlan,
      specialRequest,
      checkIn,
      checkOut,
      nights,
    },
  };

  const handleContinueToPayment = async () => {
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      await submitStayBooking({
        customer_name: customerName,
        phone_number: phoneNumber,
        room_type: roomType,
        guests: Number(guests),
        meal_plan: mealPlan,
        special_request: specialRequest,
        check_in: checkIn,
        check_out: checkOut,
        nights,
        amount: estimatedTotal,
      });

      setSuccess('Booking details saved successfully. Proceeding to payment.');
      navigate('/makepayment', {
        state: {
          checkoutItem,
          paymentNotice: 'Booking details saved successfully. Complete payment below.',
        },
      });
    } catch (submitError) {
      if (!submitError.response) {
        setError('Booking service is not reachable right now. Please try again in a moment.');
      } else {
        setError(submitError.response?.data?.message || 'Unable to save booking details right now.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bookings-page">
      <div className="bookings-page__hero">
        <p className="bookings-page__eyebrow">Plan Your Stay</p>
        <h2>Book rooms, select your dates, and choose the package that fits your visit.</h2>
        <p className="bookings-page__intro">
          Make your reservation with a simple booking flow designed for holidays, business travel,
          family trips, and special occasions.
        </p>
      </div>

      <div className="bookings-layout">
        <div className="bookings-form-card">
          <div className="bookings-form-card__heading">
            <h3>Reservation Details</h3>
            <p>Choose your stay preferences and continue to confirm your booking.</p>
          </div>

          <div className="bookings-form-grid">
            <label className="bookings-field">
              <span>Full Name</span>
              <input
                type="text"
                placeholder="Enter your full name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </label>

            <label className="bookings-field">
              <span>Phone Number</span>
              <input
                type="tel"
                placeholder="Enter your phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </label>

            <label className="bookings-field">
              <span>Check-In</span>
              <input
                type="date"
                min={today}
                value={checkIn}
                onChange={(e) => {
                  const nextCheckIn = e.target.value;
                  setCheckIn(nextCheckIn);
                  if (checkOut <= nextCheckIn) {
                    setCheckOut(getTomorrow(nextCheckIn));
                  }
                }}
              />
            </label>

            <label className="bookings-field">
              <span>Check-Out</span>
              <input
                type="date"
                min={getTomorrow(checkIn)}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </label>

            <label className="bookings-field">
              <span>Guests</span>
              <select value={guests} onChange={(e) => setGuests(e.target.value)}>
                <option value="1">1 Guest</option>
                <option value="2">2 Guests</option>
                <option value="4">4 Guests</option>
              </select>
            </label>

            <label className="bookings-field">
              <span>Room Type</span>
              <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                <option value="deluxe">Deluxe Room</option>
                <option value="executive">Executive Suite</option>
                <option value="family">Family Room</option>
                <option value="presidential">Presidential Suite</option>
              </select>
            </label>

            <label className="bookings-field bookings-field--wide">
              <span>Meal Plan</span>
              <select value={mealPlan} onChange={(e) => setMealPlan(e.target.value)}>
                <option value="breakfast">Breakfast Included</option>
                <option value="half-board">Half Board</option>
                <option value="full-board">Full Board</option>
              </select>
            </label>

            <label className="bookings-field bookings-field--wide">
              <span>Special Request</span>
              <select value={specialRequest} onChange={(e) => setSpecialRequest(e.target.value)}>
                <option value="none">No Special Request</option>
                <option value="airport">Airport Pickup</option>
                <option value="decor">Room Decoration</option>
                <option value="late-checkout">Late Checkout</option>
              </select>
            </label>
          </div>

          <div className="bookings-total">
            <span>Estimated Total</span>
            <small>{nights} night{nights > 1 ? 's' : ''}</small>
            <strong>KSh {estimatedTotal.toLocaleString()}</strong>
          </div>

          {loading && <Loader />}
          {success && <div className="payment-message payment-message--success">{success}</div>}
          {error && <div className="payment-message payment-message--error">{error}</div>}

          <button
            type="button"
            className="bookings-submit"
            onClick={handleContinueToPayment}
            disabled={loading}
          >
            Continue To Booking
          </button>
        </div>

        <aside className="bookings-summary-card">
          <p className="bookings-summary-card__label">Why Book Here</p>
          <h3>Comfortable stays with flexible packages.</h3>
          <p>
            Select your room, guests, and stay style, then continue to secure payment and
            reservation confirmation.
          </p>

          <div className="bookings-summary-card__perks">
            {bookingPerks.map((perk) => (
              <span key={perk}>{perk}</span>
            ))}
          </div>
        </aside>
      </div>

      <div className="bookings-offers">
        {bookingOffers.map((offer) => (
          <article className="bookings-offer-card" key={offer.title}>
            <img className="bookings-offer-card__image" src={offer.image} alt={offer.title} />
            <p className="bookings-offer-card__tag">Package Offer</p>
            <h4>{offer.title}</h4>
            <p>{offer.text}</p>
            <div className="bookings-offer-card__footer">
              <strong>{offer.price}</strong>
              <Link
                className="bookings-offer-card__cta"
                to="/makepayment"
                state={{
                  checkoutItem: {
                    title: offer.title,
                    description: offer.text,
                    image: offer.image,
                    amount: Number(offer.price.replace(/[^0-9]/g, '')),
                    type: 'Package Booking',
                  },
                }}
              >
                Book Now
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Bookings;
