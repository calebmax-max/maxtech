import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getRoomBookings, getStoredRoomBookings, isRoomBookedForRange } from '../utils/roomBookingStorage';
import { defaultRoomOptions } from '../data/roomsCatalog';
import { fetchManagedRooms, getManagedRooms } from '../utils/adminCatalog';
//toRoomSlug — Converts room name to URL slug
export const toRoomSlug = (name) =>

//   "Deluxe King Room"
//     ↓ .toLowerCase()
// "deluxe king room"
//     ↓ .replace(/[^a-z0-9]+/g, '-')   → Replace non-alphanumeric chars with hyphens
// "deluxe-king-room"
//     ↓ .replace(/^-|-$/g, '')          → Trim leading/trailing hyphens
// "deluxe-king-room"
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const getGuestCount = (guestLabel) => {
  // getGuestCount — Extracts number from guest label
  //String(guestLabel) — Safely converts to string
//.match(/\d+/) — Finds first sequence of digits
//?.[0] — Optional chaining (returns undefined if no match)
//|| 0 — Fallback to 0
  const parsed = Number(String(guestLabel).match(/\d+/)?.[0] || 0);
  return parsed;
};

const getRoomAmount = (priceLabel) => Number(String(priceLabel).replace(/[^0-9]/g, ''));
const formatDate = (date) => date.toISOString().split('T')[0];

const getTomorrow = (dateString) => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 1);
  return formatDate(date);
};

export const roomOptions = defaultRoomOptions;

const Rooms = () => {
  const location = useLocation();
  const searchState = location.state || {};
  const defaultCheckIn = searchState.checkIn || formatDate(new Date());
  const defaultCheckOut = searchState.checkOut || getTomorrow(defaultCheckIn);
  const requestedGuests = Number(searchState.guests || 0);
  const [storedBookings, setStoredBookings] = useState([]);
  const [managedRooms, setManagedRooms] = useState(roomOptions);

  useEffect(() => {
    setStoredBookings(getStoredRoomBookings());
    setManagedRooms(getManagedRooms());

    let active = true;

    fetchManagedRooms()
      .then((rooms) => {
        if (active) {
          setManagedRooms(rooms);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const orderedRooms = useMemo(() => {
    const roomsWithStatus = managedRooms.map((room) => {
      const roomBookings = storedBookings.filter((booking) => booking.roomName === room.name);
      const isUnavailableForSearch =
        Boolean(searchState.checkIn && searchState.checkOut) &&
        isRoomBookedForRange(room.name, searchState.checkIn, searchState.checkOut);

      return {
        ...room,
        roomBookings,
        isBooked: roomBookings.length > 0,
        isUnavailableForSearch,
      };
    });

    if (!requestedGuests) {
      return roomsWithStatus.sort((first, second) => Number(first.isBooked) - Number(second.isBooked));
    }

    const matchingRooms = roomsWithStatus
      .filter((room) => getGuestCount(room.guests) >= requestedGuests)
      .sort((first, second) => {
        if (first.isUnavailableForSearch !== second.isUnavailableForSearch) {
          return Number(first.isUnavailableForSearch) - Number(second.isUnavailableForSearch);
        }

        return getGuestCount(first.guests) - getGuestCount(second.guests);
      });

    const nonMatchingRooms = roomsWithStatus
      .filter((room) => getGuestCount(room.guests) < requestedGuests)
      .sort((first, second) => Number(first.isUnavailableForSearch) - Number(second.isUnavailableForSearch));

    return [...matchingRooms, ...nonMatchingRooms];
  }, [managedRooms, requestedGuests, searchState.checkIn, searchState.checkOut, storedBookings]);

  const featuredRoom = orderedRooms[0] || null;
  const remainingRooms = orderedRooms.slice(1);
  const availableMatches = orderedRooms.filter(
    (room) => getGuestCount(room.guests) >= requestedGuests && !room.isUnavailableForSearch
  );
  const searchMatched = requestedGuests ? availableMatches.length > 0 : false;
  const noAvailableRoom =
    requestedGuests > 0 &&
    Boolean(searchState.checkIn && searchState.checkOut) &&
    availableMatches.length === 0;

  const getRoomBookingState = (room) => ({
    checkoutItem: {
      title: room.name,
      description: `${room.description} Check-In: ${defaultCheckIn}, Check-Out: ${defaultCheckOut}`,
      image: room.image,
      amount: getRoomAmount(room.price),
      type: 'Room Booking',
      bookingDetails: {
        roomName: room.name,
        checkIn: defaultCheckIn,
        checkOut: defaultCheckOut,
        nights: 1,
      },
    },
  });

  const getBookedSummary = (room) => {
    const latestBooking = getRoomBookings(room.name)[0];

    if (!latestBooking) {
      return 'Available';
    }

    return `Booked: ${latestBooking.checkIn} to ${latestBooking.checkOut}`;
  };

  if (!featuredRoom) {
    return null;
  }

  return (
    <section className="rooms-page">
      <div className="rooms-page__hero">
        <p className="rooms-page__eyebrow">Stay In Style</p>
        <h2>Choose a room that matches your comfort, budget, and travel plan.</h2>
        <p className="rooms-page__intro">
          From cozy business rooms to spacious family suites, each room is prepared with
          thoughtful amenities for a smooth and relaxing stay.
        </p>

        {requestedGuests > 0 && (
          <div className={`rooms-search-banner ${searchMatched ? 'rooms-search-banner--success' : 'rooms-search-banner--warning'}`}>
            <strong>
              {noAvailableRoom
                ? `No available room for ${requestedGuests} guest${requestedGuests > 1 ? 's' : ''}`
                : searchMatched
                ? `Best match for ${requestedGuests} guest${requestedGuests > 1 ? 's' : ''}`
                : `No exact match for ${requestedGuests} guest${requestedGuests > 1 ? 's' : ''}`}
            </strong>
            <span>
              {noAvailableRoom
                ? `All matching rooms are already booked for ${searchState.checkIn} to ${searchState.checkOut}.`
                : searchState.checkIn && searchState.checkOut
                ? `Check-In: ${searchState.checkIn} | Check-Out: ${searchState.checkOut}`
                : 'Showing the closest available room options first.'}
            </span>
          </div>
        )}

        <div className="rooms-page__stats">
          <div>
            <strong>{orderedRooms.length}+</strong>
            <span>Room choices</span>
          </div>
          <div>
            <strong>24/7</strong>
            <span>Guest support</span>
          </div>
          <div>
            <strong>4.9</strong>
            <span>Guest rating</span>
          </div>
        </div>
      </div>

      <article className={`rooms-feature ${searchMatched ? 'rooms-feature--match' : ''}`}>
        <img className="rooms-feature__image" src={featuredRoom.image} alt={featuredRoom.name} />

        <div className="rooms-feature__content">
          <p className="rooms-feature__label">Featured Stay</p>
          <div className="rooms-feature__header">
            <div>
              {featuredRoom.isBooked && (
                <p className={`room-card__status ${featuredRoom.isUnavailableForSearch ? 'room-card__status--booked' : ''}`}>
                  {featuredRoom.isUnavailableForSearch ? 'Booked For Selected Dates' : getBookedSummary(featuredRoom)}
                </p>
              )}
              <h3>{featuredRoom.name}</h3>
              <p>{featuredRoom.overview}</p>
            </div>
            <div className="rooms-feature__price">
              <strong>{featuredRoom.price}</strong>
              <span>per night</span>
            </div>
          </div>

          <div className="rooms-feature__meta">
            <span>{featuredRoom.guests}</span>
            <span>{featuredRoom.size}</span>
            <span>{featuredRoom.bed}</span>
            <span>{featuredRoom.idealFor}</span>
          </div>

          <div className="room-card__features">
            {featuredRoom.features.map((feature) => (
              <span key={feature}>{feature}</span>
            ))}
          </div>

          <div className="room-card__actions">
            {featuredRoom.isUnavailableForSearch ? (
              <span className="room-card__cta room-card__cta--disabled">Booked</span>
            ) : (
              <Link
                className="room-card__cta room-card__cta--secondary"
                to="/makepayment"
                state={getRoomBookingState(featuredRoom)}
              >
                Book Now
              </Link>
            )}
            <Link className="room-card__cta" to={`/rooms/${toRoomSlug(featuredRoom.name)}`}>
              View Room Details
            </Link>
          </div>
        </div>
      </article>

      <div className="rooms-list">
        {remainingRooms.map((room, index) => (
          <article className={`room-showcase ${index % 2 === 1 ? 'room-showcase--reverse' : ''}`} key={room.name}>
            <img className="room-showcase__image" src={room.image} alt={room.name} />

            <div className="room-showcase__content">
              <div className="room-showcase__top">
                <div>
                  <p className="room-card__capacity">{room.guests}</p>
                  {room.isBooked && (
                    <p className={`room-card__status ${room.isUnavailableForSearch ? 'room-card__status--booked' : ''}`}>
                      {room.isUnavailableForSearch ? 'Booked For Selected Dates' : getBookedSummary(room)}
                    </p>
                  )}
                  <h3>{room.name}</h3>
                </div>
                <div className="room-card__price">
                  <strong>{room.price}</strong>
                  <span>per night</span>
                </div>
              </div>

              <p className="room-card__description">{room.description}</p>

              <div className="room-showcase__specs">
                <span>{room.size}</span>
                <span>{room.bed}</span>
                <span>{room.idealFor}</span>
              </div>

              <div className="room-card__features">
                {room.features.map((feature) => (
                  <span key={feature}>{feature}</span>
                ))}
              </div>

              <div className="room-card__actions">
                {room.isUnavailableForSearch ? (
                  <span className="room-card__cta room-card__cta--disabled">Booked</span>
                ) : (
                  <Link
                    className="room-card__cta room-card__cta--secondary"
                    to="/makepayment"
                    state={getRoomBookingState(room)}
                  >
                    Book Now
                  </Link>
                )}
                <Link className="room-card__cta" to={`/rooms/${toRoomSlug(room.name)}`}>
                  View Room Details
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Rooms;
