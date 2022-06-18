const connection = require("../database/connection");

const GetRankedServiceProviders = async (req, res) => {
  try {
    const [sentiments] = await connection.execute(`
    SELECT service_provider.email, service_provider.first_name, service_provider.last_name, polarity, subjectivity
    FROM sentiment
    INNER JOIN service_provider
    ON sentiment.service_provider_id = service_provider.service_provider_id`);

    console.log(sentiments);

    if (sentiments.length === 0) {
      return res.status(404).json({
        message:
          "No sentiment analysis have been performed yet, please check back after 24 hours!",
      });
    }

    // console.log(sentiments);

    sentiments.sort(
      (sentimentObject1, sentimentObject2) =>
        sentimentObject1.polarity - sentimentObject2.polarity
    );

    console.log(sentiments);

    let serviceProviderReviews = [];

    for (const sentiment of sentiments) {
      const { polarity, email } = sentiment;
      if (
        !serviceProviderReviews.some(
          (serviceProviderReview) => serviceProviderReview.email === email
        )
      ) {
        serviceProviderReviews.push({
          email,
          numberOfPositiveReviews: 0,
          numberOfNegativeReviews: 0,
        });
      }

      if (polarity > 0) {
        for (const serviceProviderReviewObject of serviceProviderReviews) {
          if (serviceProviderReviewObject.email === email)
            serviceProviderReviewObject.numberOfPositiveReviews++;
        }
      } else if (polarity < 0) {
        for (const serviceProviderReviewObject of serviceProviderReviews) {
          if (serviceProviderReviewObject.email === email)
            serviceProviderReviewObject.numberOfNegativeReviews++;
        }
      }
    }
    console.log(serviceProviderReviews);
    return res.status(200).json({
      sentiments,
      individualServiceProviderReviewsInformation: serviceProviderReviews,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

module.exports = {
  GetRankedServiceProviders,
};
