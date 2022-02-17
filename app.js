const express = require("express");
require("dotenv").config();
const morgan = require("morgan");
const cors = require("cors");
const router = require("./api/routes/routes");

const app = express();
const port = process.env.PORT || 3000;

app.use(morgan("tiny"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", router);

app.listen(port, () => {
  console.log("Server running on port " + port);
});
