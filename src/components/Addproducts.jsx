import React, { useState } from 'react'
import Loader from './Loader';
import axios from 'axios';

const Addproducts = () => {
  // introduce the hooks
  const [product_name,setProduct_name ] =  useState("");
  const [product_description, setProduct_description] = useState("");
  const [product_cost, setProduct_cost] = useState("");
  const [product_photo, setProduct_photo] = useState("");
  // declare the additional hook to manage the state of application
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  
  // create a functon that will handle the submit action
  const handleSubmit = async (e) =>{
    // prevent the site from reloading
    e.preventDefault()

    //set the loading hook with a message(activate it)
    setLoading(true)

    try{
      //create a form data
      const formdata = new FormData()

      //append the details to the form data created
      formdata.append("product_name", product_name);
      formdata.append("product_description", product_description);
      formdata.append("product_cost", product_cost);
      formdata.append("product_photo", product_photo);

      //interact with axios to help you use the method host
      const response = await axios.post("https://calebtonny.alwaysdata.net/api/add_product", formdata)
       // set the loading hook back to default
       setLoading(false)

       //update the success hook with a message
       setSuccess(response.data.message)

       // clearing the hooks (setting them back to default/empty)
       setProduct_name("");
       setProduct_description("");
       setProduct_cost("");
       setProduct_photo("");

        e.target.reset()
        setTimeout(() => {
        setSuccess("");
      }, 5000);

    }
    catch(error){
      //set loading hook back to default
      setLoading(false)

      //update the setError with a message
      setError(error.message)
    }
  }
  return (
    <div className='row justify-content-center mt 4'>
     <div className="card col-md-6 shadow p-4">
      <h3 className='text-primary'>Welcome to Add Product</h3>
      {/* bind the loading hook*/}
      {loading && <Loader/>}

       <h3 className="text-success">{success}</h3>
        <h4 className="text-danger">{error}</h4>

      <form onSubmit={handleSubmit}>
        <input type="text"
        placeholder='Enter the Product name' 
        className='form-control'
        required
        value={product_name}
        onChange={(e) => setProduct_name(e.target.value)}/> <br />

        {/* {product_name} */}

        <input type="text" 
        placeholder='Enter the Product Description'
        className='form-control'
        required
        value={product_description}
        onChange={(e) => setProduct_description(e.target.value)}/> <br />

        {/* {product_description} */}

        <input type="number"
        placeholder='Enter the price of the product'
        className='form-control' 
        required
        value={product_cost}
        onChange={(e) => setProduct_cost(e.target.value)}/> <br />

        {/* {product_cost} */}
        <label className='text-primary'>Product Photo</label>
        <input type="file"
        className='form-control' 
        required
        accept='image/*'
        
        onChange={(e) => setProduct_photo(e.target.files[0])}/> <br />  

        

        
        <input type="submit" 
        value="Add Product"
        className='btn btn-outline-primary'/>

      </form>

      </div>
      
    </div>
  )
}

export default Addproducts;
