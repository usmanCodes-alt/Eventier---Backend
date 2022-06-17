const connection = require("../database/connection");
const { faker } = require("@faker-js/faker");
const glob = require("glob");
const path = require("path");
const bcrypt = require("bcrypt");
const sgMail = require("@sendgrid/mail");

const GetMostSoldProducts = async (req, res) => {
  const SERVICES = [];

  try {
    const [mostOrderedServiceIds] = await connection.execute(`SELECT
    service_id,
    COUNT(service_id) AS 'value_occurrence' 
    FROM orders
    GROUP BY service_id
    ORDER BY 'value_occurrence' DESC
    LIMIT 4;
  `);

    for (const serviceIdCount of mostOrderedServiceIds) {
      const { service_id } = serviceIdCount;

      const [service] = await connection.execute(
        `SELECT * FROM services
        INNER JOIN service_provider
        ON services.service_provider_id = service_provider.service_provider_id
        WHERE services.service_id = ?`,
        [service_id]
      );

      const { service_type, email, images_uuid } = service[0];
      const emailPrefix = email.split("@")[0];

      const matches = glob.sync(
        emailPrefix + "--" + service_type + "--" + images_uuid + "--" + "*.*",
        {
          cwd: path.join(__dirname, "../../images/service-images/" + email),
        }
      );

      if (matches.length > 0) {
        service[0][
          "static_url"
        ] = `http://localhost:3000/static/${email}/${matches[0]}`;
      }

      SERVICES.push(service[0]);
    }

    return res.status(200).json({ services: SERVICES.reverse() });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

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

const ResetPassword = async (req, res) => {
  const { eventierUserEmail } = req.body;

  if (!eventierUserEmail)
    return res.status(400).json({ message: "Please provide an email" });
  /**
   * 0) Check if the provided user email exists in database.
   * 1) Creates OTP and stores that in the database.
   * 2) Send user an email with that OTP embedded in it's HTML.
   */
  try {
    /**
     * If there are any other OTPs for this user in the database, delete them.
     */
    await connection.execute("DELETE FROM otp WHERE eventier_user_email = ?", [
      eventierUserEmail,
    ]);
    const [eventierUserRow] = await connection.execute(
      "SELECT * FROM login WHERE login_email = ?",
      [eventierUserEmail]
    );
    console.log(eventierUserRow);
    if (eventierUserRow.length === 0) {
      return res
        .status(404)
        .json({ message: "No user found with this email." });
    }

    const OTP = faker.datatype.number(100);
    console.log("OTP generated: ", OTP);
    await connection.execute(
      "INSERT INTO otp (otp, expired_in, eventier_user_email) VALUES(?, ?, ?)",
      [OTP, new Date(+new Date() + 60000 * 15), eventierUserEmail]
    );

    const mail = {
      to: eventierUserEmail,
      from: process.env.SENDGRID_SENDER,
      subject: "Eventier - Reset Password",
      templateId: "d-e0f84852247f4b4d897df157d67745f0",
      dynamic_template_data: { OTP, eventierUserEmail },
    };

    sgMail
      .send(mail)
      .then(() => {
        return res.status(200).json({ message: "Mail sent" });
      })
      .catch((err) => {
        throw new Error(err.message);
      });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const ValidateOTPAndResetPassword = async (req, res) => {
  const { otp, newPassword, confirmNewPassword, eventierUserEmail } = req.body;

  if (!otp || !newPassword || !confirmNewPassword || !eventierUserEmail) {
    return res
      .status(412)
      .json({ message: "Please provide all required fields" });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(412).json({ message: "Passwords don't match!" });
  }

  try {
    const [otpRows] = await connection.execute(
      "SELECT * FROM OTP WHERE otp = ? AND eventier_user_email = ?",
      [otp, eventierUserEmail]
    );

    if (otpRows.length === 0) {
      return res.status(400).json({ message: "No OTP found!" });
    }

    const { otp: databaseOtp, expired_in } = otpRows[0];

    if (databaseOtp !== otp) {
      return res.status(400).json({ message: "OTP does not match" });
    }
    if (new Date(expired_in) < new Date()) {
      return res.status(400).json({ message: "OTP has been expired!" });
    }

    // change password!
    console.log("change password");
    await connection.execute("DELETE FROM otp WHERE eventier_user_email = ?", [
      eventierUserEmail,
    ]);

    const hashSalt = bcrypt.genSaltSync(Number(process.env.HASH_ROUNDS));
    const hash = bcrypt.hashSync(newPassword, hashSalt);

    const [loginRow] = await connection.execute(
      "SELECT * FROM login WHERE login_email = ?",
      [eventierUserEmail]
    );
    const { service_provider_id, customer_id } = loginRow[0];
    await connection.execute(
      "UPDATE login SET login_password = ? WHERE login_email = ?",
      [hash, eventierUserEmail]
    );
    if (service_provider_id) {
      // service_provider_id value is not null, change in service provider table.
      await connection.execute(
        "UPDATE service_provider SET password = ? WHERE email = ?",
        [hash, eventierUserEmail]
      );
    } else if (customer_id) {
      await connection.execute(
        "UPDATE customers SET password = ? WHERE email = ?",
        [hash, eventierUserEmail]
      );
    }
    return res.status(200).json({ message: "Password updated!" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  GetEventierUserByEmail,
  ResetPassword,
  ValidateOTPAndResetPassword,
  GetMostSoldProducts,
};
