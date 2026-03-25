import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

//createFoodCheckoutItem → utility function that formats food orders into a checkout-ready object.
//diningCategories & featuredPlates → data arrays representing your food menu and highlighted dishes.
import { createFoodCheckoutItem } from '../data/diningMenu';
import { fetchManagedDiningCatalog, getManagedDiningCatalog } from '../utils/adminCatalog';

const Dining = () => {
  const [catalog, setCatalog] = useState(() => getManagedDiningCatalog());
  const { categories: diningCategories, featuredPlates } = catalog;

  useEffect(() => {
    let active = true;

    fetchManagedDiningCatalog()
      .then((nextCatalog) => {
        if (active) {
          setCatalog(nextCatalog);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="dining-page">
      <div className="dining-page__hero">
        <p className="dining-page__eyebrow">Dining Experience</p>
        <h2>Explore delicious dishes across our most loved food categories.</h2>
        <p className="dining-page__intro">
          Enjoy breakfast classics, premium main dishes, quick bites, desserts, and refreshing
          drinks prepared with care by our kitchen team.
        </p>
      </div>

      <section className="dining-showcase">
        <div className="dining-showcase__intro">
          <p className="dining-page__eyebrow">Featured Plates</p>
          <h3>More dishes in a richer chef-style layout.</h3>
          <p>
            These featured selections highlight premium presentation, bigger portions, and a more
            elevated restaurant experience.
          </p>
        </div>
{/* .map() → loops through featuredPlates array and creates a card for each plate.
index % 2 === 1 ? 'dining-showcase-card--reverse' : '' → alternates layout for a staggered design. */}
        <div className="dining-showcase__grid">
          {featuredPlates.map((plate, index) => (
            <article
              className={`dining-showcase-card ${index % 2 === 1 ? 'dining-showcase-card--reverse' : ''}`}
              key={plate.title}
            >
              <img className="dining-showcase-card__image" src={plate.image} alt={plate.title} />

              <div className="dining-showcase-card__content">
                <p className="dining-showcase-card__tag">{plate.tag}</p>
                <h4>{plate.title}</h4>
                <p>{plate.description}</p>
                <div className="dining-showcase-card__footer">
                  <strong>{plate.price}</strong>
                  <Link
                    className="dining-order-button"
                    to="/makepayment"
                    state={{
                      checkoutItem: createFoodCheckoutItem({
                        title: plate.title,
                        description: plate.description,
                        image: plate.image,
                        price: plate.price,
                        type: 'Featured Dish',
                        category: plate.tag,
                      }),
                    }}
                  >
                    Order Now
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>


      {/* .map() loops through diningCategories → each category becomes a category card.
Inside each category, .map() loops through category.items → displays each menu item.
Each menu item shows:
Image
Name
Category
Price
Order Now button → sends the item to payment page via createFoodCheckoutItem. */}

      <div className="dining-categories">
        {diningCategories.map((category) => (
          <article className="dining-category-card" key={category.title}>
            <div className="dining-category-card__header">
              <h3>{category.title}</h3>
              <p>{category.description}</p>
            </div>

            <div className="dining-menu-list">
              {category.items.map((item) => (
                <div className="dining-menu-item" key={item.name}>
                  <img className="dining-menu-item__image" src={item.image} alt={item.name} />

                  <div className="dining-menu-item__content">
                    <h4>{item.name}</h4>
                    <span>{category.title}</span>
                  </div>

                  <div className="dining-menu-item__actions">
                    <strong>{item.price}</strong>
                    <Link
                      className="dining-order-button"
                      to="/makepayment"
                      state={{
                        checkoutItem: createFoodCheckoutItem({
                          title: item.name,
                          description: `${category.title} selection`,
                          image: item.image,
                          price: item.price,
                          type: 'Food Order',
                          category: category.title,
                        }),
                      }}
                    >
                      Order Now
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Dining;
