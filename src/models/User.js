const { Schema, models, model } = require("mongoose");

const userSchema = new Schema({
    name: {
        type: String,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    image: {
        type: String,
    },
    company: {
        type: String,
    },
    payment: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

export const User = models.User || model('User', userSchema);
