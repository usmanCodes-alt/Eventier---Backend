const connection = require("../database/connection");
const bcrypt = require("bcrypt");
const validator = require("validator");
const glob = require("glob");
const path = require("path");

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
  const [customerRow] = await connection.execute(
    `SELECT first_name, last_name, email, phone_number, street, city, country, province
    FROM customers
    INNER JOIN address ON customers.address_id = address.address_id
    WHERE customers.email = ?`,
    [eventierUserEmail]
  );
  if (!customerRow.length === 0) {
    return res
      .status(404)
      .json({ message: "No customer found by the provided token" });
  }
  return res.status(200).json(customerRow);
};

const AddReview = async (req, res) => {
  const { eventierUserEmail } = req.body; // from authentication middleware
  const { reviewMessage, starRating, serviceId } = req.body;

  if (!reviewMessage || !serviceId) {
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

const PlaceOrder = async (req, res) => {
  const { eventierUserEmail } = req.body;
  const {
    orderName,
    orderDate,
    quantity,
    extraDetails = null,
    paymentStatus = "unpaid",
    serviceId,
    deliveryAddressArea,
    deliveryAddressCity,
    deliveryAddressProvince,
    deliveryAddressCountry,
  } = req.body;
  if (
    !orderName ||
    !orderDate ||
    !quantity ||
    !paymentStatus ||
    !serviceId ||
    !deliveryAddressArea ||
    !deliveryAddressCity ||
    !deliveryAddressCountry ||
    !deliveryAddressProvince
  ) {
    return res
      .status(412)
      .json({ message: "Please provide all required fields!" });
  }

  try {
    const [customerRows] = await connection.execute(
      "SELECT * FROM customers WHERE email = ?",
      [eventierUserEmail]
    );
    const customerId = customerRows[0].customer_id;
    const [servicesRows] = await connection.execute(
      "SELECT * FROM services WHERE service_id = ?",
      [serviceId]
    );
    const blockStatus = servicesRows[0].blocked;
    if (blockStatus === "1") {
      return res.status(406).json({ message: "This service is blocked" });
    }
    const serviceProviderId = servicesRows[0].service_provider_id;
    const [deliveryAddressRow] = await connection.execute(
      "INSERT INTO order_delivery_address (delivery_address_area, delivery_address_city, delivery_address_province, delivery_address_country) VALUES (?, ?, ?, ?)",
      [
        deliveryAddressArea,
        deliveryAddressCity,
        deliveryAddressProvince,
        deliveryAddressCountry,
      ]
    );
    const addressId = deliveryAddressRow.insertId;

    await connection.execute(
      "INSERT INTO orders (customer_id, service_provider_id, service_id, order_name, order_date, delivery_date, quantity, extra_detail, payment_status, status, delivery_address_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        customerId,
        serviceProviderId,
        serviceId,
        orderName,
        orderDate,
        null,
        quantity,
        extraDetails,
        paymentStatus,
        null,
        addressId,
      ]
    );

    return res.status(201).json({ message: "New order has been created!" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const UpdateProfile = async (req, res) => {
  const { eventierUserEmail } = req.body;

  const { firstName, lastName, phoneNumber, street, city, country, province } =
    req.body;

  if (
    !firstName ||
    !lastName ||
    !phoneNumber ||
    !city ||
    !country ||
    !province ||
    !street
  ) {
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
    let query =
      "UPDATE customers SET first_name = ?, last_name = ?, phone_number = ?";
    let queryValuesArray = [firstName, lastName, phoneNumber];

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
      await connection.execute(
        "UPDATE address SET street = ?, city = ?, country = ?, province = ? WHERE address_id = ?",
        [street, city, country, province, customerAddressId]
      );
    }
    query = query + " WHERE customer_id = ?";
    queryValuesArray.push(customerId);

    // console.log(query);
    // console.log(queryValuesArray);

    await connection.execute(query, queryValuesArray);
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
      await connection.execute(`SELECT service_id as 'service_database_id', service_name, service_type, email FROM services
    INNER JOIN service_provider ON services.service_provider_id = service_provider.service_provider_id;`);
    for (const service of services) {
      const { service_type, email } = service;
      const emailPrefix = email.split("@")[0];

      const matches = glob.sync(
        emailPrefix + "--" + service_type + "--" + "*.*",
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
  PlaceOrder,
  CustomerUpdateProfile: UpdateProfile,
  GetCustomerOrders,
  GetAllServicesForCustomers,
  CustomerLogout: Logout,
};
