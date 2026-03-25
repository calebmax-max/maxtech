import axios from 'axios';
import { buildApiUrl } from './api';

const ROOM_BOOKING_ENDPOINTS = [
  '/api/room_bookings',
  buildApiUrl('/room_bookings'),
];

const FOOD_ORDER_ENDPOINTS = [
  '/api/food_orders',
  buildApiUrl('/food_orders'),
];

const STAY_BOOKING_ENDPOINTS = [
  '/api/stay_bookings',
  buildApiUrl('/stay_bookings'),
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
