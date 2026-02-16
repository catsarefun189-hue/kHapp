// Importing necessary libraries for QR code generation and scanning
const QRCode = require('qrcode');
const jsQR = require('jsqr');

/**
 * Generates a QR code as a data URL
 * @param {string} text - The text to encode in the QR code
 * @returns {Promise<string>} - The data URL of the generated QR code
 */
const generateQRCode = async (text) => {
    try {
        const qrCodeDataUrl = await QRCode.toDataURL(text);
        return qrCodeDataUrl;
    } catch (error) {
        throw new Error('Failed to generate QR code: ' + error.message);
    }
};

/**
 * Scans a QR code from an image and extracts its text
 * @param {ImageData} imageData - The image data of the QR code
 * @returns {string|null} - The text from the QR code, or null if not found
 */
const scanQRCode = (imageData) => {
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    return code ? code.data : null;
};

module.exports = { generateQRCode, scanQRCode };