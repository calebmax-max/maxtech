import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getRoomBookings, getStoredRoomBookings, isRoomBookedForRange } from '../utils/roomBookingStorage';

export const toRoomSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const getGuestCount = (guestLabel) => {
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

export const roomOptions = [
  {
    name: 'Deluxe King Room',
    price: 'KSh 12,500',
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    description:
      'A calm, modern room with warm lighting, a king bed, and plenty of space for a relaxing stay.',
    overview:
      'This room is ideal for couples and solo travelers who want a comfortable premium stay with a calm interior and practical in-room amenities.',
    guests: '2 Guests',
    size: '38 m2',
    bed: '1 King Bed',
    idealFor: 'Couples and short luxury stays',
    features: ['Smart TV', 'Free Wi-Fi', 'Air Conditioning', 'Mini Fridge'],
  },
  {
    name: 'Executive Suite',
    price: 'KSh 19,800',
    image:
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
    description:
      'Designed for business and comfort, this suite includes a lounge area and a premium work setup.',
    overview:
      'The executive suite balances work and rest with a separate sitting space, reliable connectivity, and thoughtful service for professionals.',
    guests: '2 Adults',
    size: '52 m2',
    bed: '1 King Bed',
    idealFor: 'Business trips and executive stays',
    features: ['Smart TV', 'Work Desk', 'Coffee Station', 'Room Service'],
  },
  {
    name: 'Family Comfort Room',
    price: 'KSh 16,200',
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    description:
      'Perfect for families, with extra sleeping space, cozy seating, and an easy layout for shared stays.',
    overview:
      'This room gives families a practical and welcoming setup, with enough space for children, luggage, and quiet evening rest.',
    guests: '4 Guests',
    size: '48 m2',
    bed: '2 Queen Beds',
    idealFor: 'Family holidays and group stays',
    features: ['TV', 'Free Wi-Fi', 'Breakfast', 'Extra Bedding'],
  },
  {
    name: 'Garden View Room',
    price: 'KSh 13,900',
    image:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    description:
      'Wake up to green views and a quiet atmosphere in a room styled for peaceful weekend escapes.',
    overview:
      'With relaxing garden-facing windows and a soft interior palette, this room creates a restful mood from check-in to checkout.',
    guests: '2 Guests',
    size: '35 m2',
    bed: '1 Queen Bed',
    idealFor: 'Weekend getaways and quiet retreats',
    features: ['Balcony', 'TV', 'Rain Shower', 'Free Wi-Fi'],
  },
  {
    name: 'Presidential Suite',
    price: 'KSh 32,000',
    image:
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
    description:
      'A signature luxury suite with elegant finishes, generous lounge space, and premium in-room amenities.',
    overview:
      'Our highest-tier suite offers a private-lounge feel, refined finishes, and elevated service for guests who want a standout experience.',
    guests: '4 Guests',
    size: '85 m2',
    bed: '1 King Bed',
    idealFor: 'VIP stays and high-end hosting',
    features: ['Large TV', 'Private Lounge', 'Jacuzzi', 'Butler Service'],
  },
  {
    name: 'Twin Business Room',
    price: 'KSh 11,400',
    image:
      'https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80',
    description:
      'Ideal for colleagues or friends, offering two comfortable beds and practical features for short stays.',
    overview:
      'A functional choice for shared work travel, with comfortable twin sleeping arrangements and easy-to-use business essentials.',
    guests: '2 Guests',
    size: '32 m2',
    bed: '2 Twin Beds',
    idealFor: 'Friends and business partners',
    features: ['TV', 'Wi-Fi', 'Desk Space', 'Daily Housekeeping'],
  },
  {
    name: 'Honeymoon Suite',
    price: 'KSh 21,500',
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    description:
      'A romantic suite with elegant decor, soft lighting, and a warm atmosphere for special moments.',
    overview:
      'Designed for celebrations, this suite pairs privacy, comfort, and a touch of luxury for memorable romantic stays.',
    guests: '2 Guests',
    size: '50 m2',
    bed: '1 King Bed',
    idealFor: 'Couples and anniversaries',
    features: ['Smart TV', 'Bathtub', 'Breakfast', 'Private Balcony'],
  },
  {
    name: 'City View Studio',
    price: 'KSh 14,200',
    image:
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
    description:
      'A bright studio room overlooking the city skyline with modern finishes and a stylish sitting corner.',
    overview:
      'This studio is great for travelers who enjoy a modern urban feel, clean lines, and a good view of the city around them.',
    guests: '2 Guests',
    size: '36 m2',
    bed: '1 Queen Bed',
    idealFor: 'City breaks and solo stays',
    features: ['Smart TV', 'Wi-Fi', 'City View', 'Coffee Station'],
  },
  {
    name: 'Royal Terrace Room',
    price: 'KSh 18,700',
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    description:
      'A refined room with private terrace access, comfortable seating, and a more open indoor-outdoor feel.',
    overview:
      'Guests who enjoy fresh air and private outdoor moments will appreciate the terrace and spacious design of this room.',
    guests: '2 Guests',
    size: '44 m2',
    bed: '1 King Bed',
    idealFor: 'Luxury leisure stays',
    features: ['Terrace', 'Smart TV', 'Mini Bar', 'Rain Shower'],
  },
  {
    name: 'Junior Suite',
    price: 'KSh 17,300',
    image:
      'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=1200&q=80',
    description:
      'A spacious step up from the standard room with a lounge corner and upgraded comfort touches.',
    overview:
      'The junior suite offers extra breathing room and a polished layout, making it a strong mid-luxury option.',
    guests: '2 Guests',
    size: '46 m2',
    bed: '1 King Bed',
    idealFor: 'Long weekends and premium comfort',
    features: ['TV', 'Sofa Lounge', 'Wi-Fi', 'Room Service'],
  },
  {
    name: 'Accessible Comfort Room',
    price: 'KSh 12,900',
    image:
      'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80',
    description:
      'A carefully arranged room with step-free access and comfortable movement throughout the space.',
    overview:
      'This room is planned for convenience and ease, while still offering the same comfort and hotel style as the rest of the property.',
    guests: '2 Guests',
    size: '40 m2',
    bed: '1 Queen Bed',
    idealFor: 'Accessible and comfortable stays',
    features: ['Accessible Bathroom', 'TV', 'Wi-Fi', 'Wide Entry'],
  },
  {
    name: 'Poolside Retreat Room',
    price: 'KSh 15,800',
    image:
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
    description:
      'A refreshing room located near the pool area with a resort-style atmosphere and relaxed design.',
    overview:
      'This room is excellent for guests who want easy pool access, a bright setting, and a laid-back holiday feel.',
    guests: '2 Guests',
    size: '37 m2',
    bed: '1 Queen Bed',
    idealFor: 'Holiday stays and resort relaxation',
    features: ['Pool Access', 'TV', 'Wi-Fi', 'Sun Lounge Chairs'],
  },
  {
    name: 'Mountain View Suite',
    price: 'KSh 20,600',
    image:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    description:
      'A scenic suite with wide windows, a calm color palette, and elevated comfort for longer stays.',
    overview:
      'Guests who love dramatic views and quiet mornings will enjoy the suite layout and the natural scenery beyond the windows.',
    guests: '3 Guests',
    size: '54 m2',
    bed: '1 King Bed',
    idealFor: 'Nature lovers and scenic escapes',
    features: ['View Deck', 'Smart TV', 'Mini Bar', 'Breakfast'],
  },
  {
    name: 'Courtyard Classic Room',
    price: 'KSh 10,900',
    image:
      'https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80',
    description:
      'A simple and elegant room facing the inner courtyard with reliable essentials for everyday comfort.',
    overview:
      'This is a practical favorite for short stays, balancing value, comfort, and a peaceful courtyard-facing position.',
    guests: '2 Guests',
    size: '30 m2',
    bed: '1 Double Bed',
    idealFor: 'Budget-friendly quality stays',
    features: ['TV', 'Wi-Fi', 'Wardrobe', 'Work Table'],
  },
  {
    name: 'Skyline Penthouse Suite',
    price: 'KSh 36,500',
    image:
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
    description:
      'A premium top-floor suite with expansive views, large entertaining space, and elevated privacy.',
    overview:
      'For guests who want a statement stay, the penthouse suite offers luxury space, skyline views, and a truly premium atmosphere.',
    guests: '4 Guests',
    size: '92 m2',
    bed: '1 King Bed',
    idealFor: 'Luxury escapes and private hosting',
    features: ['Panoramic View', 'Large TV', 'Private Dining', 'Jacuzzi'],
  },
  {
    name: 'Wellness Spa Room',
    price: 'KSh 18,100',
    image:
      'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80',
    description:
      'A restful room inspired by spa comfort with soothing tones and wellness-focused in-room touches.',
    overview:
      'The wellness room is made for guests who want a quiet, restorative stay with comfort details that support rest and reset.',
    guests: '2 Guests',
    size: '42 m2',
    bed: '1 King Bed',
    idealFor: 'Rest, spa trips, and quiet weekends',
    features: ['Aromatherapy Kit', 'Smart TV', 'Yoga Mat', 'Rain Shower'],
  },
];

const Rooms = () => {
  const location = useLocation();
  const searchState = location.state || {};
  const defaultCheckIn = searchState.checkIn || formatDate(new Date());
  const defaultCheckOut = searchState.checkOut || getTomorrow(defaultCheckIn);
  const requestedGuests = Number(searchState.guests || 0);
  const [storedBookings, setStoredBookings] = useState([]);

  useEffect(() => {
    setStoredBookings(getStoredRoomBookings());
  }, []);

  const orderedRooms = useMemo(() => {
    const roomsWithStatus = roomOptions.map((room) => {
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
  }, [requestedGuests, searchState.checkIn, searchState.checkOut, storedBookings]);

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
