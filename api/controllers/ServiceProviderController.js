const connection = require("../database/connection");
const path = require("path");
const validator = require("validator");
const bcrypt = require("bcrypt");
const glob = require("glob");

const GetAllServiceProviders = async (req, res) => {
  try {
    const [rows, _] = await connection.execute(
      "SELECT * FROM service_provider"
    );
    return res.status(200).json({ rows });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const GetServiceProviderByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    if (!email || !validator.isEmail(email)) {
      return res
        .status(404)
        .json({ message: "Please provide a valid email address" });
    }
    const [eventierUserInformation] = await connection.execute(
      `SELECT first_name, last_name, email, phone_number, street, city, country, province
      FROM service_provider
      INNER JOIN address ON service_provider.fk_address_id = address.address_id
      WHERE service_provider.email = ?;`,
      [email]
    );
    if (eventierUserInformation.length === 0) {
      return res
        .status(404)
        .json({ message: "No service provider registered with this email" });
    }
    return res
      .status(200)
      .json({ eventierUserInformation: eventierUserInformation[0] });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Adds service provider to it's designated table and also
 * adds them to Login table with service provider id.
 * @param {*} req
 * @param {*} res
 * @returns 201 - created
 */
const CreateNewServiceProvider = async (req, res) => {
  const {
    firstName,
    lastName,
    storeName,
    email,
    password,
    confirmPassword,
    street, // set as optional
    city,
    province, // set as optional
    country,
    phoneNumber,
  } = req.body;

  if (
    !firstName ||
    !lastName ||
    !storeName ||
    !email ||
    !password ||
    !confirmPassword ||
    !city ||
    !country ||
    !phoneNumber
  ) {
    return res
      .status(412)
      .json({ message: "Please provide all required fields" });
  }

  // check if both passwords are same
  if (password !== confirmPassword) {
    return res.status(412).json({ message: "Passwords don't match" });
  }

  try {
    // check if the email is valid
    const isValidEmail = validator.isEmail(email);
    if (!isValidEmail) {
      return res.status(412).json({ message: "Please provide a valid email" });
    }

    // check for duplicate email
    const [duplicateEmailRows] = await connection.execute(
      "SELECT * FROM service_provider WHERE email = ?",
      [email]
    );
    if (duplicateEmailRows.length !== 0) {
      return res.status(412).json({ message: "Email already exists!" });
    }

    const hashSalt = bcrypt.genSaltSync(Number(process.env.HASH_ROUNDS));
    const passwordHash = bcrypt.hashSync(password, hashSalt);

    const [serviceProviderAddressRow] = await connection.execute(
      "INSERT INTO address (street, city, country, province) VALUES (?, ?, ?, ?)",
      [street, city, country, province]
    );
    // const [addressRows] = await connection.execute(
    //   "SELECT * FROM address ORDER BY address_id DESC LIMIT 1"
    // );
    // const addressId = addressRows[0].address_id;
    const addressId = serviceProviderAddressRow.insertId;
    const [serviceProviderRows] = await connection.execute(
      "INSERT INTO service_provider (first_name, last_name, store_name, email, password, phone_number, fk_address_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        firstName,
        lastName,
        storeName,
        email,
        passwordHash,
        phoneNumber,
        addressId,
      ]
    );
    // const [serviceProviderRow] = await connection.execute(
    //   "SELECT * FROM service_provider ORDER BY service_provider_id DESC LIMIT 1"
    // );
    const savedServiceProviderId = serviceProviderRows.insertId;
    await connection.execute(
      "INSERT INTO login (login_email, login_password, service_provider_id, customer_id, blocked) VALUES (?, ?, ?, ?, ?)",
      [email, passwordHash, savedServiceProviderId, null, String(0)]
    );
    return res
      .status(201)
      .json({ serviceProviderRows, message: "Service provider created" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const AddNewService = async (req, res) => {
  const {
    serviceName,
    serviceType, // data type and allowed values not decided yet.
    serviceUnitPrice,
    status,
    discount,
    description,
  } = req.body;

  // This will be allocated on req.body by authentication middleware
  const { eventierUserEmail } = req.body;

  if (
    !serviceName ||
    !serviceType ||
    !serviceUnitPrice ||
    !status ||
    !String(discount) ||
    !description
  ) {
    return res
      .status(412)
      .json({ message: "Please provide all required fields" });
  }
  try {
    const [serviceProviderRow] = await connection.execute(
      "SELECT * FROM service_provider WHERE email = ?",
      [eventierUserEmail]
    );
    const serviceProviderId = serviceProviderRow[0].service_provider_id;
    await connection.execute(
      "INSERT INTO services (service_name, service_type, unit_price, status, discount, description, service_provider_id, blocked) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        serviceName,
        serviceType,
        serviceUnitPrice,
        status,
        discount,
        description,
        serviceProviderId,
        String(0), // means un-blocked
      ]
    );
    return res.status(201).json({ message: "Service added Successfully!" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

/**
 * If the user provides the type of order they need to fetch, they have to provide
 * one of the allowed order status types.
 * 1) in-progress
 * 2) delivered
 * 3) accepted
 * 4) rejected
 *
 * If no type query string is passed, all orders are fetched
 * @param {} req
 * @param {*} res
 * @returns 200 - Orders
 */
const GetAllOrders = async (req, res) => {
  const { eventierUserEmail } = req.body;
  const allowedOrdersType = [
    "in-progress",
    "delivered",
    "accepted",
    "rejected",
  ];
  const { type } = req.query; // ../?type=something
  if (type) {
    // if any type was passed, check if it was correct type
    if (!allowedOrdersType.includes(type)) {
      return res.status(400).json({ message: "Invalid order type passed!" });
    }
  }
  try {
    const [serviceProviderRow] = await connection.execute(
      "SELECT * FROM service_provider WHERE email = ?",
      [eventierUserEmail]
    );
    const serviceProviderId = serviceProviderRow[0].service_provider_id;
    const queryValuesArray = [serviceProviderId];
    let joinQuery = `SELECT customers.first_name AS customer_name, services.service_type AS service_type, orders.order_name AS order_name, orders.payment_status, orders.order_date, orders.status FROM orders INNER JOIN customers ON orders.customer_id = customers.customer_id INNER JOIN services ON orders.service_id = services.service_id WHERE orders.service_provider_id = ?`;

    // let query = "SELECT * FROM orders WHERE service_provider_id = ?";
    if (type) {
      joinQuery = joinQuery + " AND status = ?";
      queryValuesArray.push(type);
    }
    const result = await connection.execute(joinQuery, queryValuesArray);
    const [servicesRows] = result;
    return res.status(200).json({ serviceProviderOrders: servicesRows });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const ChangeOrderStatus = async (req, res) => {
  const { eventierUserEmail } = req.body;
  const { newStatus, orderId } = req.body;

  if (!newStatus) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }

  try {
    // get service provider id
    const [serviceProviderRow] = await connection.execute(
      "SELECT * FROM service_provider WHERE email = ?",
      [eventierUserEmail]
    );
    const serviceProviderId = serviceProviderRow[0].service_provider_id;
    const [result] = await connection.execute(
      "UPDATE orders SET status = ? WHERE service_provider_id = ? AND order_id = ?",
      [newStatus, serviceProviderId, orderId]
    );
    return res
      .status(200)
      .json({ message: "Order updated!", queryResult: result });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const GetAllServices = async (req, res) => {
  const { eventierUserEmail } = req.body;
  const emailPrefix = eventierUserEmail.split("@")[0];
  let currentService = 0;
  try {
    const [serviceProviderRow] = await connection.execute(
      "SELECT * FROM service_provider WHERE email = ?",
      [eventierUserEmail]
    );
    const serviceProviderId = serviceProviderRow[0].service_provider_id;
    const [servicesRows] = await connection.execute(
      "SELECT * FROM services WHERE service_provider_id = ?",
      [serviceProviderId]
    );

    for (const serviceRow of servicesRows) {
      const { service_type } = serviceRow;
      const matches = glob.sync(
        emailPrefix + "--" + service_type + "--" + "*.*",
        {
          cwd: path.join(
            __dirname,
            "../../images/service-images/" + eventierUserEmail
          ),
        }
      );
      if (matches.length > 0) {
        console.log("adding dynamic property to object");
        servicesRows[currentService][
          "static_url"
        ] = `http://localhost:3000/static/${eventierUserEmail}/${matches[0]}`;
      }
      currentService++;
    }

    return res.status(200).json({ servicesRows });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const GetRatingsAndReviews = async (req, res) => {
  const { eventierUserEmail } = req.body;
  const { serviceId } = req.body;

  if (!serviceId) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }

  try {
    const [serviceProviderRow] = await connection.execute(
      "SELECT * FROM service_provider WHERE email = ?",
      [eventierUserEmail]
    );
    const serviceProviderId = serviceProviderRow[0].service_provider_id;
    const reviewsJoinQuery = `SELECT services.service_name, services.service_type, services.status, reviews.review_message, reviews.star_rating, customers.first_name, customers.last_name
    FROM reviews
    INNER JOIN services ON reviews.service_id = services.service_id
    INNER JOIN customers ON reviews.customer_id = customers.customer_id
    WHERE reviews.service_provider_id = ? AND reviews.service_id = ?`;
    const [reviews] = await connection.execute(reviewsJoinQuery, [
      serviceProviderId,
      serviceId,
    ]);

    if (reviews.length === 0) {
      return res.status(200).json({ message: "No reviews", REVIEWS: [] });
    }

    return res.status(200).json({ reviews });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const UpdateServiceProviderProfile = async (req, res) => {
  const { eventierUserEmail } = req.body;

  const {
    firstName,
    lastName,
    storeName,
    phoneNumber,
    addressStreet,
    addressCity,
    addressCountry,
    addressProvince,
  } = req.body;

  if (
    !firstName ||
    !lastName ||
    !storeName ||
    !phoneNumber ||
    !addressStreet ||
    !addressCity ||
    !addressProvince ||
    !addressCountry
  ) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }

  try {
    const [serviceProviderRow] = await connection.execute(
      "SELECT * FROM service_provider WHERE email = ?",
      [eventierUserEmail]
    );
    const serviceProviderId = serviceProviderRow[0].service_provider_id;
    const addressId = serviceProviderRow[0].fk_address_id;
    await connection.execute(
      "UPDATE address SET street = ?, city = ?, country = ?, province = ? WHERE address_id = ?",
      [addressStreet, addressCity, addressCountry, addressProvince, addressId]
    );
    await connection.execute(
      "UPDATE service_provider SET first_name = ?, last_name = ?, store_name = ?, phone_number = ? WHERE service_provider_id = ?",
      [firstName, lastName, storeName, phoneNumber, serviceProviderId]
    );
    return res.status(200).json({ message: "Service provider updated!" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const Logout = async (req, res) => {
  const { eventierUserEmail } = req.body;
  try {
    const [serviceProvidersResult] = await connection.execute(
      "SELECT * FROM service_provider WHERE email = ?",
      [eventierUserEmail]
    );
    const serviceProviderId = serviceProvidersResult[0].service_provider_id;
    /**
     * Delete all the tokens for the user, hence logging them out
     * of all the logged in devices.
     * */
    await connection.execute(
      "DELETE FROM jwt_token WHERE service_provider_id = ?",
      [serviceProviderId]
    );
    return res.status(200).json({ message: "Logged out of all devices" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

module.exports = {
  GetAllServiceProviders,
  CreateNewServiceProvider,
  AddNewService,
  GetAllServiceProviderOrders: GetAllOrders,
  ChangeOrderStatus,
  GetAllServices,
  GetRatingsAndReviews,
  UpdateServiceProviderProfile,
  GetServiceProviderByEmail,
  ServiceProviderLogout: Logout,
};
