export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
export function mediaError(file: File): string {
  const image = /\.(png|jpe?g)$/i.test(file.name) && ['image/png', 'image/jpeg'].includes(file.type);
  const video = /\.mp4$/i.test(file.name) && file.type === 'video/mp4';
  if (!image && !video) return 'Choose a PNG, JPG, JPEG or MP4 file.';
  if (file.size === 0) return 'The selected file is empty.';
  if (file.size > MAX_MEDIA_BYTES) return 'The selected file must be 50 MB or smaller.';
  return '';
}
