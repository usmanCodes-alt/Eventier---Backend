const connection = require("../database/connection");
const axios = require("axios");
const schedule = require("node-schedule");

const GetRankingsFromFlaskAPI = async (req, res) => {
  console.log("RUNNING");
  try {
    await connection.execute("DELETE FROM sentiment");
    const [reviews] = await connection.execute(
      "SELECT review_message, service_provider_id FROM reviews"
    );

    const allReviews = [];
    reviews.forEach((review) => {
      allReviews.push({
        review: review.review_message,
        sp_id: review.service_provider_id,
      });
    });

    const flaskReviewsObject = {
      reviews: allReviews,
    };

    axios
      .post("http://127.0.0.1:5000/get-sentiments", flaskReviewsObject)
      .then(async (flaskRes) => {
        console.log(flaskRes.data);
        for (const sentimentNumber in flaskRes.data) {
          const {
            polarity,
            subjectivity,
            sp_id: service_provider_id,
          } = flaskRes.data[sentimentNumber];

          await connection.execute(
            "INSERT INTO sentiment (polarity, subjectivity, service_provider_id) VALUES(?, ?, ?)",
            [polarity, subjectivity, service_provider_id]
          );
        }
        // return res.status(200).json(flaskRes.data);
      })
      .catch((err) => console.log(err));
  } catch (error) {
    console.log(error);
    // return res.status(500).json({ message: "Internal server error!" });
  }
};

const recurrenceRule = new schedule.RecurrenceRule();
recurrenceRule.hour = 24;
schedule.scheduleJob(recurrenceRule, GetRankingsFromFlaskAPI);
