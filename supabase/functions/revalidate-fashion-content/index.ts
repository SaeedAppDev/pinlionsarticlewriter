import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DetectedOutfit {
  topPiece: string;
  bottomPiece: string;
  footwear: string;
  accessories: string[];
  colors: string[];
  layering: string[];
  vibe: 'casual' | 'elegant' | 'formal' | 'edgy' | 'romantic' | 'sporty' | 'bohemian';
  confidenceScore: number;
}

// Analyze a single fashion image using Lovable AI (Gemini with vision)
async function analyzeOutfitImage(
  imageUrl: string,
  LOVABLE_API_KEY: string
): Promise<DetectedOutfit | null> {
  try {
    console.log(`🔍 Analyzing outfit image for content validation...`);
    
    const analysisPrompt = `You are a fashion image analyst. Analyze this outfit photograph and extract ONLY what is CLEARLY VISIBLE in the image.

CRITICAL RULES:
1. ONLY list items you can actually SEE in the image
2. If something is not visible or unclear, DO NOT mention it
3. Never assume jewelry, bags, or accessories unless clearly visible
4. Match colors as closely as possible to what you see
5. Be specific about clothing types (e.g., "longline cardigan" not just "cardigan")

Respond in this EXACT JSON format:
{
  "topPiece": "description of main top layer (e.g., 'rust-colored longline cardigan' or 'cream fitted turtleneck')",
  "innerTop": "description of inner layer if visible (e.g., 'cream turtleneck') or null if not visible",
  "bottomPiece": "description of bottoms (e.g., 'medium-wash high-waisted jeans')",
  "footwear": "description of shoes (e.g., 'black leather ankle boots with block heel') or 'not fully visible' if cut off",
  "accessories": ["only items clearly visible like 'small gold hoop earrings'"] or [] if none visible,
  "colors": ["rust/terracotta", "cream/ivory", "medium blue denim", "black"],
  "layering": ["turtleneck", "open cardigan"] - describe the layering order if applicable,
  "vibe": "casual" | "elegant" | "formal" | "edgy" | "romantic" | "sporty" | "bohemian",
  "confidenceScore": 0-100 based on image clarity
}

Be strict and honest. If you cannot clearly see an item, do not include it.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('Image analysis failed:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not parse outfit analysis JSON');
      return null;
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`✅ Image analysis complete: ${parsed.vibe} vibe, ${parsed.confidenceScore}% confidence`);
    
    return parsed as DetectedOutfit;
  } catch (error) {
    console.error('Error analyzing outfit image:', error);
    return null;
  }
}

// Validate and correct entire fashion article based on image analysis
async function validateAndCorrectFashionContent(
  articleContent: string,
  imageUrls: string[],
  LOVABLE_API_KEY: string
): Promise<{ correctedContent: string; accuracyScore: number; corrections: string[] }> {
  console.log(`🔄 Validating fashion content against ${imageUrls.length} images...`);
  
  const corrections: string[] = [];
  let totalConfidence = 0;
  let analyzedCount = 0;
  let correctedContent = articleContent;
  
  // Analyze each image and validate corresponding content
  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    if (!imageUrl || imageUrl.length === 0) continue;
    
    const detected = await analyzeOutfitImage(imageUrl, LOVABLE_API_KEY);
    if (!detected) continue;
    
    analyzedCount++;
    totalConfidence += detected.confidenceScore;
    
    // Find the corresponding outfit section in content
    const outfitNumber = i + 1;
    const sectionRegex = new RegExp(
      `(<h2>${outfitNumber}\\.\\s*[^<]+</h2>[\\s\\S]*?)(?=<h2>\\d+\\.|$)`,
      'i'
    );
    const sectionMatch = correctedContent.match(sectionRegex);
    
    if (!sectionMatch) continue;
    
    const originalSection = sectionMatch[1];
    
    // Check for items mentioned in content but not visible in image
    const outfitPiecesMatch = originalSection.match(/<h3>Outfit Pieces:<\/h3>\s*<ul>([\s\S]*?)<\/ul>/i);
    if (!outfitPiecesMatch) continue;
    
    const listedItems = outfitPiecesMatch[1].toLowerCase();
    
    // Common false items to check for
    const potentialFalseItems = [
      { term: 'necklace', visible: detected.accessories.some(a => a.toLowerCase().includes('necklace')) },
      { term: 'bracelet', visible: detected.accessories.some(a => a.toLowerCase().includes('bracelet')) },
      { term: 'watch', visible: detected.accessories.some(a => a.toLowerCase().includes('watch')) },
      { term: 'bag', visible: detected.accessories.some(a => a.toLowerCase().includes('bag') || a.toLowerCase().includes('purse')) },
      { term: 'belt', visible: detected.accessories.some(a => a.toLowerCase().includes('belt')) },
      { term: 'scarf', visible: detected.accessories.some(a => a.toLowerCase().includes('scarf')) },
      { term: 'hat', visible: detected.accessories.some(a => a.toLowerCase().includes('hat') || a.toLowerCase().includes('cap')) },
      { term: 'sunglasses', visible: detected.accessories.some(a => a.toLowerCase().includes('sunglasses') || a.toLowerCase().includes('glasses')) },
    ];
    
    // Remove false items from content
    let updatedSection = originalSection;
    for (const item of potentialFalseItems) {
      if (listedItems.includes(item.term) && !item.visible) {
        // Remove this item from the list
        const itemRegex = new RegExp(`<li>[^<]*${item.term}[^<]*</li>\\s*`, 'gi');
        updatedSection = updatedSection.replace(itemRegex, '');
        corrections.push(`Outfit ${outfitNumber}: Removed "${item.term}" - not visible in image`);
      }
    }
    
    // Also fix color mismatches
    if (detected.colors.length > 0) {
      const colorCorrections: Record<string, string[]> = {
        'dark wash': ['medium wash', 'light wash', 'medium-wash', 'light-wash'],
        'light wash': ['dark wash', 'medium wash', 'dark-wash', 'medium-wash'],
      };
      
      for (const [wrong, replacements] of Object.entries(colorCorrections)) {
        if (updatedSection.toLowerCase().includes(wrong)) {
          const hasWrongColor = detected.colors.some(c => c.toLowerCase().includes(wrong.split(' ')[0]));
          if (!hasWrongColor) {
            const actualDenimColor = detected.colors.find(c => 
              c.toLowerCase().includes('denim') || 
              c.toLowerCase().includes('wash') ||
              c.toLowerCase().includes('blue') ||
              c.toLowerCase().includes('jeans')
            );
            if (actualDenimColor) {
              updatedSection = updatedSection.replace(new RegExp(wrong, 'gi'), actualDenimColor);
              corrections.push(`Outfit ${outfitNumber}: Corrected "${wrong}" to "${actualDenimColor}"`);
            }
          }
        }
      }
    }
    
    // Replace the section in content
    if (updatedSection !== originalSection) {
      correctedContent = correctedContent.replace(originalSection, updatedSection);
    }
  }
  
  const accuracyScore = analyzedCount > 0 ? Math.round(totalConfidence / analyzedCount) : 100;
  
  console.log(`✅ Content validation complete: ${accuracyScore}% accuracy, ${corrections.length} corrections made`);
  
  return {
    correctedContent,
    accuracyScore,
    corrections
  };
}

// Extract image URLs from article HTML content
function extractImageUrls(htmlContent: string): string[] {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const urls: string[] = [];
  let match;
  
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    const url = match[1];
    // Only include valid http(s) URLs, skip data: URLs
    if (url && url.startsWith('http')) {
      urls.push(url);
    }
  }
  
  return urls;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleId } = await req.json();
    
    if (!articleId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Article ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the article
    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('content_html, title, niche, generation_metadata')
      .eq('id', articleId)
      .single();

    if (fetchError || !article) {
      return new Response(
        JSON.stringify({ success: false, error: 'Article not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check if this is a fashion article
    if (article.niche !== 'fashion') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Re-validation is only available for fashion articles',
          niche: article.niche 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Extract image URLs from the article content
    const imageUrls = extractImageUrls(article.content_html || '');
    
    if (imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No images found in article to validate against' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`📊 Found ${imageUrls.length} images to analyze for article: ${article.title}`);

    // Run the validation
    const validationResult = await validateAndCorrectFashionContent(
      article.content_html || '',
      imageUrls,
      LOVABLE_API_KEY
    );

    // Update the article with corrected content and metadata
    const existingMetadata = typeof article.generation_metadata === 'object' 
      ? article.generation_metadata 
      : {};
    
    const updatedMetadata = {
      ...existingMetadata,
      content_accuracy_score: validationResult.accuracyScore,
      content_corrections: validationResult.corrections,
      last_revalidated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('articles')
      .update({
        content_html: validationResult.correctedContent,
        generation_metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId);

    if (updateError) {
      throw new Error(`Failed to update article: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        accuracyScore: validationResult.accuracyScore,
        correctionsCount: validationResult.corrections.length,
        corrections: validationResult.corrections,
        imagesAnalyzed: imageUrls.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Revalidation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
