const connection = require("../database/connection");
const axios = require("axios");
const schedule = require("node-schedule");

const GetRankingsFromFlaskAPI = async (req, res) => {
  console.log("RUNNING SENTIMENT ANALYSIS");
  try {
    // await connection.execute("DELETE FROM sentiment");
    /**
     * Get all tweets which's analysis_performed is 0
     */
    const [reviews] = await connection.execute(
      "SELECT review_id, review_message, service_provider_id FROM reviews WHERE analysis_performed = ?",
      [String(0)]
    );
    if (reviews.length === 0) {
      // no new reviews have been added to perform sentiment analysis
      console.log("No new reviews added!");
      return;
    }
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
      .post(
        `${process.env.FLASK_MICROSERVICE_AZURE_URL}/get-sentiments`,
        flaskReviewsObject
      )
      .then(async (flaskRes) => {
        for (const sentimentNumber in flaskRes.data) {
          const {
            polarity,
            subjectivity,
            sp_id: service_provider_id,
            review,
          } = flaskRes.data[sentimentNumber];

          await connection.execute(
            "INSERT INTO sentiment (polarity, subjectivity, service_provider_id) VALUES(?, ?, ?)",
            [polarity, subjectivity, service_provider_id]
          );
        }
      })
      .catch((err) => console.log(err));
    // update analysis_performed col to 1
    for (const review of reviews) {
      await connection.execute(
        "UPDATE reviews SET analysis_performed = ? WHERE review_id = ?",
        [String(1), review.review_id]
      );
    }
  } catch (error) {
    console.log(error);
  }
};

const recurrenceRule = new schedule.RecurrenceRule();
recurrenceRule.hour = 24;
// recurrenceRule.second = 10;
schedule.scheduleJob(recurrenceRule, GetRankingsFromFlaskAPI);
