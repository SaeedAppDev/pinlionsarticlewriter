import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordPressRequest {
  siteUrl: string;
  apiKey: string;
  title: string;
  content: string;
  status?: 'draft' | 'publish';
}

interface TestConnectionRequest {
  siteUrl: string;
  apiKey: string;
  testOnly: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('WordPress request received:', { 
      siteUrl: body.siteUrl, 
      testOnly: body.testOnly,
      hasApiKey: !!body.apiKey 
    });

    const siteUrl = body.siteUrl?.replace(/\/$/, ''); // Remove trailing slash
    const apiKey = body.apiKey;

    if (!siteUrl || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing siteUrl or apiKey' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test connection only
    if (body.testOnly) {
      console.log('Testing connection to:', siteUrl);
      
      try {
        // Try to get site info using WordPress REST API
        const siteInfoResponse = await fetch(`${siteUrl}/wp-json`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!siteInfoResponse.ok) {
          // Try alternative endpoint
          const altResponse = await fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=1`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });

          if (!altResponse.ok) {
            throw new Error('Could not connect to WordPress site');
          }

          // Get post count from headers
          const totalPosts = altResponse.headers.get('X-WP-Total') || '0';
          
          return new Response(
            JSON.stringify({
              success: true,
              site: {
                name: siteUrl.replace(/https?:\/\//, '').split('/')[0],
                url: siteUrl,
                posts: parseInt(totalPosts),
                version: 'Unknown',
              },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const siteInfo = await siteInfoResponse.json();
        
        // Get post count
        const postsResponse = await fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=1`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
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
    // This ensures the content appears in the Classic editor format
    const classicBlockContent = `<!-- wp:freeform -->
${content}
<!-- /wp:freeform -->`;

    console.log('Creating post:', { title, status, contentLength: content.length });

    // Try different endpoints - Pin Lions plugin endpoint first, then standard WP REST API
    const endpoints = [
      `${siteUrl}/wp-json/pinlions/v1/create-post`,
      `${siteUrl}/wp-json/wp/v2/posts`,
    ];

    let lastError = '';
    
    for (const endpoint of endpoints) {
      try {
        console.log('Trying endpoint:', endpoint);
        
        const postData = endpoint.includes('pinlions') 
          ? { title, content: classicBlockContent, status, api_key: apiKey }
          : { title, content: classicBlockContent, status };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postData),
        });

        console.log('Response status:', response.status);

        if (response.ok) {
          const result = await response.json();
          console.log('Post created successfully:', result);
          
          // Get the edit URL
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
          const errorText = await response.text();
          console.log('Endpoint failed:', errorText);
          lastError = errorText;
        }
      } catch (err) {
        console.error('Endpoint error:', err);
        lastError = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Failed to create post: ${lastError}` 
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
