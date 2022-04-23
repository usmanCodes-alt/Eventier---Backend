const connection = require("../database/connection");

const GetEventierUserByEmail = async (req, res) => {
  const { eventierUserEmail } = req.params;
  if (!eventierUserEmail) {
    return res.status(412).json({ message: "Please provide an email id" });
  }

  console.log(eventierUserEmail);

  try {
    const [eventierUserRow] = await connection.execute(
      "SELECT * FROM login WHERE login_email = ?",
      [eventierUserEmail]
    );

    const user = eventierUserRow[0];
    if (!user.service_provider_id) {
      // user is the customer
      const [customerRow] = await connection.execute(
        "SELECT first_name, last_name FROM customers WHERE email = ?",
        [eventierUserEmail]
      );

      //   console.log("CUSTOMER", customerRow);
      return res.status(200).json({ EventierUserRow: customerRow });
    } else {
      // user is a service provider
      const [serviceProviderRow] = await connection.execute(
        "SELECT first_name, last_name FROM service_provider WHERE email = ?",
        [eventierUserEmail]
      );

      //   console.log("SERVICE PROVIDER ROW", serviceProviderRow);
      return res.status(200).json({ EventierUserRow: serviceProviderRow });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  GetEventierUserByEmail,
};
