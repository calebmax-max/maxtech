import axios from 'axios';

const EVENT_BOOKING_ENDPOINTS = [
  '/api/event-booking',
  'https://calebtonny.alwaysdata.net/api/event-booking',
  '/api/event_bookings',
  'https://calebtonny.alwaysdata.net/api/event_bookings',
];

const buildFormData = (payload) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value ?? '');
  });
  return formData;
};

export const submitEventBooking = async (payload) => {
  let lastError = null;

  for (const endpoint of EVENT_BOOKING_ENDPOINTS) {
    try {
      if (endpoint.includes('event_bookings')) {
        return await axios.post(endpoint, buildFormData(payload), {
          timeout: 10000,
        });
      }

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
