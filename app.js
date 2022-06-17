const express = require("express");
require("dotenv").config();
const sgMail = require("@sendgrid/mail");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");
const router = require("./api/routes/routes");
require("./api/utils/sentiment");

const app = express();
const port = process.env.PORT || 3000;
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.use(
  "/static",
  express.static(path.join(__dirname, "images/service-images"))
);
app.use(
  "/profile-pictures",
  express.static(path.join(__dirname, "images/profile-pictures"))
);

app.use(morgan("tiny"));
app.use(cors());
app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", router);

app.listen(port, () => {
  console.log("Server running on port " + port);
});
