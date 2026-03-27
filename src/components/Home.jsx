
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import {
  fetchManagedDiningCatalog,
  fetchManagedRooms,
  getManagedDiningCatalog,
  getManagedRooms,
} from '../utils/adminCatalog';


//formatDate — Converts a Date object to "YYYY-MM-DD" string format (for <input type="date">)
//new Date().toISOString() → "2025-07-10T12:00:00.000Z"
//.split('T')[0] → "2025-07-10"
//getTomorrow — Takes a date string, adds 1 day, and returns the formatted result
//today — Today's date as a string
const Getproducts = () => {
  const formatDate = (date) => date.toISOString().split('T')[0];
  const getTomorrow = (dateString) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() + 1);
    return formatDate(date);
  };
  const today = formatDate(new Date());

  // Initialize hooks to help you manage the state of your application
  const [roomCollections, setRoomCollections] = useState(() => getManagedRooms().slice(0, 4));
  const [featuredDishes, setFeaturedDishes] = useState(() => getManagedDiningCatalog().featuredPlates);
  const [quickCheckIn, setQuickCheckIn] = useState(today);
  const [quickCheckOut, setQuickCheckOut] = useState(getTomorrow(today));
  const [quickGuests, setQuickGuests] = useState("2");

  // declare the navigate hook

  const navigate  = useNavigate()
  // We shall use the useEffect hook. It enables us to automatically re-render new features incase of any changes
  useEffect(() => {
    fetchManagedRooms().then((rooms) => setRoomCollections(rooms.slice(0, 4))).catch(() => {});
    fetchManagedDiningCatalog()
      .then((catalog) => setFeaturedDishes(catalog.featuredPlates || []))
      .catch(() => {});
  }, []);

  //Backup dishes if the API returns no data
  const fallbackDishes = [
    {
      product_name: 'Gourmet Burger',
      product_description: 'Juicy grilled burger served with crisp lettuce, tomato, and house sauce.',
      product_cost: 950,
      product_photo: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
      isFallback: true,
    },
    {
      product_name: 'Grilled Steak',
      product_description: 'Tender steak finished with herbs and a rich pan sauce for a premium dinner.',
      product_cost: 1850,
      product_photo: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
      isFallback: true,
    },
    {
      product_name: 'Pasta Primavera',
      product_description: 'Creamy pasta tossed with garden vegetables and parmesan.',
      product_cost: 1100,
      product_photo: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80',
      isFallback: true,
    },
    {
      product_name: 'Seafood Platter',
      product_description: 'A chef-curated seafood selection with fresh seasonal garnish.',
      product_cost: 2200,
      product_photo: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80',
      isFallback: true,
    },
  ];

  const resolvedFeaturedDishes =
    featuredDishes.length > 0
      ? featuredDishes.map((plate) => ({
          product_name: plate.title,
          product_description: plate.description,
          product_cost: Number(String(plate.price).replace(/[^0-9]/g, '')) || 0,
          product_photo: plate.image,
          isFallback: true,
        }))
      : fallbackDishes;
  const amenityHighlights = [
    {
      title: 'Luxury Accommodation',
      text: 'Spacious suites, premium bedding, and calm interiors designed for restful stays.',
    },
    {
      title: 'Signature Dining',
      text: 'Freshly prepared meals, chef specials, and a warm restaurant atmosphere every day.',
    },
    {
      title: 'Events & Meetings',
      text: 'Elegant spaces for business meetings, family celebrations, and private dinners.',
    },
  ];

  return (
    <div className='hotel-page'>
      <section className="hotel-hero" id="top">
        <div className="hotel-hero__overlay">
          <div className="hotel-hero__content">
            <p className="hotel-hero__eyebrow">Luxury Stay And Fine Dining</p>
            <h1>ELITE HOTELS</h1>
            <h2>WELCOME</h2>
            <div className="hotel-hero__divider"></div>
            <p className="hotel-hero__subtitle">
              Experience Luxury &amp; Fine Dining in One Place
            </p>

            <div className="hotel-hero__actions">
              <button
                className="hotel-action hotel-action--blue"
                type="button"
                onClick={() => navigate('/rooms')}
              >
                <span>Book a Room</span>
                <span>&rsaquo;</span>
              </button>
              <button
                className="hotel-action hotel-action--green"
                type="button"
                onClick={() => navigate('/dining')}
              >
                <span>Order Food</span>
                <span>&rsaquo;</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="booking-panel" id="booking">
        <h3>Quick Booking</h3>
        <div className="booking-panel__grid">
          <label className="booking-field">
            <span>Check-In</span>
            <input
              type="date"
              min={today}
              value={quickCheckIn}
              onChange={(e) => {
                const nextCheckIn = e.target.value;
                setQuickCheckIn(nextCheckIn);
                if (quickCheckOut <= nextCheckIn) {
                  setQuickCheckOut(getTomorrow(nextCheckIn));
                }
              }}
            />
          </label>

          <label className="booking-field">
            <span>Check-Out</span>
            <input
              type="date"
              min={getTomorrow(quickCheckIn)}
              value={quickCheckOut}
              onChange={(e) => setQuickCheckOut(e.target.value)}
            />
          </label>

          <label className="booking-field">
            <span>Guests</span>
            <select value={quickGuests} onChange={(e) => setQuickGuests(e.target.value)}>
              <option value="1">1 Guest</option>
              <option value="2">2 Guests</option>
              <option value="4">4 Guests</option>
            </select>
          </label>

          <button
            className="booking-search"
            type="button"
            onClick={() => navigate('/rooms', {
              state: {
                checkIn: quickCheckIn,
                checkOut: quickCheckOut,
                guests: quickGuests,
              },
            })}
          >
           Search &rsaquo; {/* ;state object being passed forward when navigating — it’s essentially the payload of booking details that the next page will consume. In your case */}
          </button>
        </div>
      </section>

      <section className="feature-sections">
        <div className="feature-panel" id="rooms">
          <div className="feature-panel__heading">
            <span></span>
            <h3>Featured Rooms</h3>
            <span></span>
          </div>

          <div className="feature-card-grid">
            {roomCollections.map((room) => (
              <div className="feature-card" key={room.name}>
                <img src={room.image} alt={room.name} className="feature-card__image" />
                <div className="feature-card__body">
                  <h5>{room.name}</h5>
                </div>
              </div>
            ))}
          </div>

          <button
            className="feature-cta feature-cta--blue"
            type="button"
            onClick={() => navigate('/rooms')}
          >
            View All Rooms &rsaquo;
          </button>
        </div>

        <div className="feature-panel" id="dining">
          <div className="feature-panel__heading">
            <span></span>
            <h3>Popular Dishes</h3>
            <span></span>
          </div>

          <div className="feature-card-grid">
            {resolvedFeaturedDishes.map((product) => (
              <div className="feature-card feature-card--interactive" key={product.product_id || product.product_name}>
                <img
                  src={product.product_photo}
                  alt={product.product_name}
                  className="feature-card__image"
                />

                <div className="feature-card__body">
                  <h5>{product.product_name}</h5>
                </div>
              </div>
            ))}
          </div>

          <button
            className="feature-cta feature-cta--green"
            type="button"
            onClick={() => navigate('/dining')}
          >
            View Full Menu &rsaquo;
          </button>
        </div>
      </section>

      <section className="experience-section" id="experiences">
        <div className="experience-section__intro">
          <p className="experience-section__eyebrow">Why Guests Choose Us</p>
          <h3>Comfort, cuisine, and service brought together in one experience.</h3>
          <p>
            From relaxing rooms to memorable dining, our hotel and restaurant system is built to
            make every visit smooth, welcoming, and enjoyable.
          </p>
        </div>

        <div className="experience-grid">
          {amenityHighlights.map((item) => (
            <div className="experience-card" key={item.title}>
              <h4>{item.title}</h4>
              <p>{item.text}</p>
            </div>
          ))}
        </div>

        <div className="events-showcase">
          <div className="events-showcase__content">
            <p className="visit-banner__label">Events &amp; Meetings</p>
            <h4>Elegant spaces for business meetings, family celebrations, and private dinners.</h4>
            <p>
              Host productive conferences, intimate gatherings, and memorable social occasions in
              beautifully prepared spaces with attentive hospitality.
            </p>
            <div className="events-showcase__meta">
              <span>Up to 200 guests</span>
              <span>Custom dining packages</span>
              <span>Indoor &amp; garden setup</span>
            </div>
            <div className="events-showcase__actions">
              <button
                className="feature-cta feature-cta--green"
                type="button"
                onClick={() => navigate('/events')}
              >
                Book Your Event &rsaquo;
              </button>
            </div>
          </div>
        </div>

        <div className="visit-banner">
          <div>
            <p className="visit-banner__label">Visit Information</p>
            <h4>Open Daily for Room Bookings and Restaurant Service</h4>
            <p>Reception: 24/7 | Restaurant Hours: 6:30 AM - 11:00 PM</p>
          </div>
          <button
            className="feature-cta feature-cta--blue"
            type="button"
            onClick={() => navigate('/signup')}
          >
            Reserve Your Stay &rsaquo;
          </button>
        </div>
      </section>
    </div>
  )
}

export default Getproducts;

