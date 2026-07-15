// netlify/functions/api/upload.js
// Two-step upload flow:
// 1. GET /api/upload-url?bucket=...&filename=... -> returns signed URL + object path
// 2. POST /api/save-metadata -> saves caption/tags/comment to database

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_BUCKET = 'gallery-public';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  const path = event.path.replace('/.netlify/functions/api', '');
  
  try {
    // GET /upload-url?bucket=...&filename=...
    if (event.httpMethod === 'GET' && path === '/upload-url') {
      return await handleGetUploadUrl(event);
    }
    
    // POST /save-metadata
    if (event.httpMethod === 'POST' && path === '/save-metadata') {
      return await handleSaveMetadata(event);
    }
    
    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Step 1: Generate signed upload URL
async function handleGetUploadUrl(event) {
  const { bucket = DEFAULT_BUCKET, filename } = event.queryStringParameters || {};
  
  if (!filename) {
    return { statusCode: 400, body: JSON.stringify({ error: 'filename required' }) };
  }
  
  // Generate unique object path
  const ext = filename.split('.').pop().toLowerCase();
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  
  // Create signed upload URL (valid for 1 hour)
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(uniqueName);
  
  if (error) throw error;
  
  // Get public URL for later reference
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(uniqueName);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      signedUrl: data.signedUrl,
      objectPath: uniqueName,
      publicUrl,
      bucket
    })
  };
}

// Step 2: Save metadata to database
async function handleSaveMetadata(event) {
  const body = JSON.parse(event.body);
  const { objectPath, bucket, caption, tags, comment } = body;
  
  if (!objectPath || !bucket) {
    return { statusCode: 400, body: JSON.stringify({ error: 'objectPath and bucket required' }) };
  }
  
  // Get the public URL
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  
  // Insert into gallery_items
  const { error } = await supabase
    .from('gallery_items')
    .insert({
      image_url: publicUrl,
      caption: caption || '',
      tags: tags || [],
      comment: comment || '',
      bucket,
      created_at: new Date().toISOString()
    });
  
  if (error) throw error;
  
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, image_url: publicUrl })
  };
}