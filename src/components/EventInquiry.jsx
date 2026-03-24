import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from './Loader';

//submitEventBooking → API function that sends event booking details to your backend.
import { submitEventBooking } from '../utils/eventBookingApi';

const baseRates = {
  'Corporate Meeting': 18000,
  'Birthday Party': 22000,
  'Wedding Reception': 65000,
  'Private Dinner': 16000,
  'Family Celebration': 28000,
};



//Stores all form fields: name, email, phone, event type, number of guests, date.
//Also tracks UI state: loading, success message, error message.
const EventInquiry = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('Corporate Meeting');
  const [guests, setGuests] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  //useMemo ensures the calculation updates only when eventType or guests change.
  const estimatedPrice = useMemo(() => {
    //Converts the guests input (usually a string from an input field) into a number.
//If guests is empty or invalid, || 0 ensures it defaults to 0.
    const guestCount = Number(guests) || 0;

    //|| 15000 → if eventType is invalid or missing, use default rate 15,000.
    const baseRate = baseRates[eventType] || 15000;
    const guestCharge = guestCount * 850;

    return baseRate + guestCharge;
  }, [eventType, guests]);

  const buildCheckoutItem = (guestCount) => ({
    title: `${eventType} Event Booking`,
    description: `Name: ${name} | Email: ${email || 'Not provided'} | Phone: ${phone} | Guests: ${guestCount} | Event Date: ${eventDate || 'Not provided'}`,
    amount: estimatedPrice,
    type: 'Event Booking',
    image:
      'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
  });



//   Prevent default form submission (e.preventDefault()).
// Set loading state to show Loader.
// Build guestCount, checkoutItem, and payload for API.
// Call API (submitEventBooking) to save booking details.
// On success:
// Show success message.
// Navigate to /makepayment with checkout data.
// On failure:
// If API unreachable (404), still allow user to proceed to payment.
// Otherwise, show an error message.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    const guestCount = Number(guests) || 0;
    const checkoutItem = buildCheckoutItem(guestCount);
    const payload = {
      name,
      email,
      phone,
      event_date: eventDate,
      event_type: eventType,
      guests: guestCount,
    };

    try {
      const response = await submitEventBooking(payload);

      setLoading(false);
      setSuccess(response.data.message || 'Your event request has been received. Proceeding to payment.');

      navigate('/makepayment', {
        state: {
          checkoutItem,
          paymentNotice: 'Your event request was saved successfully. Complete payment below.',
        },
      });
    } catch (submitError) {
      if (submitError.response?.status === 404 || !submitError.response) {
        setLoading(false);
        navigate('/makepayment', {
          state: {
            checkoutItem,
            paymentNotice:
              'The event booking service is not reachable right now, but you can still continue with payment.',
          },
        });
        return;
      }

      setLoading(false);
      setError(submitError.message || 'Unable to send your event request right now.');
    }
  };

  return (
    <section className="event-page">
      <div className="event-page__hero">
        <p className="event-page__eyebrow">Event Inquiry</p>
        <h2>Tell us about the event you want and we will help you plan it.</h2>
        <p className="event-page__intro">
          Share your event idea, expected guests, and the event date for meetings,
          celebrations, private dining, or social occasions.
        </p>
      </div>

      <div className="event-page__layout">
        <div className="event-page__info">
          <p className="contact-card__label">Event Support</p>
          <h3>From private dinners to large celebrations, we can prepare the right space.</h3>
          <p>
            Our team can help with venue setup, dining packages, guest seating, and service plans
            based on the type of event you want.
          </p>

          <div className="event-page__tags">
            <span>Meetings</span>
            <span>Birthdays</span>
            <span>Private Dining</span>
            <span>Weddings</span>
          </div>
        </div>

        <div className="event-form-card">
          <div className="event-form-card__header">
            <p className="contact-card__label">Tell Us More</p>
            <h3>Book Your Event</h3>
          </div>

          {loading && <Loader />}
          {success && <div className="payment-message payment-message--success">{success}</div>}
          {error && <div className="payment-message payment-message--error">{error}</div>}

          <form className="event-form" onSubmit={handleSubmit}>
            <label className="event-field">
              <span>Full Name</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>

            <label className="event-field">
              <span>Email Address</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            <label className="event-field">
              <span>Phone Number</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>

            <label className="event-field">
              <span>Event Date</span>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
            </label>

            <label className="event-field">
              <span>Event Type</span>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                <option>Corporate Meeting</option>
                <option>Birthday Party</option>
                <option>Wedding Reception</option>
                <option>Private Dinner</option>
                <option>Family Celebration</option>
              </select>
            </label>

            <label className="event-field">
              <span>Expected Guests</span>
              <input type="number" value={guests} onChange={(e) => setGuests(e.target.value)} required />
            </label>

            {guests && (
              <div className="event-estimate">
                <span>Estimated Event Price</span>
{/* 
                toLocaleString() is a built-in JavaScript method available on several object types that converts a value to a locale-sensitive string representation */}
                <strong>KSh {estimatedPrice.toLocaleString()}</strong>
                <p>This estimate is based on your event type and guest count.</p>
              </div>
            )}

            <button type="submit" className="event-submit">
              Send Event Request
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default EventInquiry;
