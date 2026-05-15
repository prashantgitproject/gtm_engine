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
    /** Sender domain for Brevo (e.g. acme.com). Set from Settings → Email. */
    senderDomain: {
        type: String,
        default: null,
    },
    linkedinConnected: {
        type: Boolean,
        default: false,
    },
    linkedinTokenCipher: {
        type: String,
        default: null,
    },
    linkedinTokenIv: {
        type: String,
        default: null,
    },
    linkedinTokenTag: {
        type: String,
        default: null,
    },
    linkedinTokenExpiresAt: {
        type: Date,
        default: null,
    },
    linkupAccountId: {
        type: String,
        default: null,
    },
    /** WhatsApp Cloud API — number must be registered on WhatsApp Business Platform (not personal WhatsApp). */
    whatsappConnected: {
        type: Boolean,
        default: false,
    },
    whatsappPhoneNumberId: {
        type: String,
        default: null,
    },
    /** Graph API WhatsApp Business Account ID — used only for `/{waba-id}/message_templates`, never Phone number ID or App ID. */
    whatsappBusinessAccountId: {
        type: String,
        default: null,
    },
    whatsappDisplayPhone: {
        type: String,
        default: null,
    },
    whatsappVerifiedName: {
        type: String,
        default: null,
    },
    whatsappTokenCipher: {
        type: String,
        default: null,
    },
    whatsappTokenIv: {
        type: String,
        default: null,
    },
    whatsappTokenTag: {
        type: String,
        default: null,
    },
}, { timestamps: true });

export const User = models.User || model('User', userSchema);
