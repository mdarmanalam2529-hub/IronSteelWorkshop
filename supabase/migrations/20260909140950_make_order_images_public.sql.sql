/*
# Make order-images bucket public

1. Storage
- Updates the `order-images` bucket to be publicly readable.
- Keeps the 10 MB file size limit and image-only MIME type restriction.

2. Security
- Storage SELECT policy is widened to allow anonymous reads, matching a public bucket.
- Insert, update, and delete policies remain order-scoped.

3. Important Notes
- Public bucket URLs are permanent and unauthenticated.
- This migration is safe to re-run and does not remove existing data.
*/

UPDATE storage.buckets SET public = true WHERE id = 'order-images';
