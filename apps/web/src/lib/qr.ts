import QRCode from 'qrcode';

/**
 * A QR code as an SVG, drawn on the server. Phase 42.
 *
 * SVG rather than a picture, so it prints sharp at any size and a label
 * printer's low resolution cannot blur the modules together. Medium error
 * correction survives a crease or a thumbprint on a key tag.
 */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}
