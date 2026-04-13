// Central config for APK download links.
// Update this single file to change the download URL across the entire app.

export const APK_DOWNLOAD_URL =
  'https://github.com/priyanshu07rai/jeevan_setu/releases/download/v1.0.0/JeevanSetu.apk';

// QR code image URL — generated via free qrserver.com API (no library needed)
// Dark background (#111827) + orange foreground to match the card theme
export const APK_QR_URL =
  `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent('https://github.com/priyanshu07rai/jeevan_setu/releases/download/v1.0.0/JeevanSetu.apk')}&bgcolor=111827&color=e8630a&qzone=2&format=png`;
