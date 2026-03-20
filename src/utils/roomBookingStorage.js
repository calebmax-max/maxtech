const ROOM_BOOKINGS_KEY = 'elitehotels-room-bookings';

const isBrowser = typeof window !== 'undefined';

const sortBookings = (bookings) =>
  [...bookings].sort((first, second) => first.checkIn.localeCompare(second.checkIn));

export const getStoredRoomBookings = () => {
  if (!isBrowser) {
    return [];
  }

  try {
    const savedBookings = window.localStorage.getItem(ROOM_BOOKINGS_KEY);
    return savedBookings ? JSON.parse(savedBookings) : [];
  } catch (error) {
    console.error('Unable to read stored room bookings.', error);
    return [];
  }
};

export const saveRoomBooking = (booking) => {
  const currentBookings = getStoredRoomBookings();
  const nextBookings = sortBookings([...currentBookings, booking]);

  if (isBrowser) {
    window.localStorage.setItem(ROOM_BOOKINGS_KEY, JSON.stringify(nextBookings));
  }

  return nextBookings;
};

export const getRoomBookings = (roomName) =>
  getStoredRoomBookings().filter((booking) => booking.roomName === roomName);

export const isRoomBookedForRange = (roomName, checkIn, checkOut) => {
  if (!checkIn || !checkOut) {
    return false;
  }

  return getRoomBookings(roomName).some(
    (booking) => checkIn < booking.checkOut && checkOut > booking.checkIn
  );
};
