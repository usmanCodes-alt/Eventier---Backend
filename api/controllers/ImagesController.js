const AddServiceImage = (req, res) => {
  return res.status(201).send(req.file);
};

const AddServiceProviderProfilePicture = (req, res) => {
  return res.status(200).send(req.file);
};

module.exports = {
  AddServiceImage,
  AddServiceProviderProfilePicture,
};
