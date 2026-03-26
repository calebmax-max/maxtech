import axios from 'axios';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildApiUrl } from '../utils/api';

// ✅ GLOBAL AXIOS CONFIG
axios.defaults.withCredentials = true;

const ADMIN_EMAIL = "caleb@gmail.com"; // 👑 your admin email

const Signin = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }

    setLoading('Signing you in...');

    try {
      const payload = {
        email: email.trim().toLowerCase(),
        password: password.trim()
      };

      const response = await axios.post(
        buildApiUrl('/api/signin'),
        payload,
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      setLoading('');
      setSuccess(response.data.message);

      const userEmail = response.data.user?.email?.toLowerCase();

      // ✅ REDIRECT BASED ON EMAIL
      setTimeout(() => {
        if (userEmail === ADMIN_EMAIL) {
          navigate('/admin');   // 👑 ADMIN PANEL
        } else {
          navigate('/');        // 👤 NORMAL USER
        }
      }, 800);

    } catch (requestError) {
      setLoading('');
      setError(
        requestError.response?.data?.message || "Invalid email or password"
      );
    }
  };



  return (
    <section className="auth-page auth-page--signin">
      <div className="auth-shell">
        <div className="auth-shell__panel">
          <p className="auth-shell__eyebrow">Welcome Back</p>
          <h1>Sign in and continue planning your next stay.</h1>
          <p className="auth-shell__lead">
            Access your account to move faster through room reservations,
            dining requests, and future hotel bookings.
          </p>

          <div className="auth-shell__highlights">
            <span>Quick access</span>
            <span>Secure sign-in</span>
            <span>Booking ready</span>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card__header">
            <p className="auth-card__eyebrow">Returning Guest</p>
            <h2>Sign In</h2>
            <p>Enter your email and password to access your account.</p>
          </div>

          {loading && <div className="auth-alert auth-alert--info">{loading}</div>}
          {success && <div className="auth-alert auth-alert--success">{success}</div>}
          {error && <div className="auth-alert auth-alert--error">{error}</div>}

          <form className="auth-form auth-form--signin" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Email Address</span>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-password">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <button type="submit" className="auth-submit">
              Sign In
            </button>

            <p>
              Don’t have an account? <Link to="/signup">Create one</Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Signin;