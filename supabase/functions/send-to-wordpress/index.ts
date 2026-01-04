import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordPressRequest {
  siteUrl: string;
  apiKey: string;
  username?: string;
  title: string;
  content: string;
  status?: 'draft' | 'publish';
}

// Encode credentials for Basic Auth (WordPress Application Passwords)
function encodeBasicAuth(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  return btoa(credentials);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('WordPress request received:', { 
      siteUrl: body.siteUrl, 
      testOnly: body.testOnly,
      hasApiKey: !!body.apiKey,
      hasUsername: !!body.username
    });

    const siteUrl = body.siteUrl?.replace(/\/$/, '');
    const apiKey = body.apiKey;
    const username = body.username || '';

    if (!siteUrl || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing siteUrl or apiKey' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine auth type: Pin Lions (pl_) or WordPress Application Password
    const isPinLionsKey = apiKey.startsWith('pl_');
    
    // Build auth headers
    let authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (isPinLionsKey) {
      // Pin Lions plugin uses Bearer token
      authHeaders['Authorization'] = `Bearer ${apiKey}`;
      authHeaders['X-PinLions-Key'] = apiKey;
    } else if (username) {
      // WordPress Application Password uses Basic Auth
      authHeaders['Authorization'] = `Basic ${encodeBasicAuth(username, apiKey)}`;
    } else {
      // Try as Bearer token fallback
      authHeaders['Authorization'] = `Bearer ${apiKey}`;
    }

    // Test connection only
    if (body.testOnly) {
      console.log('Testing connection to:', siteUrl);
      
      try {
        const siteInfoResponse = await fetch(`${siteUrl}/wp-json`, {
          headers: authHeaders,
        });

        if (!siteInfoResponse.ok) {
          const altResponse = await fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=1`, {
            headers: authHeaders,
          });

          if (!altResponse.ok) {
            const errorText = await altResponse.text();
            console.log('Connection test failed:', errorText);
            throw new Error('Could not connect to WordPress site. Check your credentials.');
          }

          const totalPosts = altResponse.headers.get('X-WP-Total') || '0';
          
          return new Response(
            JSON.stringify({
              success: true,
              site: {
                name: siteUrl.replace(/https?:\/\//, '').split('/')[0],
                url: siteUrl,
                posts: parseInt(totalPosts),
                version: 'v6.x',
              },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const siteInfo = await siteInfoResponse.json();
        
        const postsResponse = await fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=1`, {
          headers: authHeaders,
        });
        
        const totalPosts = postsResponse.headers.get('X-WP-Total') || '0';

        return new Response(
          JSON.stringify({
            success: true,
            site: {
              name: siteInfo.name || siteUrl.replace(/https?:\/\//, '').split('/')[0],
              url: siteInfo.url || siteUrl,
              posts: parseInt(totalPosts),
              version: siteInfo.description ? 'v6.x' : 'Unknown',
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Connection test failed:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create post
    const { title, content, status = 'draft' } = body as WordPressRequest;

    if (!title || !content) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing title or content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Wrap content in Classic block for WordPress Gutenberg
    const classicBlockContent = `<!-- wp:freeform -->
${content}
<!-- /wp:freeform -->`;

    console.log('Creating post:', { title, status, contentLength: content.length, isPinLionsKey });

    // Try Pin Lions endpoint first if using pl_ key, then standard WP REST API
    const endpoints = isPinLionsKey 
      ? [`${siteUrl}/wp-json/pinlions/v1/create-post`, `${siteUrl}/wp-json/wp/v2/posts`]
      : [`${siteUrl}/wp-json/wp/v2/posts`];

    let lastError = '';
    
    for (const endpoint of endpoints) {
      try {
        console.log('Trying endpoint:', endpoint);
        
        const postData = endpoint.includes('pinlions') 
          ? { title, content: classicBlockContent, status, api_key: apiKey }
          : { title, content: classicBlockContent, status };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(postData),
        });

        console.log('Response status:', response.status);

        if (response.ok) {
          const result = await response.json();
          console.log('Post created successfully:', result);
          
          const postId = result.id || result.post_id;
          const editUrl = `${siteUrl}/wp-admin/post.php?post=${postId}&action=edit`;
          
          return new Response(
            JSON.stringify({
              success: true,
              postId,
              editUrl,
              message: `Article created successfully as ${status}!`,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          console.log('Endpoint failed:', JSON.stringify(errorData));
          
          if (response.status === 401) {
            lastError = 'Authentication failed. For WordPress, use your username and an Application Password (Users → Profile → Application Passwords in WordPress admin).';
          } else if (response.status === 403) {
            lastError = 'Permission denied. Make sure your user has permission to create posts.';
          } else {
            lastError = errorData.message || `HTTP ${response.status}`;
          }
        }
      } catch (err) {
        console.error('Endpoint error:', err);
        lastError = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: lastError
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('WordPress function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
