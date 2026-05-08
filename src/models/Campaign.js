const { Schema, models, model } = require("mongoose");

const campaignSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    goal: {
      type: String,
      trim: true,
      default: "",
    },
    signals: [
      {
        type: String,
        trim: true,
      },
    ],
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "paused", "running", "completed"],
      default: "draft",
    },
    results: {
      sends: { type: Number, default: 0, min: 0 },
      replies: { type: Number, default: 0, min: 0 },
      meetingsBooked: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true }
);

export const Campaign = models.Campaign || model("Campaign", campaignSchema);
