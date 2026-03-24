



import './App.css';
import {BrowserRouter, Routes, Route, Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Getproducts from './components/Home';
import Signup from './components/Signup';
import Signin from './components/Signin';
import Notfound from './components/Notfound';
import 'bootstrap/dist/css/bootstrap.min.css'
import Makepayment from './components/Makepayment';
import Rooms from './components/Rooms';
import RoomDetails from './components/RoomDetails';
import Dining from './components/Dining';
import Bookings from './components/Bookings';
import Contactus from './components/Contactus';
import EventInquiry from './components/EventInquiry';
function AppLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  }, [location.key]);

  return (
    <div className="App">
      <header className={`site-header ${isHomePage ? 'site-header--home' : ''}`}>
        <div className="site-header__inner">
          <Link to="/" className="site-brand">
            <span className="site-brand__mark">EH</span>
            <span className="site-brand__text">
              <strong>ELITEHOTELS</strong>
              <small>Hotel & Restaurant</small>
            </span>
          </Link>

          <button
            type="button"
            className={`site-nav__toggle ${menuOpen ? 'is-open' : ''}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <nav className={`site-nav ${menuOpen ? 'is-open' : ''}`}>
            <Link to="/rooms" className="site-nav__link">Rooms</Link>
            <Link to="/dining" className="site-nav__link">Dining</Link>
            <Link to="/bookings" className="site-nav__link">Bookings</Link>
            <Link to="/contactus" className="site-nav__link">Contact Us</Link>
            <NavLink to="/signin" className="site-nav__link">Sign In</NavLink>
            <NavLink to="/signup" className="site-nav__link">Sign Up</NavLink>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path='/' element={<Getproducts/>}/>
        <Route path='/signup' element={<Signup/>}/>
        <Route path='/signin' element={<Signin/>}/>
        <Route path='/rooms' element={<Rooms/>}/>
        <Route path='/rooms/:roomSlug' element={<RoomDetails/>}/>
        <Route path='/dining'  element={<Dining/>}/>
        <Route path='/bookings' element={<Bookings/>}/>
        <Route path='/contactus' element={<Contactus/>}/>
        <Route path='/events' element={<EventInquiry/>}/>
        <Route path='/makepayment' element={<Makepayment/>}/>
    
        <Route path='*' element={<Notfound/>}/>
      </Routes>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__brand">
            <Link to="/" className="site-brand site-footer__brand-link">
              <span className="site-brand__mark">EH</span>
              <span className="site-brand__text">
                <strong>ELITEHOTELS</strong>
                <small>Hotel & Restaurant</small>
              </span>
            </Link>
            <p>
              Elegant rooms, memorable dining, and warm hospitality designed to make every stay
              feel special.
            </p>
          </div>

          <div className="site-footer__links">
            <h4>Quick Links</h4>
            <Link to="/rooms">Rooms</Link>
            <Link to="/dining">Dining</Link>
            <Link to="/bookings">Bookings</Link>
            <Link to="/contactus">Contact Us</Link>
            <NavLink to="/signin">Sign In</NavLink>
          </div>

          <div className="site-footer__contact">
            <h4>Contact</h4>
            <p>Westlands, Nairobi</p>
            <p>+254 700 123 456</p>
            <p>reservations@elitehotels.com</p>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p>© 2026 EliteHotels. All rights reserved.</p>
          <p>Developed by Caleb Tonny</p>
        </div>
      </footer>
    </div>
  );
}

//<BrowserRouter>Comes from react-router-dom.
//It wraps your entire app and enables client‑side routing using the browser’s history API.
//This means you can navigate between pages without full page reloads.


//<AppLayout>This is your main layout component.
//It likely contains your routes (<Routes> and <Route> components) and shared UI (like a navbar, footer, or sidebar).
//By placing it inside BrowserRouter, all navigation inside AppLayout is powered by React Router.
function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
