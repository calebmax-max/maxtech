import axios from 'axios';
import { defaultRoomOptions } from '../data/roomsCatalog';
import {
  defaultDiningCategories,
  defaultFeaturedPlates,
  createFoodCheckoutItem,
} from '../data/diningMenu';
import { buildApiUrl } from './api';

const ROOMS_KEY = 'admin_rooms_catalog';
const DINING_KEY = 'admin_dining_catalog';

const clone = (value) => JSON.parse(JSON.stringify(value));

const defaultDiningCatalog = () => ({
  categories: clone(defaultDiningCategories),
  featuredPlates: clone(defaultFeaturedPlates),
});

export const getManagedRooms = () => {
  try {
    const rawValue = localStorage.getItem(ROOMS_KEY);
    return rawValue ? JSON.parse(rawValue) : clone(defaultRoomOptions);
  } catch (error) {
    return clone(defaultRoomOptions);
  }
};

export const cacheManagedRooms = (rooms) => {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
};

export const fetchManagedRooms = async () => {
  try {
    const response = await axios.get(buildApiUrl('/api/catalog/rooms'));
    const rooms = response.data.rooms || clone(defaultRoomOptions);
    cacheManagedRooms(rooms);
    return rooms;
  } catch (error) {
    const rooms = getManagedRooms();
    cacheManagedRooms(rooms);
    return rooms;
  }
};

export const saveManagedRooms = async (rooms) => {
  try {
    const response = await axios.put(
      buildApiUrl('/api/admin/catalog/rooms'),
      { rooms },
      { withCredentials: true }
    );
    const nextRooms = response.data.rooms || rooms;
    cacheManagedRooms(nextRooms);
    return nextRooms;
  } catch (error) {
    cacheManagedRooms(rooms);
    return rooms;
  }
};

export const getManagedDiningCatalog = () => {
  try {
    const rawValue = localStorage.getItem(DINING_KEY);
    return rawValue ? JSON.parse(rawValue) : defaultDiningCatalog();
  } catch (error) {
    return defaultDiningCatalog();
  }
};

export const cacheManagedDiningCatalog = (catalog) => {
  localStorage.setItem(DINING_KEY, JSON.stringify(catalog));
};

export const fetchManagedDiningCatalog = async () => {
  try {
    const response = await axios.get(buildApiUrl('/api/catalog/dining'));
    const catalog = response.data.catalog || defaultDiningCatalog();
    cacheManagedDiningCatalog(catalog);
    return catalog;
  } catch (error) {
    const catalog = getManagedDiningCatalog();
    cacheManagedDiningCatalog(catalog);
    return catalog;
  }
};

export const saveManagedDiningCatalog = async (catalog) => {
  try {
    const response = await axios.put(
      buildApiUrl('/api/admin/catalog/dining'),
      { catalog },
      { withCredentials: true }
    );
    const nextCatalog = response.data.catalog || catalog;
    cacheManagedDiningCatalog(nextCatalog);
    return nextCatalog;
  } catch (error) {
    cacheManagedDiningCatalog(catalog);
    return catalog;
  }
};

export const getManagedFoodCheckoutItems = () => {
  const { categories, featuredPlates } = getManagedDiningCatalog();

  return [
    ...featuredPlates.map((plate) =>
      createFoodCheckoutItem({
        title: plate.title,
        description: plate.description,
        image: plate.image,
        price: plate.price,
        type: 'Featured Dish',
        category: plate.tag,
      })
    ),
    ...categories.flatMap((category) =>
      category.items.map((item) =>
        createFoodCheckoutItem({
          title: item.name,
          description: `${category.title} selection`,
          image: item.image,
          price: item.price,
          type: 'Food Order',
          category: category.title,
        })
      )
    ),
  ];
};
