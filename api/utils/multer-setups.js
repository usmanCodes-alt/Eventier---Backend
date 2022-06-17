/**
 * This file contains multer setups for service image uploads
 * as well as eventier user profile picture uploads.
 * Both setups along with their logics are exported from one single
 * file and used where they are required.
 */

const multer = require("multer");
const fs = require("fs");
const glob = require("glob");
const path = require("path");

const serviceImageFileStorageEngine = multer.diskStorage({
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
  filename: async (req, file, callback) => {
    console.log(req.body);
    let { eventierUserEmail } = req.body;
    const { serviceType } = req.body;
    eventierUserEmail = eventierUserEmail.split("@")[0];

    const uniqueImageUuid = req.body.uniqueImageUuid
      ? req.body.uniqueImageUuid
      : req.uniqueImageUuid;

    const matches = glob.sync(
      eventierUserEmail +
        "--" +
        serviceType +
        "--" +
        uniqueImageUuid +
        "--" +
        "*.*",
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
      eventierUserEmail +
        "--" +
        serviceType +
        "--" +
        uniqueImageUuid +
        "--" +
        file.originalname
    );
  },
});

const serviceImagesUploadEngine = multer({
  storage: serviceImageFileStorageEngine,
  // fileFilter: function (req, file, cb) {
  //   const allowedExtensions = /jpeg|jpg|png/;
  //   const extensionNameTest = allowedExtensions.test(
  //     path.extname(file.originalname).toLocaleLowerCase()
  //   );
  //   if (extensionNameTest) {
  //     return cb(null, true);
  //   } else {
  //     return cb("Wrong extension", false);
  //   }
  // },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype == "image/png" ||
      file.mimetype == "image/jpeg" ||
      file.mimetype == "image/jpg"
    ) {
      cb(null, true);
    } else {
      cb(null, false);
      const err = new Error("Only .jpg .jpeg .png images are supported!");
      err.name = "ExtensionError";
      return cb(err);
    }
  },
});

const userProfilePictureFileStorageEngine = multer.diskStorage({
  destination: (req, file, callback) => {
    if (
      !fs.existsSync(
        path.join(
          __dirname,
          // "../../images/profile-pictures/" + req.body.eventierUserEmail
          "../../../images/profile-pictures/" + req.body.eventierUserEmail
        )
      )
    ) {
      console.log("creating directory");
      fs.mkdirSync(
        path.join(
          __dirname,
          "../../images/profile-pictures/" + req.body.eventierUserEmail
        )
      );
    }
    callback(
      null,
      path.join(
        __dirname,
        // "../../images/profile-pictures/" + req.body.eventierUserEmail
        "../../../images/profile-pictures/" + req.body.eventierUserEmail
      )
    );
  },
  filename: (req, file, callback) => {
    // before storing the profile picture file, make sure to delete the previous profile picture
    let { eventierUserEmail } = req.body;
    eventierUserEmail = eventierUserEmail.split("@")[0];

    // search for any already existing profile picture
    const matches = glob.sync(eventierUserEmail + "*.*", {
      cwd: path.join(
        __dirname,
        // "../../images/profile-pictures/" + req.body.eventierUserEmail
        "../../../images/profile-pictures/" + req.body.eventierUserEmail
      ),
    });

    if (matches.length > 0) {
      // there exists a profile picture, delete it.
      const directory = path.join(
        __dirname,
        // "../../images/profile-pictures/" + req.body.eventierUserEmail
        "../../../images/profile-pictures/" + req.body.eventierUserEmail
      );
      fs.readdirSync(directory).forEach((file) =>
        fs.rmSync(`${directory}/${file}`)
      );
    }

    callback(null, eventierUserEmail + file.originalname);
  },
});

const profilePictureUploadEngine = multer({
  storage: userProfilePictureFileStorageEngine,
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

module.exports = {
  serviceImagesUploadEngine,
  profilePictureUploadEngine,
};
