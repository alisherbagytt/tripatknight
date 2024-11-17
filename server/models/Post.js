const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const PostSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  images: {
    type: [String], // Array of image URLs
    validate: {
      validator: function (value) {
        return value.length >= 3; // Ensure at least 3 images
      },
      message: 'A post must have at least 3 images.'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Post', PostSchema);
