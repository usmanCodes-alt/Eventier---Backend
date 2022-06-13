const connection = require("../database/connection");
const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);
const sgMail = require("@sendgrid/mail");
const bcrypt = require("bcrypt");
const validator = require("validator");
const glob = require("glob");
const path = require("path");
// const uuid = require("uuid");

const GetAllCustomers = async (req, res) => {
  try {
    const [rows, fields] = await connection.execute("SELECT * FROM customers");
    return res.status(200).json({ rows, fields });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Adds customer to it's designated table and also
 * adds them to Login table with customer's id.
 * @param {*} req
 * @param {*} res
 * @returns 201 - created
 */
const CreateNewCustomer = async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
    phoneNumber = null,
  } = req.body;
  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return res
      .status(412)
      .json({ message: "Please provide all required fields" });
  }
  const isValidEmail = validator.isEmail(email);
  if (!isValidEmail) {
    return res.status(412).json({ message: "Please provide a valid email" });
  }
  if (password !== confirmPassword) {
    return res.status(412).json({ message: "Passwords do not match" });
  }
  const hashSalt = bcrypt.genSaltSync(Number(process.env.HASH_ROUNDS));
  const hash = bcrypt.hashSync(password, hashSalt);
  try {
    const [rows, fields] = await connection.execute(
      "SELECT * FROM customers WHERE email = ?",
      [email]
    );
    if (rows.length !== 0) {
      // customer with same email exists
      return res.status(412).json({ email: "Email already exists" });
    }
    const [savedCustomerRow] = await connection.execute(
      "INSERT INTO customers (first_name, last_name, email, password, phone_number) VALUES (?, ?, ?, ?, ?)",
      [firstName, lastName, email, hash, phoneNumber]
    );
    // const [customerRow] = await connection.execute(
    //   "SELECT * FROM customers ORDER BY customer_id DESC LIMIT 1"
    // );
    // const savedCustomerId = customerRow[0].customer_id;
    const savedCustomerId = savedCustomerRow.insertId;
    await connection.execute(
      "INSERT INTO login (login_email, login_password, service_provider_id, customer_id, blocked) VALUES (?, ?, ?, ?, ?)",
      [email, hash, null, savedCustomerId, String(0)]
    );
    return res.status(201).json({ message: "Customer Created" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const GetLoggedInCustomer = async (req, res) => {
  const { eventierUserEmail } = req.body;
  if (!eventierUserEmail) {
    return res
      .status(412)
      .json({ message: "Please login to get customer details." });
  }

  let query = `SELECT first_name, last_name, email`;

  const [customerAddressRow] = await connection.execute(
    "SELECT address_id FROM customers WHERE email = ?",
    [eventierUserEmail]
  );

  const emailPrefix = eventierUserEmail.split("@")[0];

  let matches = glob.sync(emailPrefix + "*.*", {
    cwd: path.join(
      __dirname,
      "../../images/profile-pictures/" + eventierUserEmail
    ),
  });

  if (customerAddressRow[0].address_id) {
    // there is an address.
    query =
      query +
      `, street, city, country, province FROM customers
    INNER JOIN address ON customers.address_id = address.address_id
    WHERE customers.email = ?`;
  } else {
    // there is no address
    query = query + ` FROM customers WHERE email = ?`;
  }

  console.log(query);

  const [customerRow] = await connection.execute(query, [eventierUserEmail]);
  if (!customerRow.length === 0) {
    return res
      .status(404)
      .json({ message: "No customer found by the provided token" });
  }
  if (matches.length > 0) {
    customerRow[0].static_urls = matches;
  }
  console.log(customerRow[0]);
  return res.status(200).json(customerRow[0]);
};

const AddReview = async (req, res) => {
  const { eventierUserEmail } = req.body; // from authentication middleware
  const { reviewMessage, starRating, serviceId } = req.body;
  console.log({ reviewMessage, starRating, serviceId });

  if (!reviewMessage || !starRating || !serviceId) {
    return res
      .status(412)
      .json({ message: "Please provide all required fields" });
  }

  try {
    // get customer id
    const [customerRows] = await connection.execute(
      "SELECT * FROM customers WHERE email = ?",
      [eventierUserEmail]
    );
    const loggedInCustomerId = customerRows[0].customer_id;

    // get service provider id from given serviceId
    const [servicesRows] = await connection.execute(
      "SELECT * FROM services WHERE service_id = ?",
      [serviceId]
    );
    const serviceProviderId = servicesRows[0].service_provider_id;

    // Insert review into database
    await connection.execute(
      "INSERT INTO reviews (service_id, customer_id, service_provider_id, review_message, star_rating) VALUES (?, ?, ?, ?, ?)",
      [
        serviceId,
        loggedInCustomerId,
        serviceProviderId,
        reviewMessage,
        starRating,
      ]
    );

    return res.status(201).json({ message: "review added!" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const GetReviewsOfServiceById = async (req, res) => {
  const { serviceId } = req.params;
  if (!serviceId) {
    return res
      .status(412)
      .json({ message: "Please provide all required fields" });
  }
  try {
    const [reviews] = await connection.execute(
      "SELECT * FROM reviews WHERE service_id = ?",
      [serviceId]
    );
    return res.status(200).json({ reviews });
  } catch (error) {
    console.log(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const AddToWishList = async (req, res) => {
  const { eventierUserEmail } = req.body;
  const {
    serviceName,
    serviceType,
    unitPrice,
    serviceId,
    serviceProviderEmail,
  } = req.body;

  if (
    !serviceName ||
    !serviceType ||
    !unitPrice ||
    !serviceId ||
    !serviceProviderEmail
  ) {
    return res
      .status(412)
      .json({ message: "Please provide all required fields" });
  }

  try {
    const [customerRow] = await connection.execute(
      "SELECT customer_id FROM customers WHERE email = ?",
      [eventierUserEmail]
    );
    const customerId = customerRow[0].customer_id;
    if (!customerId) {
      return res.status(404).json({ message: "No customer with this email" });
    }
    await connection.execute(
      "INSERT INTO wish_list (service_name, service_type, unit_price, service_id, service_provider_email, customer_id) VALUES (?, ?, ?, ?, ?, ?)",
      [
        serviceName,
        serviceType,
        unitPrice,
        serviceId,
        serviceProviderEmail,
        customerId,
      ]
    );
    return res.status(201).json({ message: "Service added to wish list" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const RemoveServiceFromWishList = async (req, res) => {
  const { wishListId } = req.params;

  if (!wishListId) {
    return res
      .status(412)
      .json({ message: "Please provide a valid wish list id" });
  }

  try {
    await connection.execute("DELETE FROM wish_list WHERE wish_list_id = ?", [
      wishListId,
    ]);
    return res.status(200).json({ message: "Item deleted" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const GetWishList = async (req, res) => {
  const { eventierUserEmail } = req.body; // customer email
  if (!eventierUserEmail) {
    return res.status(412);
  }
  try {
    const [customerRows] = await connection.execute(
      "SELECT * FROM customers WHERE email = ?",
      [eventierUserEmail]
    );
    console.log(customerRows[0]);
    const customerId = customerRows[0].customer_id;
    const [wishList] = await connection.execute(
      "SELECT * FROM wish_list WHERE customer_id = ?",
      [customerId]
    );
    console.log(wishList);
    return res.status(200).json({ wishList });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const PlaceOrder = async (req, res) => {
  const requiredFields = ["service_name", "quantity", "serviceId"];
  let missingValue = false;
  const { eventierUserEmail } = req.body;
  const { cartItems } = req.body; // extracting array of all ordered services

  // check for missing values
  for (const cartItem of cartItems) {
    const keys = Object.keys(cartItem);
    for (const key of keys) {
      if (requiredFields.some((field) => field === key) && !cartItem[key]) {
        missingValue = true;
      }
    }
  }

  if (missingValue) {
    return res
      .status(412)
      .json({ message: "Please provide all required fields!" });
  }

  try {
    // If customer has no address, do not let them make any order.
    const [customerAddressRow] = await connection.execute(
      `
      SELECT address_id FROM customers WHERE email = ?
    `,
      [eventierUserEmail]
    );
    // console.log(customerAddressRow);
    const { address_id } = customerAddressRow[0];
    if (!address_id)
      return res.status(400).json({
        message: "Please upload your address first from update profile",
      });

    const [customerRows] = await connection.execute(
      `SELECT customer_id, first_name, last_name, email, phone_number, street, city, country, province FROM customers
      INNER JOIN address ON customers.address_id = address.address_id
      WHERE customers.email = ?`,
      [eventierUserEmail]
    );
    console.log(customerRows);
    const customerId = customerRows[0].customer_id;
    const {
      street,
      city,
      country,
      province,
      phone_number: phoneNumber,
      first_name: firstName,
      last_name: lastName,
    } = customerRows[0];

    // adding up total discount
    let discount = 0;
    let totalPrice = 0;
    for (const cartItem of cartItems) {
      discount += cartItem.discount;
      totalPrice += cartItem.unit_price;
    }

    let now = new Date();
    let day = ("0" + now.getDate()).slice(-2);
    let month = ("0" + (now.getMonth() + 1)).slice(-2);
    let today = now.getFullYear() + "-" + month + "-" + day;

    for (const cartItem of cartItems) {
      const {
        service_name,
        // service_type,
        // unit_price,
        // status,
        // description,
        // discount,
        // first_name,
        // last_name,
        // email,
        // phone_number,
        serviceId,
        orderDate,
        quantity,
        extraDetails = null,
      } = cartItem;

      // check for block status
      const [servicesRows] = await connection.execute(
        "SELECT * FROM services WHERE service_id = ?",
        [serviceId]
      );
      const blockStatus = servicesRows[0].blocked;
      if (blockStatus === "1") {
        return res.status(406).json({ message: "This service is blocked" });
      }

      // insert data into delivery address table
      const serviceProviderId = servicesRows[0].service_provider_id;
      const [deliveryAddressRow] = await connection.execute(
        "INSERT INTO order_delivery_address (delivery_address_area, delivery_address_city, delivery_address_province, delivery_address_country) VALUES (?, ?, ?, ?)",
        [street, city, province, country]
      );

      // insert data into orders table
      const addressId = deliveryAddressRow.insertId;

      await connection.execute(
        "INSERT INTO orders (customer_id, service_provider_id, service_id, order_name, order_date, delivery_date, quantity, extra_detail, payment_status, status, delivery_address_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          customerId,
          serviceProviderId,
          serviceId,
          service_name,
          today,
          null, // delivery date
          quantity,
          extraDetails,
          "paid",
          null, // order status
          addressId,
        ]
      );
    }

    /**
     * Send email to the user. Notifying them of order confirmation.
     */
    const mail = {
      to: eventierUserEmail,
      from: process.env.SENDGRID_SENDER,
      subject: "Eventier -- Order Confirmation.",
      templateId: "d-568e7f85b5414f6d926eeb1bdd861d30",
      dynamic_template_data: {
        currentDate: today,
        discount,
        subTotal: totalPrice,
        totalAfterDiscount:
          Number(totalPrice) - (Number(totalPrice) * Number(discount)) / 100,
        customerEmail: eventierUserEmail,
        phoneNumber,
        customerFirstName: firstName,
        customerLastName: lastName,
        street,
        city,
        country,
        province,
        orders: cartItems.map((cartItem) => ({
          productName: cartItem.service_name,
          price: cartItem.unit_price,
        })),
        serviceProviders: cartItems.map(
          (cartItem) => `${cartItem.first_name} ${cartItem.last_name}`
        ),
      },
    };

    sgMail
      .send(mail)
      .then(() =>
        res.status(201).json({
          message: "Order created and Confirmation mail has been sent.",
        })
      )
      .catch((err) => {
        throw new Error(err);
      });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 *
 * @param {*} req
 * @param {*} res
 * @returns Creates a customer, charges them and accept the payment!
 */
const ProcessPayment = async (req, res) => {
  const { eventierUserEmail } = req.body;
  const { cartItems, token } = req.body; // extracting array of all ordered services

  try {
    const customer = await stripe.customers.create({
      email: eventierUserEmail,
      name: eventierUserEmail,
      address: {
        city: "lhr",
        country: "pak",
      },
    });

    const card = await stripe.customers.createSource(customer.id, {
      source: "tok_mastercard",
    });

    await stripe.charges.create({
      amount: 10 * 100,
      currency: "inr",
      customer: customer.id,
      description: "Hall",
      shipping: {
        name: token.card.name,
        address: {
          country: token.card.address_country,
        },
      },
    });

    return res.status(200).json({ message: "Payment processed!" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const UpdateProfile = async (req, res) => {
  const { eventierUserEmail } = req.body;

  const { firstName, lastName, street, city, country, province } = req.body;
  // console.log({ firstName, lastName, street, city, country, province });

  if (!firstName || !lastName || !city || !country || !province || !street) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }

  try {
    /**
     * Check if customer already has an address -> UPDATE address
     * If customer doesn't have an address -> ADD address
     */
    const [customerRows] = await connection.execute(
      "SELECT * FROM customers WHERE email = ?",
      [eventierUserEmail]
    );
    const customerId = customerRows[0].customer_id;
    // check if customer has an address
    const [customerRow] = await connection.execute(
      "SELECT * FROM customers WHERE customer_id = ?",
      [customerId]
    );

    // Base update customer query and values
    let query = "UPDATE customers SET first_name = ?, last_name = ?";
    let queryValuesArray = [firstName, lastName];

    const customerAddressId = customerRow[0].address_id;
    if (!customerAddressId) {
      /**
       * no address -> add address
       * Add address_id to base update query and new address id to values array
       * because now we have a new address for this customer.
       */
      const [addressInserted] = await connection.execute(
        "INSERT INTO address (street, city, country, province) VALUES (?, ?, ?, ?)",
        [street, city, country, province]
      );
      query = query + ", address_id = ?";
      queryValuesArray.push(addressInserted.insertId);
    } else {
      /**
       * address already exists, no need to alter address_id in customer table, just
       * update the address with new values.
       */
      console.log("Updating address");
      await connection.execute(
        "UPDATE address SET street = ?, city = ?, country = ?, province = ? WHERE address_id = ?",
        [street, city, country, province, customerAddressId]
      );
    }
    query = query + " WHERE customer_id = ?";
    queryValuesArray.push(customerId);

    // console.log(query);
    // console.log(queryValuesArray);

    const [result] = await connection.execute(query, queryValuesArray);
    console.log(result);
    return res.status(200).json({ message: "Profile Updated!" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

/**
 * Returns customer orders along with
 * 1) Order name
 * 2) Service Provider name
 * 3) Payment status
 * 4) Order date
 * 5) Order status  -> can be manipulated at frontend and shown the desired ones only.
 * @param {*} req
 * @param {*} res
 * @returns 200 - array of orders
 */
const GetCustomerOrders = async (req, res) => {
  const CUSTOMER_ORDERS = [];
  const { eventierUserEmail } = req.body;
  try {
    const [customerRow] = await connection.execute(
      "SELECT * FROM customers WHERE email = ?",
      [eventierUserEmail]
    );
    const customerId = customerRow[0].customer_id;
    const [orderRows] = await connection.execute(
      "SELECT * FROM orders WHERE customer_id = ?",
      [customerId]
    );
    for (const order of orderRows) {
      let orderObject = {};
      const serviceProviderId = order.service_provider_id;
      const [serviceProviderRow] = await connection.execute(
        "SELECT * FROM service_provider WHERE service_provider_id = ?",
        [serviceProviderId]
      );
      orderObject.serviceProviderStoreName = serviceProviderRow[0].store_name;
      orderObject.orderName = order.order_name;
      orderObject.orderDate = order.order_date;
      orderObject.paymentStatus = order.payment_status;
      orderObject.orderStatus = order.status ? order.status : "pending";
      CUSTOMER_ORDERS.push(orderObject);
    }
    return res.status(200).json({ CUSTOMER_ORDERS });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const GetAllServicesForCustomers = async (req, res) => {
  let currentService = 0;
  try {
    const [services] =
      await connection.execute(`SELECT service_id as 'service_database_id', service_name, service_type, email, images_uuid FROM services
    INNER JOIN service_provider ON services.service_provider_id = service_provider.service_provider_id;`);
    for (const service of services) {
      const { service_type, email, images_uuid } = service;
      const emailPrefix = email.split("@")[0];

      const matches = glob.sync(
        emailPrefix + "--" + service_type + "--" + images_uuid + "--" + "*.*",
        {
          cwd: path.join(__dirname, "../../images/service-images/" + email),
        }
      );

      if (matches.length > 0) {
        services[currentService][
          "static_url"
        ] = `http://localhost:3000/static/${email}/${matches[0]}`;
      }
      currentService++;
    }
    return res.status(200).json({ services });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// const GetRatingsAndReviews = async (req, res) => {};

const Logout = async (req, res) => {
  const { eventierUserEmail } = req.body;
  try {
    const [customersResult] = await connection.execute(
      "SELECT * FROM customers WHERE email = ?",
      [eventierUserEmail]
    );
    const customerId = customersResult[0].customer_id;
    /**
     * Delete all the tokens for the user, hence logging them out
     * of all the logged in devices.
     * */
    await connection.execute("DELETE FROM jwt_token WHERE customer_id = ?", [
      customerId,
    ]);
    return res.status(200).json({ message: "Logged out of all devices" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

module.exports = {
  GetAllCustomers,
  CreateNewCustomer,
  GetLoggedInCustomer,
  AddReview,
  GetReviewsOfServiceById,
  AddToWishList,
  GetWishList,
  RemoveServiceFromWishList,
  PlaceOrder,
  ProcessPayment,
  CustomerUpdateProfile: UpdateProfile,
  GetCustomerOrders,
  GetAllServicesForCustomers,
  CustomerLogout: Logout,
};
