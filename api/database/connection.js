const mysql = require("mysql2");

// module.exports = mysql
//   .createConnection({
//     host: "localhost",
//     user: "root",
//     password: "admin",
//     database: "eventier_db",
//   })
//   .then(() => {
//     console.log("Connected to database!");
//   })
//   .catch((err) => {
//     console.log(err);
//   });

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "admin",
  database: "eventier_db",
});

module.exports = pool.promise();
