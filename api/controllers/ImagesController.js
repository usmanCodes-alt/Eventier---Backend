const AddServiceImage = (req, res) => {
  return res.status(201).send(req.file);
};

const AddServiceProviderProfilePicture = (req, res) => {
  return res
    .status(200)
    .json({ message: "Profile picture uploaded successfully" });
};

module.exports = {
  AddServiceImage,
  AddServiceProviderProfilePicture,
};
