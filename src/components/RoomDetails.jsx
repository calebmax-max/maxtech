import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { roomOptions, toRoomSlug } from './Rooms';
import { isRoomBookedForRange } from '../utils/roomBookingStorage';

const formatDate = (date) => date.toISOString().split('T')[0];

const getTomorrow = (dateString) => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 1);
  return formatDate(date);
};

const RoomDetails = () => {
  const { roomSlug } = useParams();
  const room = roomOptions.find((item) => toRoomSlug(item.name) === roomSlug);
  const today = formatDate(new Date());
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(getTomorrow(today));
  const roomRate = room ? Number(room.price.replace(/[^0-9]/g, '')) : 0;
  const nights = useMemo(() => {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const difference = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    return difference > 0 ? difference : 1;
  }, [checkIn, checkOut]);
  const totalAmount = roomRate * nights;
  const isBooked = room ? isRoomBookedForRange(room.name, checkIn, checkOut) : false;

  if (!room) {
    return (
      <section className="room-details room-details--missing">
        <div className="room-details__card">
          <p className="rooms-page__eyebrow">Room Not Found</p>
          <h2>This room is not available.</h2>
          <p>Please go back to the rooms page and choose another option.</p>
          <Link className="room-card__cta" to="/rooms">
            Back To Rooms
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="room-details">
      <div className="room-details__hero">
        <img src={room.image} alt={room.name} className="room-details__image" />

        <div className="room-details__content">
          <p className="rooms-page__eyebrow">Room Details</p>
          <h2>{room.name}</h2>
          <p className="room-details__lead">{room.overview}</p>

          <div className="room-details__stats">
            <div>
              <span>Price</span>
              <strong>{room.price} / night</strong>
            </div>
            <div>
              <span>Capacity</span>
              <strong>{room.guests}</strong>
            </div>
            <div>
              <span>Room Size</span>
              <strong>{room.size}</strong>
            </div>
            <div>
              <span>Bed Type</span>
              <strong>{room.bed}</strong>
            </div>
          </div>

          <div className="room-details__panel">
            <h3>About This Room</h3>
            <p>{room.description}</p>
            <p>{room.idealFor}</p>
          </div>

          <div className="room-details__panel">
            <h3>Included Features</h3>
            <div className="room-card__features">
              {room.features.map((feature) => (
                <span key={feature}>{feature}</span>
              ))}
            </div>
          </div>

          <div className="room-details__panel">
            <h3>Select Stay Dates</h3>
            {isBooked && (
              <p className="room-details__availability room-details__availability--booked">
                This room is already booked for the selected dates.
              </p>
            )}
            <div className="room-details__booking">
              <label className="room-details__field">
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

              <label className="room-details__field">
                <span>Check-Out</span>
                <input
                  type="date"
                  min={getTomorrow(checkIn)}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </label>
            </div>

            <div className="room-details__total">
              <span>Total for {nights} night{nights > 1 ? 's' : ''}</span>
              <strong>KSh {totalAmount.toLocaleString()}</strong>
            </div>
          </div>

          <div className="room-details__actions">
            {isBooked ? (
              <span className="room-card__cta room-card__cta--disabled">Already Booked</span>
            ) : (
              <Link
                className="room-card__cta"
                to="/makepayment"
                state={{
                  checkoutItem: {
                    title: room.name,
                    description: `${room.description} Check-In: ${checkIn}, Check-Out: ${checkOut}, Nights: ${nights}`,
                    image: room.image,
                    amount: totalAmount,
                    type: 'Room Booking',
                    bookingDetails: {
                      roomName: room.name,
                      checkIn,
                      checkOut,
                      nights,
                    },
                  },
                }}
              >
                Book This Room
              </Link>
            )}
            <Link className="room-details__back" to="/rooms">
              Back To Rooms
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RoomDetails;
