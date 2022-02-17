const connection = require("../database/connection");

async function customersOnly(req, res, next) {
  const { eventierUserEmail } = req.body;
  try {
    const [loginUserRow] = await connection.execute(
      "SELECT * FROM login WHERE login_email = ?",
      [eventierUserEmail]
    );
    const customerId = loginUserRow[0].customer_id;
    if (!customerId) {
      return res.status(401).json({ message: "Access denied" });
    }
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
}

async function serviceProvidersOnly(req, res, next) {
  const { eventierUserEmail } = req.body;
  try {
    const [loginUserRow] = await connection.execute(
      "SELECT * FROM login WHERE login_email = ?",
      [eventierUserEmail]
    );
    const serviceProviderId = loginUserRow[0].service_provider_id;
    if (!serviceProviderId) {
      return res.status(401).json({ message: "Access denied" });
    }
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
}

async function adminOnly(req, res, next) {
  console.log(req.body);
  const { eventierUserEmail } = req.body;
  try {
    const [loginAdminRow] = await connection.execute(
      "SELECT * FROM admin WHERE admin_email = ?",
      [eventierUserEmail]
    );
    if (loginAdminRow.length === 0) {
      return res.status(401).json({ message: "Access denied" });
    }
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  customersOnly,
  serviceProvidersOnly,
  adminOnly,
};
