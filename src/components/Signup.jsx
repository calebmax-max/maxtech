import axios from 'axios';
import React, { useState } from 'react'
import { Link } from 'react-router-dom';

const Signup = () => {
  // initialize the hooks
  const[username, setUsername] = useState("");
  const[email, setEmail] =useState("");
  const[password, setPassword] =useState("");
  const[phone, setPhone] =useState("");
  const [showPassword, setShowPassword] = useState(false);
 
// Define the three states an application will move to
const [loading, setLoading] = useState("");
const [success, setSuccess] = useState("");
const [error, setError] = useState("");

// Below is the funtion that will handle the submit action
const handleSubmit =  async (e) =>{
  // Below we prevent our site from reloading
  e.preventDefault()

  // Update our loading hook with a message that will be displayed to the users who are trying to register
  setLoading("Please wait as registration is in progress...")
  
  try{
    //Create a form-data object that will enable you to capture the four details entered on the form
    const formdata = new FormData();
    // Insert the four details(username , email, password, phone) in terms of key-value pair
    formdata.append("username", username);
    formdata.append("email", email);
    formdata.append("password", password);
    formdata.append("phone", phone);
    // BY use of axios,we can access the method post
    const response =await axios.post("https://calebtonny.alwaysdata.net/api/signup", formdata)

    //Set back the loading to default
    setLoading("");

    //Just incase everything goes on well. update the success hook witha message
    setSuccess(response.data.message)

    //clear your hooks
    setUsername("");
    setEmail("");
    setPassword("");
    setPhone("");
     setTimeout(() => {
    setSuccess("");
  }, 5000);


    
  }
  catch(error){
    // set loading to default
    setLoading("");
     //update the error hook with the message given back from the response
     setError(error.message)

  }


}

  return (
    <section className="auth-page auth-page--signup">
      <div className="auth-shell auth-shell--reverse">
        <div className="auth-shell__panel">
          <p className="auth-shell__eyebrow">Create Your Account</p>
          <h1>Join the hotel experience with a fresh, modern sign-up flow.</h1>
          <p className="auth-shell__lead">
            Register once and make it easier to reserve rooms, place dining orders, and manage
            future visits.
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
                placeholder='Enter your username'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>

            <label className="auth-field">
              <span>Email Address</span>
              <input
                type="email"
                placeholder='Enter your email address'
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
                  placeholder='Create a password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-password__toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label className="auth-field">
              <span>Phone Number</span>
              <input
                type="tel"
                placeholder='Enter your phone number'
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>

            <button type="submit" className="auth-submit">
              Sign Up
            </button>

            <p className="auth-switch">
              Already have an account? <Link to="/signin">Signin</Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}

export default Signup;
//Research on Axios module in reactjs
