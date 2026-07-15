// netlify/functions/api/upload.js
// Uploads base64 image to Supabase Storage, saves metadata to gallery_items table

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_BUCKET = 'gallery-public';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { fileBase64, fileName, caption, tags, comment, bucket } = body;

    if (!fileBase64 || !fileName) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing file or filename' }) };
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(fileBase64, 'base64');
    const ext = fileName.split('.').pop().toLowerCase();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const targetBucket = bucket || DEFAULT_BUCKET;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(uniqueName, buffer, { contentType: `image/${ext}`, upsert: false });

    if (uploadError) throw uploadError;

    // Get public URL (works for both public and private buckets; private needs signed URL for access)
    const { data: { publicUrl } } = supabase.storage.from(targetBucket).getPublicUrl(uniqueName);

    // Save metadata to gallery_items table
    const { error: dbError } = await supabase
      .from('gallery_items')
      .insert({ image_url: publicUrl, caption, tags, comment, created_at: new Date().toISOString() });

    if (dbError) throw dbError;

    return { statusCode: 200, body: JSON.stringify({ success: true, image_url: publicUrl }) };
  } catch (err) {
    console.error('Upload error:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
  }
};