const mongoose = require('mongoose');

const TripSchema = new mongoose.Schema({
  "Trip ID": {
    type: Number,
    required: true
  },
  "Destination": {
    type: String,
    required: true
  },
  "Start date": {
    type: String,
    required: true
  },
  "End date": {
    type: String,
    required: true
  },
  "Duration (days)": {
    type: Number,
    required: true
  },
  "Traveler name": {
    type: String,
    required: true
  },
  "Traveler age": {
    type: Number,
    required: true
  },
  "Traveler gender": {
    type: String,
    required: true
  },
  "Traveler nationality": {
    type: String,
    required: true
  },
  "Accommodation type": {
    type: String,
    required: true
  },
  "Accommodation cost": {
    type: Number,
    required: true
  },
  "Transportation type": {
    type: String,
    required: true
  },
  "Transportation cost": {
    type: Number,
    required: true
  }
}, {
  timestamps: true,
  collection: 'statistics'  // Changed this to match your collection name
});

module.exports = mongoose.model('Trip', TripSchema);