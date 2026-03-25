import axios from 'axios';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { buildApiUrl } from '../utils/api';

// ✅ Ensure cookies/session work across domains
axios.defaults.withCredentials = true;

const Signup = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const passwordHint = 'Use at least 8 characters with letters and numbers.';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const normalizedEmail = email.trim().toLowerCase();

    // ✅ Password validation
    const passwordIsStrong =
      password.length >= 8 &&
      /[A-Za-z]/.test(password) &&
      /\d/.test(password);

    if (!passwordIsStrong) {
      setError(passwordHint);
      return;
    }

    setLoading("Please wait as registration is in progress...");

    try {
      const response = await axios.post(
        buildApiUrl('/api/signup'), // ✅ FIXED ROUTE
        {
          username: username.trim(),
          email: normalizedEmail,
          password,
          phone: phone.trim(),
        },
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      setLoading("");
      setSuccess(response.data.message);

      // ✅ Clear inputs
      setUsername("");
      setEmail("");
      setPassword("");
      setPhone("");

      // Auto clear success message
      setTimeout(() => {
        setSuccess("");
      }, 5000);

    } catch (err) {
      setLoading("");
      setError(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <section className="auth-page auth-page--signup">
      <div className="auth-shell auth-shell--reverse">

        <div className="auth-shell__panel">
          <p className="auth-shell__eyebrow">Create Your Account</p>
          <h1>Join the hotel experience with a fresh, modern sign-up flow.</h1>
          <p className="auth-shell__lead">
            Register once and make it easier to reserve rooms, place dining requests,
            and manage future visits.
          </p>

          <div className="auth-shell__highlights">
            <span>Simple registration</span>
            <span>Faster booking</span>
            <span>Dining access</span>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card__header">
            <p className="auth-card__eyebrow">New Guest</p>
            <h2>Sign Up</h2>
            <p>Create your account below to get started.</p>
          </div>

          {loading && <div className="auth-alert auth-alert--info">{loading}</div>}
          {success && <div className="auth-alert auth-alert--success">{success}</div>}
          {error && <div className="auth-alert auth-alert--error">{error}</div>}

          <form className="auth-form auth-form--double" onSubmit={handleSubmit}>

            <label className="auth-field">
              <span>Username</span>
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>

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
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-password__toggle"
                  onClick={() => setShowPassword(prev => !prev)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <small>{passwordHint}</small>
            </label>

            <label className="auth-field">
              <span>Phone Number</span>
              <input
                type="tel"
                placeholder="Enter your phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>

            <button type="submit" className="auth-submit">
              Sign Up
            </button>

            <p className="auth-switch">
              Already have an account? <Link to="/signin">Sign in</Link>
            </p>

          </form>
        </div>
      </div>
    </section>
  );
};

export default Signup;