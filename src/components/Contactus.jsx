import React from 'react';

const contactChannels = [
  {
    title: 'Reservations Desk',
    detail: '+254 700 123 456',
    note: 'For room bookings, package stays, and private reservations.',
  },
  {
    title: 'Guest Email',
    detail: 'reservations@elitehotels.com',
    note: 'Reach us for booking help, dining requests, or event inquiries.',
  },
  {
    title: 'Visit Us',
    detail: 'Westlands, Nairobi',
    note: 'Open daily with 24/7 reception support.',
  },
];

const quickHelp = [
  'Room reservations and stay planning',
  'Dining bookings and private events',
  'Airport pickup and special requests',
  'General guest support and directions',
];

const Contactus = () => {
  return (
    <section className="contact-page">
      <div className="contact-page__hero">
        <p className="contact-page__eyebrow">Contact Us</p>
        <h2>Talk to our team for bookings, dining plans, and guest support.</h2>
        <p className="contact-page__intro">
          We are here to help you plan your stay, reserve a table, organize an event, or answer
          any question about EliteHotels.
        </p>
      </div>

      <div className="contact-layout">
        <div className="contact-card contact-card--highlight">
          <p className="contact-card__label">Guest Support</p>
          <h3>We make it easy to reach the right team.</h3>
          <p>
            Whether you are booking a room, asking about dining, or preparing for a special visit,
            our team is ready to help with quick and friendly support.
          </p>

          <div className="contact-help-list">
            {quickHelp.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="contact-details">
          {contactChannels.map((channel) => (
            <article className="contact-card" key={channel.title}>
              <p className="contact-card__label">{channel.title}</p>
              <h4>{channel.detail}</h4>
              <p>{channel.note}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="contact-visit-card">
        <div>
          <p className="contact-card__label">Need A Quick Response?</p>
          <h3>Call, email, or visit us and our team will guide you.</h3>
          <p>Reception is available 24/7 to support new and returning guests.</p>
        </div>
        <div className="contact-visit-card__meta">
          <span>Phone: +254 700 123 456</span>
          <span>Email: reservations@elitehotels.com</span>
          <span>Location: Westlands, Nairobi</span>
        </div>
      </div>
    </section>
  );
};

export default Contactus;
