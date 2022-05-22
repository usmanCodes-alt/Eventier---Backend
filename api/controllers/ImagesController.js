const connection = require("../database/connection");
const fs = require("fs");
const glob = require("glob");
const path = require("path");

const AddServiceImage = async (req, res) => {
  return res.status(201).send(req.file);
};

const AddServiceProviderProfilePicture = (req, res) => {
  return res.status(200).send(req.file);
};

module.exports = {
  AddServiceImage,
  AddServiceProviderProfilePicture,
};
