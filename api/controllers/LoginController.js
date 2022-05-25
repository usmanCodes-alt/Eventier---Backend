const connection = require("../database/connection");
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/**
 * This Login route is for Customer and Service Provider only, not Admin.
 * Logs in a Eventier user by querying login table in the database.
 * Does not let the user log in whose account has been suspended by the admins.
 * @param {*} req
 * @param {*} res
 * @returns Authorization JWT Token
 */
const GenericLogin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(412)
      .json({ message: "Please provide all required fields" });
  }
  const isValidEmail = validator.isEmail(email);
  if (!isValidEmail) {
    return res.status(412).json({ message: "Invalid Email" });
  }
  try {
    const [loginTableRow] = await connection.execute(
      "SELECT * FROM login WHERE login_email = ?",
      [email]
    );
    if (loginTableRow.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const blockedStatus = loginTableRow[0].blocked;
    if (blockedStatus === "1") {
      return res
        .status(401)
        .json({ message: "Your account has been suspended temporarily" });
    }
    const eventierUser = loginTableRow[0];
    const roles = [];
    if (eventierUser.service_provider_id) {
      roles.push("service_provider");
    }
    if (eventierUser.customer_id) {
      roles.push("customer");
    }
    const confirmPassword = bcrypt.compareSync(
      password,
      eventierUser.login_password
    );
    if (!confirmPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    /**
     * Store the following token in the database
     */
    const token = jwt.sign(
      { eventierUserEmail: email, userRoles: roles },
      process.env.TOKEN_SECRET,
      {
        expiresIn: "1h", // expire in 1 hour
      }
    );

    let tokenInsertSqlString =
      "INSERT INTO jwt_token (token, customer_id, service_provider_id) VALUES (?, ?, ?)";
    const dependenciesArray = [];
    dependenciesArray.push(token);
    dependenciesArray.push(eventierUser.customer_id);
    dependenciesArray.push(eventierUser.service_provider_id);

    await connection.execute(tokenInsertSqlString, dependenciesArray);
    return res
      .status(200)
      .json({ message: "Successful Authentication", token, roles });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const ValidateJwtToken = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    jwt.verify(token, process.env.TOKEN_SECRET);
    return res.status(200).json({ message: "Valid JWT" });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: "Malformed JWT" });
  }
};

module.exports = {
  GenericLogin,
  ValidateJwtToken,
};
