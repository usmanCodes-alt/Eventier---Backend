const express = require("express");
const router = express.Router();

const {
  GetAllCustomers,
  CreateNewCustomer,
  GetLoggedInCustomer,
  AddReview,
  GetReviewsOfServiceById,
  PlaceOrder,
  ProcessPayment,
  AddToWishList,
  GetWishList,
  RemoveServiceFromWishList,
  CustomerUpdateProfile,
  GetCustomerOrders,
  GetAllServicesForCustomers,
  CustomerLogout,
} = require("../controllers/CustomerController");
const {
  GetAllServiceProviders,
  CreateNewServiceProvider,
  AddNewService,
  GetAllServiceProviderOrders,
  ChangeOrderStatus,
  GetAllServices,
  GetServiceDetailsById,
  GetAllRatingsAndReviews,
  GetOrderDetailsById,
  GetRatingsAndReviews,
  DeleteServiceImage,
  UpdateServiceProviderProfile,
  GetServiceProviderByEmail,
  UpdateService,
  ServiceProviderLogout,
} = require("../controllers/ServiceProviderController");
const {
  CreateAdmin,
  AdminLogin,
  BlockService,
  UnBlockService,
  BlockAccount, // for customer as well as service provider
  UnBlockAccount, // for customer as well as service provider
  GetCustomers,
  GetServiceProviders,
  GetServices,
} = require("../controllers/AdminController");
const {
  AddServiceImage,
  AddServiceProviderProfilePicture,
} = require("../controllers/ImagesController");
const {
  GenericLogin,
  ValidateJwtToken,
} = require("../controllers/LoginController");
const {
  GetRankedServiceProviders,
} = require("../controllers/RankingsController");
const {
  GetEventierUserByEmail,
  ResetPassword,
  ValidateOTPAndResetPassword,
  GetMostSoldProducts,
} = require("../controllers/GenericController");
const authentication = require("../middleware/authentication");
const adminAuth = require("../middleware/admin-auth");
const {
  customersOnly,
  serviceProvidersOnly,
  adminOnly,
} = require("../middleware/allowAccess");

// Multer setups imports
const {
  serviceImagesUploadEngine,
  profilePictureUploadEngine,
} = require("../utils/multer-setups");

const { v4: uuidv4 } = require("uuid");

/**
 * Generic login
 */

router.post("/eventier/login", GenericLogin);

/**
 * Admin routes
 */

router.post("/eventier/admin/create-admin", CreateAdmin);
router.post("/eventier/admin/login-admin", AdminLogin);
router.patch(
  "/eventier/admin/block-service/:serviceId",
  adminAuth,
  adminOnly,
  BlockService
);
router.patch(
  "/eventier/admin/unblock-service/:serviceId",
  adminAuth,
  adminOnly,
  UnBlockService
);
router.patch("/eventier/admin/block-account", adminAuth, BlockAccount);
router.patch("/eventier/admin/unblock-account", adminAuth, UnBlockAccount);
// router.post("/eventier/admin/get-all-customers", adminAuth, GetCustomers);
router.get(
  "/eventier/admin/get-all-service-providers",
  adminAuth,
  GetServiceProviders
);
router.get("/eventier/admin/get-all-services", adminAuth, GetServices);

/**
 * Customer routes
 */

router.get("/customers/all", GetAllCustomers);
router.post("/customers/create-new", CreateNewCustomer);
router.get(
  "/customers/get-details",
  authentication,
  customersOnly,
  GetLoggedInCustomer
);
router.get(
  "/customers/get-services",
  authentication,
  customersOnly,
  GetAllServicesForCustomers
);
router.post("/customers/review", authentication, customersOnly, AddReview);
router.post(
  "/customers/place-order",
  authentication,
  customersOnly,
  PlaceOrder
);
router.post("/customers/process-payment", ProcessPayment);
router.get(
  "/rankings",
  () => console.log("HIT1"),
  authentication,
  () => console.log("HIT2"),
  customersOnly,
  () => console.log("HIT3"),
  GetRankedServiceProviders
);
router.post(
  "/customers/wish-list/add",
  authentication,
  customersOnly,
  AddToWishList
);
router.get(
  "/customers/get-wish-list",
  authentication,
  customersOnly,
  GetWishList
);
router.delete(
  "/customers/wish-list/remove/:wishListId",
  authentication,
  customersOnly,
  RemoveServiceFromWishList
);
router.get(
  "/customers/get-orders",
  authentication,
  customersOnly,
  GetCustomerOrders
);
router.post(
  "/customers/profile-picture/add",
  authentication,
  customersOnly,
  profilePictureUploadEngine.single("cu-profile-picture"),
  AddServiceProviderProfilePicture
);
router.patch(
  "/customers/update-profile",
  authentication,
  customersOnly,
  CustomerUpdateProfile
);
router.delete(
  "/customers/logout",
  authentication,
  customersOnly,
  CustomerLogout
);

/**
 * Service provider routes
 */

router.get("/service-providers/all", GetAllServiceProviders);
router.get(
  "/service-provider/get-by-email/:email",
  authentication,
  serviceProvidersOnly,
  GetServiceProviderByEmail
);
router.post("/service-providers/create-new", CreateNewServiceProvider);

router.post(
  "/service-providers/add-service-with-images",
  authentication,
  serviceProvidersOnly,
  (req, res, next) => {
    req.uniqueImageUuid = uuidv4();
    next();
  },
  serviceImagesUploadEngine.array("service-images", 5),
  AddNewService
);

router.post(
  "/service-providers/update-service/add-service-image",
  authentication,
  serviceProvidersOnly,
  serviceImagesUploadEngine.single("service-image"),
  AddServiceImage
);

router.patch(
  "/service-provider/update-service",
  authentication,
  serviceProvidersOnly,
  UpdateService
);

router.post(
  "/service-provider/profile-picture/add",
  authentication,
  serviceProvidersOnly,
  profilePictureUploadEngine.single("sp-profile-picture"),
  AddServiceProviderProfilePicture
);

// type (query string) -> in-progress, delivered, accepted, rejected, if none is given fetch all orders
router.get(
  "/service-providers/get-orders",
  authentication,
  serviceProvidersOnly,
  GetAllServiceProviderOrders
);
router.delete(
  "/service-provider/delete-service-img",
  authentication,
  serviceProvidersOnly,
  DeleteServiceImage
);
router.patch(
  "/service-providers/update-order-status",
  authentication,
  serviceProvidersOnly,
  ChangeOrderStatus
);
router.get(
  "/service-providers/get-services",
  authentication,
  serviceProvidersOnly,
  GetAllServices
);
router.get(
  "/service-providers/get-ratings-and-reviews/:serviceId",
  authentication,
  serviceProvidersOnly,
  GetRatingsAndReviews
);
router.get(
  "/service-provider/get-all-ratings-and-reviews",
  authentication,
  serviceProvidersOnly,
  GetAllRatingsAndReviews
);
router.patch(
  "/service-providers/update-profile",
  authentication,
  serviceProvidersOnly,
  UpdateServiceProviderProfile
);
router.delete(
  "/service-providers/logout",
  authentication,
  serviceProvidersOnly,
  ServiceProviderLogout
);

/**
 * Accessible to Customers & Service Providers
 */
router.post("/trigger-reset-password", ResetPassword);
router.patch("/reset-password", ValidateOTPAndResetPassword);
router.get("/services/:serviceId", authentication, GetServiceDetailsById);
router.get("/orders/:orderId", authentication, GetOrderDetailsById);
router.get("/get/:eventierUserEmail", GetEventierUserByEmail);
router.get("/get-reviews/:serviceId", authentication, GetReviewsOfServiceById);
router.get("/validate-jwt", ValidateJwtToken);
router.get("/get-most-ordered", GetMostSoldProducts);

router.all("*", (req, res) => {
  return res.status(404).json({ message: "Invalid or not supported URL" });
});

module.exports = router;
