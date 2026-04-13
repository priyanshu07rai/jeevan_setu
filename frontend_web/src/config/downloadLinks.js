// Central config for APK download links.
// Single source of truth — update here to change button + QR everywhere.

export const APK_DOWNLOAD_URL =
  'https://github.com/priyanshu07rai/jeevan_setu/releases/download/v1.0.0/JeevanSetu.apk';

// QR code image — uses same URL above, generated via free qrserver.com API (no library needed)
export const APK_QR_URL =
  `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent('https://github.com/priyanshu07rai/jeevan_setu/releases/download/v1.0.0/JeevanSetu.apk')}&bgcolor=111827&color=e8630a&qzone=2&format=png`;

