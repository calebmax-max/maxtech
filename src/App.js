import './App.css';
import axios from 'axios'
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Getproducts from './components/Home';
import Signup from './components/Signup';
import Signin from './components/Signin';
import Notfound from './components/Notfound';
import 'bootstrap/dist/css/bootstrap.min.css';
import Makepayment from './components/Makepayment';
import Rooms from './components/Rooms';
import RoomDetails from './components/RoomDetails';
import Dining from './components/Dining';
import Bookings from './components/Bookings';
import Contactus from './components/Contactus';
import EventInquiry from './components/EventInquiry';
import Admin from './components/Admin';
import Kitchen from './components/Kitchen';
import Profile from './components/Profile';
import { isAdminAuthenticated, isKitchenAuthenticated } from './utils/adminSession';
import { buildApiUrl } from './utils/api';
axios.defaults.withCredentials = true;

function AdminRoute() {
  return isAdminAuthenticated() ? <Admin /> : <Navigate to="/signin" replace />;
}

function KitchenRoute() {
  return isKitchenAuthenticated() ? <Kitchen /> : <Navigate to="/signin" replace />;
}

function AppLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
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

  useEffect(() => {
    let active = true;

    const loadCurrentUser = async () => {
      try {
        const response = await axios.get(buildApiUrl('/api/me'), {
          withCredentials: true,
        });

        if (active) {
          setCurrentUser(response.data.user || null);
        }
      } catch (error) {
        if (active) {
          setCurrentUser(null);
        }
      }
    };

    loadCurrentUser();

    return () => {
      active = false;
    };
  }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await axios.post(buildApiUrl('/api/signout'), {}, { withCredentials: true });
    } catch (error) {
      // Ignore sign-out request errors and continue clearing local state.
    }

    setCurrentUser(null);
    window.sessionStorage.removeItem('elitehotels-admin-session');
    window.location.href = '/signin';
  };

  const isStaffUser = currentUser?.is_admin || currentUser?.role === 'kitchen';

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
            {currentUser ? (
              <>
                <NavLink
                  to={isStaffUser ? (currentUser.role === 'kitchen' ? '/kitchen' : '/admin') : '/profile'}
                  className="site-nav__link site-nav__link--profile"
                >
                  Profile
                </NavLink>
                <button type="button" className="site-nav__link site-nav__signout" onClick={handleSignOut}>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/signin" className="site-nav__link">Sign In</NavLink>
                <NavLink to="/signup" className="site-nav__link">Sign Up</NavLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Getproducts />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/rooms/:roomSlug" element={<RoomDetails />} />
        <Route path="/dining" element={<Dining />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="/kitchen" element={<KitchenRoute />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/contactus" element={<Contactus />} />
        <Route path="/events" element={<EventInquiry />} />
        
        <Route path="/makepayment" element={<Makepayment />} />
        <Route path="*" element={<Notfound />} />
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
            {currentUser ? (
              <NavLink to={isStaffUser ? (currentUser.role === 'kitchen' ? '/kitchen' : '/admin') : '/profile'}>
                {isStaffUser ? 'Dashboard' : 'My Profile'}
              </NavLink>
            ) : (
              <>
                <NavLink to="/signin">Sign In</NavLink>
                <NavLink to="/signup">Sign Up</NavLink>
              </>
            )}
          </div>

          <div className="site-footer__contact">
            <h4>Contact</h4>
            <p>Westlands, Nairobi</p>
            <p>+254 700 123 456</p>
            <p>reservations@elitehotels.com</p>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p>&copy; 2026 EliteHotels. All rights reserved.</p>
          <p>Developed by Caleb Tonny</p>
        </div>
      </footer>
    </div>
  );
}

// <BrowserRouter> comes from react-router-dom.
// It wraps the app and enables client-side routing using the browser history API.
// This allows navigation without full page reloads.

// <AppLayout> is the main layout component.
// It contains the routes and shared UI, and BrowserRouter powers the navigation.
function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
