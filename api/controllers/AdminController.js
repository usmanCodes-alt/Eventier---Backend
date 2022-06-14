const connection = require("../database/connection");
const bcrypt = require("bcrypt");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const CreateAdmin = async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }
  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: "Invalid Email!" });
  }
  try {
    const [adminRows] = await connection.execute(
      "SELECT * FROM admin WHERE admin_email = ?",
      [email]
    );
    if (adminRows.length !== 0) {
      return res.status(400).json({ message: "Email already exists!" });
    }
    const hashSalt = bcrypt.genSaltSync(Number(process.env.HASH_ROUNDS));
    const passwordHash = bcrypt.hashSync(password, hashSalt);
    await connection.execute(
      "INSERT INTO admin (first_name, last_name, admin_email, admin_password) VALUES (?, ?, ?, ?)",
      [firstName, lastName, email, passwordHash]
    );
    return res.status(201).json({ message: "Admin created" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const AdminLogin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }
  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: "Invalid Email" });
  }
  try {
    const [adminRows] = await connection.execute(
      "SELECT * FROM admin WHERE admin_email = ?",
      [email]
    );
    if (adminRows.length === 0) {
      return res.status(401).json({ message: "Incorrect Email or Password" });
    }
    const savedPasswordHash = adminRows[0].admin_password;
    const correctPassword = bcrypt.compareSync(password, savedPasswordHash);
    if (!correctPassword) {
      return res.status(412).json({ message: "Incorrect Email or Password" });
    }
    const token = jwt.sign(
      { eventierUserEmail: email },
      process.env.TOKEN_SECRET,
      {
        expiresIn: "6h",
      }
    );
    return res
      .status(200)
      .json({ message: "Successful Authentication", token, role: ["admin"] });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const GetCustomers = async (req, res) => {
  try {
    const [rows] = await connection.execute("SELECT * FROM customers");
    return res.status(200).json({ rows });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const GetServiceProviders = async (req, res) => {
  try {
    const [rows, _] = await connection.execute(
      `SELECT first_name, last_name, email, blocked
      FROM service_provider
      INNER JOIN login
      ON service_provider.email = login.login_email`
    );
    return res.status(200).json({ rows });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const GetServices = async (req, res) => {
  try {
    const [services] =
      await connection.execute(`SELECT service_id, service_name, service_type, blocked, service_provider.email, service_provider.store_name FROM services
      INNER JOIN service_provider
      ON services.service_provider_id = service_provider.service_provider_id      
    `);
    return res.status(200).json({ services });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const BlockService = async (req, res) => {
  const { serviceId } = req.params;
  if (!serviceId) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }
  try {
    await connection.execute(
      "UPDATE services SET blocked = ? WHERE service_id = ?",
      [String(1), serviceId]
    );
    return res.status(200).json({ message: "service blocked" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const UnBlockService = async (req, res) => {
  const { serviceId } = req.params;
  if (!serviceId) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }
  try {
    await connection.execute(
      "UPDATE services SET blocked = ? WHERE service_id = ?",
      [String(0), serviceId]
    );
    return res.status(200).json({ message: "Service un-blocked" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

const BlockAccount = async (req, res) => {
  const { targetAccountEmail } = req.body;
  if (!targetAccountEmail) {
    return res
      .status(412)
      .json({ message: "Please provide all required fields" });
  }
  try {
    const [result] = await connection.execute(
      "UPDATE login SET blocked = ? WHERE login_email = ?",
      [String(1), targetAccountEmail]
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Not updated, possible wrong email" });
    }
    return res.status(200).json({ message: "Account blocked" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const UnBlockAccount = async (req, res) => {
  const { targetAccountEmail } = req.body;
  if (!targetAccountEmail) {
    return res
      .status(412)
      .json({ message: "Please provide all required fields" });
  }
  try {
    const [result] = await connection.execute(
      "UPDATE login SET blocked = ? WHERE login_email = ?",
      [String(0), targetAccountEmail]
    );
    console.log(result);
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Not updated, possible wrong email" });
    }
    return res.status(200).json({ message: "Account un-blocked" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  CreateAdmin,
  AdminLogin,
  BlockService,
  UnBlockService,
  BlockAccount,
  UnBlockAccount,
  GetCustomers,
  GetServiceProviders,
  GetServices,
};
