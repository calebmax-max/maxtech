import { defaultRoomOptions } from '../data/roomsCatalog';
import { defaultDiningCategories, defaultFeaturedPlates, createFoodCheckoutItem } from '../data/diningMenu';

const ROOMS_KEY = 'admin_rooms_catalog';
const DINING_KEY = 'admin_dining_catalog';

const clone = (value) => JSON.parse(JSON.stringify(value));

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
  const rooms = getManagedRooms();
  cacheManagedRooms(rooms);
  return rooms;
};

export const saveManagedRooms = async (rooms) => {
  cacheManagedRooms(rooms);
  return rooms;
};

export const getManagedDiningCatalog = () => {
  try {
    const rawValue = localStorage.getItem(DINING_KEY);
    return rawValue
      ? JSON.parse(rawValue)
      : {
          categories: clone(defaultDiningCategories),
          featuredPlates: clone(defaultFeaturedPlates),
        };
  } catch (error) {
    return {
      categories: clone(defaultDiningCategories),
      featuredPlates: clone(defaultFeaturedPlates),
    };
  }
};

export const cacheManagedDiningCatalog = (catalog) => {
  localStorage.setItem(DINING_KEY, JSON.stringify(catalog));
};

export const fetchManagedDiningCatalog = async () => {
  const catalog = getManagedDiningCatalog();
  cacheManagedDiningCatalog(catalog);
  return catalog;
};

export const saveManagedDiningCatalog = async (catalog) => {
  cacheManagedDiningCatalog(catalog);
  return catalog;
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
