
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import {
  fetchManagedDiningCatalog,
  fetchManagedRooms,
  getManagedDiningCatalog,
  getManagedRooms,
} from '../utils/adminCatalog';
import { defaultFeaturedPlates } from '../data/diningMenu';





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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);

  // declare the navigate hook

  const navigate  = useNavigate()
  // We shall use the useEffect hook. It enables us to automatically re-render new features incase of any changes
  useEffect(() => {
    fetchManagedRooms().then((rooms) => setRoomCollections(rooms.slice(0, 4))).catch(() => {});
    fetchManagedDiningCatalog()
      .then((catalog) => setFeaturedDishes(catalog.featuredPlates || []))
      .catch(() => {});
  }, []);

  const sendMessage = async () => {
    if (input.trim() === "") return;
    const userMessage = { text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    try {
      const response = await fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: input })
      });
      const data = await response.json();
      const botMessage = { text: data.reply, sender: 'bot' };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error:', error);
    }
  };

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

  const normalizedFeaturedDishes = featuredDishes.map((plate) => ({
    product_name: plate.title,
    product_description: plate.description,
    product_cost: Number(String(plate.price).replace(/[^0-9]/g, '')) || 0,
    product_photo: plate.image,
    isFallback: true,
  }));

  const normalizedDefaultFeaturedDishes = defaultFeaturedPlates.map((plate) => ({
    product_name: plate.title,
    product_description: plate.description,
    product_cost: Number(String(plate.price).replace(/[^0-9]/g, '')) || 0,
    product_photo: plate.image,
    isFallback: true,
  }));

  const resolvedFeaturedDishes = [
    ...normalizedFeaturedDishes,
    ...normalizedDefaultFeaturedDishes.filter(
      (plate) =>
        !normalizedFeaturedDishes.some((featuredDish) => featuredDish.product_name === plate.product_name)
    ),
    ...fallbackDishes.filter(
      (plate) =>
        !normalizedFeaturedDishes.some((featuredDish) => featuredDish.product_name === plate.product_name) &&
        !normalizedDefaultFeaturedDishes.some((featuredDish) => featuredDish.product_name === plate.product_name)
    ),
  ].slice(0, 4);
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
                exactGuestMatch: true,
                quickSearch: true,
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

      {/* Floating Chat Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        style={{
          position: 'fixed',
          left: '20px',
          bottom: '20px',
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0d6adf 0%, #0a5ac7 100%)',
          color: 'white',
          border: '3px solid #fff',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(13, 106, 223, 0.3)',
          zIndex: '999',
          fontSize: '13px',
          fontWeight: '600',
          padding: '0',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          transition: 'all 0.3s ease',
          transform: 'scale(1)',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.12)';
          e.currentTarget.style.boxShadow = '0 12px 32px rgba(13, 106, 223, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(13, 106, 223, 0.3)';
        }}
      >
        <span style={{ fontSize: '20px', marginBottom: '2px' }}>💬</span>
        <span style={{ fontSize: '9px', letterSpacing: '0.5px' }}>CHAT</span>
      </button>

      {/* Floating Chat Widget */}
      {isChatOpen && (
        <div
          style={{
            position: 'fixed',
            left: '20px',
            bottom: '100px',
            width: '380px',
            background: '#fff',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            height: '550px',
            boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
            border: 'none',
            zIndex: '999',
            overflow: 'hidden',
            animation: 'slideUp 0.3s ease'
          }}
        >
          <style>{`
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0d6adf 0%, #0a5ac7 100%)',
              color: 'white',
              padding: '18px 20px',
              fontWeight: '600',
              fontSize: '15px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(13, 106, 223, 0.15)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🏨</span>
              <span>Hotel Assistant</span>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            >
              ✕
            </button>
          </div>
          
          {/* Messages Container */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              background: '#f5f7fa',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {messages.length === 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#999',
                fontSize: '13px',
                textAlign: 'center'
              }}>
                <span>👋 Start a conversation with us!</span>
              </div>
            )}
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '4px'
                }}
              >
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '10px 14px',
                    borderRadius: msg.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.sender === 'user' ? 'linear-gradient(135deg, #f0bc47 0%, #e8a93b 100%)' : '#ffffff',
                    color: msg.sender === 'user' ? '#1a1a1a' : '#333',
                    fontSize: '13px',
                    lineHeight: '1.4',
                    boxShadow: msg.sender === 'user' ? '0 2px 8px rgba(240, 188, 71, 0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
                    wordBreak: 'break-word',
                    fontWeight: msg.sender === 'user' ? '500' : '400'
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          
          {/* Input Area */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              padding: '14px 16px',
              borderTop: '1px solid #e5e8eb',
              background: '#fff'
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid #e5e8eb',
                borderRadius: '6px',
                outline: 'none',
                fontSize: '13px',
                fontFamily: 'inherit',
                background: '#f9f9f9',
                transition: 'border-color 0.2s ease, background 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#0d6adf';
                e.currentTarget.style.background = '#fff';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e5e8eb';
                e.currentTarget.style.background = '#f9f9f9';
              }}
            />
            <button
              onClick={sendMessage}
              style={{
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #0d6adf 0%, #0a5ac7 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                boxShadow: '0 2px 8px rgba(13, 106, 223, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(13, 106, 223, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(13, 106, 223, 0.2)';
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Getproducts;

