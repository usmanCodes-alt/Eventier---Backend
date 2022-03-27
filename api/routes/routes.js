const express = require("express");
const router = express.Router();

const {
  GetAllCustomers,
  CreateNewCustomer,
  AddReview,
  PlaceOrder,
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
  GetOrderDetailsById,
  GetRatingsAndReviews,
  UpdateServiceProviderProfile,
  GetServiceProviderByEmail,
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
} = require("../controllers/AdminController");
const {
  AddServiceImage,
  AddServiceProviderProfilePicture,
} = require("../controllers/ImagesController");
const { GenericLogin } = require("../controllers/LoginController");
const authentication = require("../middleware/authentication");
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
  authentication,
  adminOnly,
  BlockService
);
router.patch(
  "/eventier/admin/unblock-service/:serviceId",
  authentication,
  adminOnly,
  UnBlockService
);
router.patch("/eventier/admin/block-account", authentication, BlockAccount);
router.patch("/eventier/admin/unblock-account", authentication, UnBlockAccount);
router.post("/eventier/admin/get-all-customers", authentication, GetCustomers);
router.post(
  "/eventier/admin/get-all-service-providers",
  authentication,
  GetServiceProviders
);

/**
 * Customer routes
 */

router.get("/customers/all", GetAllCustomers);
router.post("/customers/create-new", CreateNewCustomer);
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
router.get(
  "/customers/get-orders",
  authentication,
  customersOnly,
  GetCustomerOrders
);
router.patch(
  "/customers/update-profile",
  authentication,
  customersOnly,
  /*upload.single("profile"),*/
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
  "/service-providers/add-service",
  authentication,
  serviceProvidersOnly,
  /**addServiceCredentialsCheckMiddleware */
  /*upload.array("serviceImages", 5),*/
  AddNewService
);
router.post(
  "/service-provider/add-service/upload-image",
  authentication,
  serviceProvidersOnly,
  serviceImagesUploadEngine.single("serviceImage"),
  AddServiceImage
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
  "/service-providers/get-ratings-and-reviews",
  authentication,
  serviceProvidersOnly,
  GetRatingsAndReviews
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
router.get("/services/:serviceId", authentication, GetServiceDetailsById);
router.get("/orders/:orderId", authentication, GetOrderDetailsById);

router.all("*", (req, res) => {
  return res.status(404).json({ message: "Invalid or not supported URL" });
});

module.exports = router;
