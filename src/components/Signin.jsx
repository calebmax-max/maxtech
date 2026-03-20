import axios from 'axios';
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom';

const Signin = () => {
  // Define the two hooks for capturing/ storing the users input
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  //Declare the three additional hooks
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  //Below we have the useNavigate hook to redirect us to another pagenin successful login/signin
  const navigate = useNavigate("");

  // below is the function to handle the signin action
  const handlesubmit = async(e) => {
    //prevent the site from reloading
    e.preventDefault()

    //update the loading hook with a message
    setLoading("Please wait while we authenticate your account.")

    try{
      // Create a formData object that will hold the email and the password
      const formdata = new FormData()
      // Insert / append the email and the password on the FormData created
      formdata.append("email", email)
      formdata.append("password", password)

      // Interact with axios for the response
      const response = await axios.post("https://calebtonny.alwaysdata.net/api/signin",formdata)

      //set the loading hook back to default
      setLoading("");

      // check whether the user exists as part of the response from the API
      if(response.data.user){
        // if the user is there, definitely the details entered durin signin are correct
        // if it is successful let a person get redirected to another page
        // Store user details in local storage
        localStorage.setItem("user", JSON.stringify(response.data.user));
        navigate("/")

      }
      else{
        // user is not found , that means the credentials entered on the form are incorrect
        setError("Login failed. Please try again...")
      }

    }
    catch(error){

      // set loading back to default
      setLoading("")
      //update the error hook with a message
      setError("Oops, something went wrong. Try again...")
    }
  }
  return (
    <section className="auth-page auth-page--signin">
      <div className="auth-shell">
        <div className="auth-shell__panel">
          <p className="auth-shell__eyebrow">Welcome Back</p>
          <h1>Sign in and continue your stay with ease.</h1>
          <p className="auth-shell__lead">
            Access your bookings, room choices, and dining plans from one smooth account
            experience.
          </p>

          <div className="auth-shell__highlights">
            <span>Fast sign in</span>
            <span>Booking access</span>
            <span>Secure checkout</span>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card__header">
            <p className="auth-card__eyebrow">Account Access</p>
            <h2>Sign In</h2>
            <p>Enter your details below to continue.</p>
          </div>

          {loading && <div className="auth-alert auth-alert--info">{loading}</div>}
          {error && <div className="auth-alert auth-alert--error">{error}</div>}

          <form className="auth-form auth-form--signin" onSubmit={handlesubmit}>
            <label className="auth-field auth-field--signin">
              <span>Email Address</span>
              <input
                type="email"
                placeholder='Enter your email'
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="auth-field auth-field--signin">
              <span>Password</span>
              <div className="auth-password">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder='Enter your password'
                  required
                  value={password}
                  onChange={(e)=> setPassword(e.target.value)}
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

            <button type="submit" className="auth-submit">
              Sign In
            </button>

            <p className="auth-switch">
              Don`t have an account? <Link to="/signup">Register</Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}

export default Signin;

//HOw can you store the users details in the local storage
