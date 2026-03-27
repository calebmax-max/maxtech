import axios from 'axios';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildApiUrl } from '../utils/api';
import { clearAdminSession, setAdminSession } from '../utils/adminSession';

axios.defaults.withCredentials = true;

const RESPONSE_DISPLAY_MS = 5000;

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
    clearAdminSession();

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!normalizedEmail || !trimmedPassword) {
      setError('Email and password are required');
      return;
    }

    setLoading('Signing you in...');

    try {
      const response = await axios.post(
        buildApiUrl('/api/signin'),
        {
          email: normalizedEmail,
          password: trimmedPassword,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const signedInUser = response.data.user;
      setLoading('');
      setSuccess(response.data.message);

      if (signedInUser?.role === 'kitchen') {
        setAdminSession({
          email: signedInUser.email,
          name: signedInUser.username || 'Kitchen Staff',
          isAdmin: false,
          role: 'kitchen',
        });

        setTimeout(() => {
          navigate('/kitchen', { replace: true });
        }, RESPONSE_DISPLAY_MS);
        return;
      }

      if (signedInUser?.is_admin) {
        setAdminSession({
          email: signedInUser.email,
          name: signedInUser.username || 'Admin',
          isAdmin: true,
          role: signedInUser.role || 'admin',
        });

        setTimeout(() => {
          navigate('/admin', { replace: true });
        }, RESPONSE_DISPLAY_MS);
        return;
      }

      setTimeout(() => {
        navigate('/profile');
      }, RESPONSE_DISPLAY_MS);
    } catch (requestError) {
      setLoading('');
      setError(requestError.response?.data?.message || 'Invalid email or password');
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
            <label className="auth-field auth-field--signin">
              <span>Email Address</span>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="auth-field auth-field--signin">
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
                  className="auth-password__toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <button type="submit" className="auth-submit">
              Sign In
            </button>

            <p className="auth-switch">
              Don&apos;t have an account? <Link to="/signup">Create one</Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Signin;
