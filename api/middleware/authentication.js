const jwt = require("jsonwebtoken");
const connection = require("../database/connection");

/**
 * This authentication middleware will work for
 * 1) Customer
 * 2) Service Provider
 * 3) Admin
 * @param {*} req
 * @param {*} res
 * @param {*} next
 * @returns next middleware in line.
 */
module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.TOKEN_SECRET);
    /**
     * The user has provided the token and it is valid, now check of token
     * in the database, because a valid token would have been deleted if the
     * user has logged out.
     */
    const [tokenSelectResult] = await connection.execute(
      "SELECT * FROM jwt_token WHERE token = ?",
      [token]
    );
    if (tokenSelectResult.length === 0) {
      // the token is valid, but the user has logged out.
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.body.eventierUserEmail = decodedToken.eventierUserEmail;

    console.log("Logged in user email: " + req.body.eventierUserEmail);
    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
