const express = require("express");
const multer = require("multer");
const fs = require("fs");
const glob = require("glob");
const path = require("path");
const router = express.Router();

const {
  GetAllCustomers,
  CreateNewCustomer,
  AddReview,
  PlaceOrder,
  CustomerUpdateProfile,
  GetCustomerOrders,
  CustomerLogout,
} = require("../controllers/CustomerController");
const {
  GetAllServiceProviders,
  CreateNewServiceProvider,
  AddNewService,
  GetAllServiceProviderOrders,
  ChangeOrderStatus,
  GetAllServices,
  GetRatingsAndReviews,
  UpdateServiceProviderProfile,
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
const { AddServiceImage } = require("../controllers/ImagesController");
const { GenericLogin } = require("../controllers/LoginController");
const authentication = require("../middleware/authentication");
const {
  customersOnly,
  serviceProvidersOnly,
  adminOnly,
} = require("../middleware/allowAccess");

/**
 * Multer setup
 */
const fileStorageEngine = multer.diskStorage({
  destination: (req, file, callback) => {
    if (
      !fs.existsSync(
        path.join(
          __dirname,
          "../../images/service-images/" + req.body.eventierUserEmail
        )
      )
    ) {
      console.log("creating directory");
      fs.mkdirSync(
        path.join(
          __dirname,
          "../../images/service-images/" + req.body.eventierUserEmail
        )
      );
    }
    callback(
      null,
      path.join(
        __dirname,
        "../../images/service-images/" + req.body.eventierUserEmail
      )
    );
  },
  filename: (req, file, callback) => {
    /**
     * ! MAKE SURE TO SEND eventierUserEmail AND serviceType FROM THE
     * ! FRONTEND
     */
    let { eventierUserEmail } = req.body;
    const { serviceType } = req.body;
    eventierUserEmail = eventierUserEmail.split("@")[0];

    const matches = glob.sync(
      eventierUserEmail + "--" + serviceType + "--" + "*.*",
      {
        cwd: path.join(
          __dirname,
          "../../images/service-images/" + req.body.eventierUserEmail
        ),
      }
    );
    console.log(matches);
    if (matches.length >= 5) {
      return callback("Limit exceeded");
    }

    callback(
      null,
      eventierUserEmail + "--" + serviceType + "--" + file.originalname
    );
  },
});

const upload = multer({
  storage: fileStorageEngine,
  fileFilter: function (req, file, cb) {
    const allowedExtensions = /jpeg|jpg|png/;
    const extensionNameTest = allowedExtensions.test(
      path.extname(file.originalname).toLocaleLowerCase()
    );
    if (extensionNameTest) {
      return cb(null, true);
    } else {
      return cb("Wrong extension", false);
    }
  },
});

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
  upload.single("serviceImage"),
  AddServiceImage
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

router.all("*", (req, res) => {
  return res.status(404).json({ message: "Invalid or not supported URL" });
});

module.exports = router;
