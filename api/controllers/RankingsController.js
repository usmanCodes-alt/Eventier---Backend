const connection = require("../database/connection");
const fetch = require("node-fetch");
// const request = require("request");

const GetRankingsFromFlaskAPI = async (req, res) => {
  try {
    const [reviews] = await connection.execute(
      "SELECT review_message FROM reviews"
    );

    const allReviews = [];
    reviews.forEach((review) => {
      allReviews.push(review.review_message);
    });

    const flaskReviewsObject = {
      reviews: allReviews,
    };

    fetch("http://127.0.0.1:5000/get-sentiments", {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        reviews: ["Good", "bad"],
      }),
    })
      .then((res) => {
        console.log(res); // working!!
      })
      .catch((err) => {
        console.log("err");
        console.log(err);
      });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

module.exports = {
  GetRankingsFromFlaskAPI,
};
