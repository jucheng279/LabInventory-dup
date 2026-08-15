/*
# Secure storage buckets: add file size limits and MIME type restrictions

1. Security Changes
   - `slide-images` bucket: 15 MB file size limit, restricted to common image types.
   - `icons` bucket: 2 MB file size limit, restricted to SVG and common image types.

2. Important Notes
   - The frontend already enforces a 15 MB limit for slide images but direct API
     calls could bypass it. This now enforces it server-side.
   - Icons are SVGs so we allow SVG plus common raster formats.
   - These limits match what the app already accepts in the UI.
*/

UPDATE storage.buckets
SET file_size_limit = 15728640,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/tiff', 'image/svg+xml']
WHERE id = 'slide-images';

UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/svg+xml', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']
WHERE id = 'icons';
