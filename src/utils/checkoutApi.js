import axios from 'axios';

const ROOM_BOOKING_ENDPOINTS = [
  '/api/room_bookings',
  'https://calebtonny.alwaysdata.net/api/room_bookings',
];

const FOOD_ORDER_ENDPOINTS = [
  '/api/food_orders',
  'https://calebtonny.alwaysdata.net/api/food_orders',
];

const STAY_BOOKING_ENDPOINTS = [
  '/api/stay_bookings',
  'https://calebtonny.alwaysdata.net/api/stay_bookings',
  'https://calebtonny.alwaysdata.net/stay_bookings.php',
];

const postCheckoutData = async (endpoints, payload) => {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      return await axios.post(endpoint, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

export const submitRoomBooking = (payload) => postCheckoutData(ROOM_BOOKING_ENDPOINTS, payload);

export const submitFoodOrder = (payload) => postCheckoutData(FOOD_ORDER_ENDPOINTS, payload);

export const submitStayBooking = (payload) => postCheckoutData(STAY_BOOKING_ENDPOINTS, payload);
